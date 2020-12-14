import { Service, Logger, PlatformAccessory } from 'homebridge';

import { EventEmitter } from 'events';
import assert from 'assert';
import stringify from 'json-stable-stringify-without-jsonify';

import { ZigbeeHerdsmanPlatform } from '../platform';
import { Zigbee, ZigbeeEntity, Device, Options, Meta, MessagePayload } from '../zigbee';
import { getEndpointNames, objectHasProperties, secondsToMilliseconds } from '../util/utils';
import { peekNextTransactionSequenceNumber } from '../util/zcl';
import { MessageQueue } from '../util/messageQueue';
import { Events } from '.';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export abstract class ZigbeeAccessory extends EventEmitter {
  protected readonly log: Logger = this.platform.log;
  private readonly zigbee: Zigbee = this.platform.zigbee;
  private readonly zigbeeEntity: ZigbeeEntity;
  private readonly messageQueue: MessageQueue<string, MessagePayload>;
  private readonly messagePublish: (...args: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor(
    public readonly platform: ZigbeeHerdsmanPlatform,
    public readonly accessory: PlatformAccessory,
    public readonly device: Device,
  ) {
    super();
    assert(this.platform);
    assert(this.accessory);

    this.zigbeeEntity = this.zigbee.resolveEntity(device);
    this.messageQueue = new MessageQueue(this.log, secondsToMilliseconds(2));
    this.messagePublish = this.updateState.bind(this);

    if (!this.zigbeeEntity) {
      this.log.error(`ZigbeeAccessory: failed to resolve device ${device.ieeeAddr}`);
      return;
    }

    // Update entity name with accessory name
    this.zigbeeEntity.name = this.name;

    // Set common accessory information
    const Characteristic = this.platform.Characteristic;
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, this.zigbeeEntity.definition?.vendor || device.manufacturerName)
      .setCharacteristic(Characteristic.Model, device.modelID)
      .setCharacteristic(Characteristic.SerialNumber, device.ieeeAddr)
      .setCharacteristic(Characteristic.Name, this.name);

    // Resolve accessory services
    this.resolveServices();

    this.accessory.on('identify', this.onIdentify.bind(this));

    this.emit(Events.ready);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get state(): any {
    return this.accessory.context;
  }

  public get name(): string {
    return this.device.modelID || this.accessory.displayName;
  }

  public get description(): string {
    return this.zigbeeEntity?.definition?.description || this.name;
  }

  public get vendor(): string {
    return this.zigbeeEntity?.definition?.vendor || this.device.manufacturerName;
  }

  protected abstract resolveServices(): Service[];
  protected abstract onStateUpdate(state: any): Promise<void>; // eslint-disable-line @typescript-eslint/no-explicit-any
  protected abstract onIdentify(): Promise<void>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async updateState(state: any) {
    Object.assign(this.state, state);
    this.emit(Events.stateUpdate, state);
    await this.onStateUpdate(state);
  }

  public async processMessage(message: MessagePayload) {
    let processed = false;

    if (message.type === 'readResponse') {
      const messageKey = `${message.device.ieeeAddr}|${message.endpoint.ID}|${message.meta.zclTransactionSequenceNumber}`;
      processed = this.messageQueue.processMessage(messageKey, message);
    }

    if (!processed) {
      const state = this.getMessagePayload(message, this.messagePublish);
      this.log.debug(`Decoded state for '${message.device.modelID}' from incoming message`, state);
      if (state) {
        this.messagePublish(state);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getEntries(json: any) {
    /**
     * Order state & brightness based on current bulb state
     *
     * Not all bulbs support setting the color/color_temp while it is off
     * this results in inconsistent behavior between different vendors.
     *
     * bulb on => move state & brightness to the back
     * bulb off => move state & brightness to the front
     */
    const entries = Object.entries(json);
    const sorter = typeof json.state === 'string' && json.state.toLowerCase() === 'off' ? 1 : -1;
    entries.sort((a) => (['state', 'brightness', 'brightness_percent'].includes(a[0]) ? sorter : sorter * -1));
    return entries;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getMessagePayload(data: MessagePayload, publish: (...args: any[]) => void, options: Options = {}): any {
    const payload = {};
    const resolvedEntity = this.zigbeeEntity;

    if (!resolvedEntity.definition) {
      return;
    }

    const converters = resolvedEntity.definition.fromZigbee.filter((c) => {
      const type = Array.isArray(c.type) ? c.type.includes(data.type) : c.type === data.type;
      return c.cluster === data.cluster && type;
    });

    // Check if there is an available converter, genOta messages are not interesting.
    if (!converters || (!converters.length && data.cluster !== 'genOta' && data.cluster !== 'genTime')) {
      this.log.warn(
        `No converter available for '${resolvedEntity.definition.model}' with cluster '${data.cluster}' ` +
          `and type '${data.type}' and data '${stringify(data.data)}'`,
      );
      return;
    }

    const meta: Meta = { device: data.device, logger: this.log };
    converters.forEach((converter) => {
      const converted = converter.convert(resolvedEntity.definition, data, publish, options, meta);
      if (converted) {
        Object.assign(payload, converted);
      }
    });

    return payload;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async publishDeviceState(type: 'get' | 'set', state: any, options: Options = {}): Promise<any> {
    const resolvedEntity = this.zigbeeEntity;
    if (!resolvedEntity.definition) {
      this.log.warn(`Device with modelID '${resolvedEntity.device?.modelID}' is not supported.`);
      this.log.warn('Please see: https://www.zigbee2mqtt.io/how_tos/how_to_support_new_devices.html');
      return state;
    }

    const target = resolvedEntity.endpoint;
    if (!target) {
      this.log.warn(`Device with modelID '${resolvedEntity.device?.modelID}' has no endpoint.`);
      return state;
    }

    const definition = resolvedEntity.definition;
    const converters = definition.toZigbee;
    const usedConverters: Map<number, any[]> = new Map(); // eslint-disable-line @typescript-eslint/no-explicit-any
    const device = this.device;
    const responseKeys: string[] = [];

    // For each attribute call the corresponding converter
    for (const [keyIn, value] of this.getEntries(state)) {
      let key = keyIn;
      let endpointName = target.ID.toString();
      let actualTarget = target;

      // When the key has an endpointName included (e.g. state_right), this will override the target.
      if (key.includes('_')) {
        const underscoreIndex = key.lastIndexOf('_');
        const possibleEndpointName = key.substring(underscoreIndex + 1, key.length);
        if (getEndpointNames().includes(possibleEndpointName)) {
          endpointName = possibleEndpointName;
          key = key.substring(0, underscoreIndex);
          const device = target.getDevice();
          actualTarget = device.getEndpoint(definition.endpoint(device)[endpointName]);

          if (!actualTarget) {
            this.log.error(`Device '${resolvedEntity.name}' has no endpoint '${endpointName}'`);
            continue;
          }
        }
      }

      // TODO: Implement group handling
      const endpointOrGroupID = actualTarget.ID;
      if (!usedConverters.has(endpointOrGroupID)) {
        usedConverters[endpointOrGroupID] = [];
      }
      const converter = converters.find((c) => c.key.includes(key));

      if (usedConverters[endpointOrGroupID].includes(converter)) {
        // Use a converter only once (e.g. light_onoff_brightness converters can convert state and brightness)
        continue;
      }

      if (!converter) {
        this.log.error(`No converter available for '${key}' (${state[key]})`);
        continue;
      }

      // Converter didn't return a result, skip
      const meta: Meta = {
        endpoint_name: endpointName,
        options,
        message: state,
        logger: this.log,
        device,
        mapped: definition.meta,
        state: state,
      };

      if (type === 'set' && converter.convertSet) {
        this.log.debug(`Publishing '${type}' '${key}' to '${resolvedEntity.name}'`);
        const result = await converter.convertSet(actualTarget, key, value, meta).catch((error) => {
          const message = `Publish '${type}' '${key}' to '${resolvedEntity.name}' failed: '${error}'`;
          this.log.error(message);
        });

        // It's possible for devices to get out of sync when writing an attribute that's not reportable.
        // So here we re-read the value after a specified timeout, this timeout could for example be the
        // transition time of a color change or for forcing a state read for devices that don't
        // automatically report a new state when set.
        // When reporting is requested for a device (report: true in device-specific settings) we won't
        // ever issue a read here, as we assume the device will properly report changes.
        // Only do this when the retrieve_state option is enabled for this device. (TODO: implement device specific settings)
        if (resolvedEntity.type === 'device' && result && objectHasProperties(result, 'readAfterWriteTime')) {
          setTimeout(
            async () => converter.convertGet && converter.convertGet(actualTarget, key, meta),
            result.readAfterWriteTime,
          );
        }
        Object.assign(state, result.state);
      } else if (type === 'get' && converter.convertGet) {
        const sequenceNumber = peekNextTransactionSequenceNumber();
        const messageKey = `${device.ieeeAddr}|${endpointOrGroupID}|${sequenceNumber}`;
        this.log.debug(`Publishing '${type}' '${key}' to '${resolvedEntity.name}' with message key '${messageKey}'`);
        responseKeys.push(this.messageQueue.enqueue(messageKey));
        converter.convertGet(actualTarget, key, meta).catch((error) => {
          const message = `Publish '${type}' '${key}' to '${resolvedEntity.name}' failed: '${error}'`;
          this.log.error(message);
        });
      } else {
        this.log.error(`No converter available for '${type}' '${key}' (${state[key]})`);
        continue;
      }

      usedConverters[endpointOrGroupID].push(converter);
    }

    if (type === 'get' && responseKeys.length) {
      this.log.debug(`TX ${responseKeys.length} message(s) to device ${device.modelID}`);
      const responses = await this.messageQueue.wait(responseKeys);
      this.log.debug(`RX ${responses.length} message(s) from device ${device.modelID}`);

      if (responses.length === 0) {
        throw new Error('No response received from device');
      }

      responses.forEach((response) => {
        const payload = this.getMessagePayload(response, this.messagePublish);
        this.log.debug(`Decoded state for '${device.modelID}' from response message`, payload);

        // Update accessory state context only
        // Do not emit the state update event to avoid double processing as this was an explicit 'get' request by the caller
        Object.assign(this.state, payload);
      });
    }

    return this.state; // Return the accessory state context
  }

  public async setDeviceState<T>(json: T, options: Options = {}): Promise<T> {
    return this.publishDeviceState('set', json, options);
  }

  public async getDeviceState<T>(json: T, options: Options = {}): Promise<T> {
    return this.publishDeviceState('get', json, options);
  }
}
