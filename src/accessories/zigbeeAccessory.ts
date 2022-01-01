import { Service, Logger, PlatformAccessory } from 'homebridge';

import { EventEmitter } from 'events';
import assert from 'assert';
import stringify from 'json-stable-stringify-without-jsonify';

import { PluginPlatform } from '../platform';
import {
  Zigbee,
  ZigbeeEntity,
  Device,
  Options,
  KeyValue,
  ToZigbeeConverterGetMeta,
  ToZigbeeConverterResult,
  Endpoint,
  Group,
  MessagePayload,
  ConvertOptions,
  ToZigbeeConverter,
  ZigbeeDevice,
} from '../zigbee';
import { getEndpointNames, secondsToMilliseconds, objectHasProperty } from '../util/utils';
import { peekNextTransactionSequenceNumber } from '../util/zcl';
import { MessageQueue } from '../util/messageQueue';
import { Events } from '.';

const propertyEndpointRegex = new RegExp(`^(.*)_(${getEndpointNames().join('|')}|\\d+)$`);

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
  private readonly messagePublish: (data: KeyValue) => void;

  protected abstract registerEvents(): void;
  protected abstract resolveServices(): Service[];

  constructor(
    public readonly platform: PluginPlatform,
    public readonly accessory: PlatformAccessory,
    private readonly device: Device,
  ) {
    super();
    assert(this.platform);
    assert(this.accessory);

    this.messageQueue = new MessageQueue(this.log, secondsToMilliseconds(2));
    this.messagePublish = this.updateState.bind(this);

    const entity = this.zigbee.resolveEntity(device);

    if (!entity) {
      this.log.error(`ZigbeeAccessory: Failed to resolve device '${device.ieeeAddr}'`);
      this.zigbeeEntity = undefined!;
      return;
    }

    this.zigbeeEntity = entity;

    // Set common accessory information
    const Characteristic = this.platform.Characteristic;
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, this.zigbeeEntity.definition?.vendor || device.manufacturerName)
      .setCharacteristic(Characteristic.Model, device.modelID)
      .setCharacteristic(Characteristic.SerialNumber, device.ieeeAddr)
      .setCharacteristic(Characteristic.Name, this.name);

    // Initialize accessory class
    this.registerEvents();
    this.resolveServices();

    this.accessory.on('identify', this.onIdentify.bind(this));

    this.emit(Events.ready);
  }

  public get state(): KeyValue {
    return this.accessory.context;
  }

  public get options(): ConvertOptions {
    // TODO: make this part of 'accessory.context'
    return { occupancy_timeout: 60 };
  }

  public get ID(): string {
    return this.device.ieeeAddr;
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

  private onIdentify() {
    this.emit(Events.identify);
  }

  private updateState(state: KeyValue, emitEvents = true) {
    this.log.debug(`Updating state of device '${this.name}' with `, state);
    Object.assign(this.state, state);
    this.log.debug(`Updated state for device '${this.name}' is now `, this.state);
    if (emitEvents) {
      this.emit(Events.stateUpdate, state);
    }
  }

  public async processMessage(message: MessagePayload) {
    let processed = false;

    if (message.type === 'readResponse') {
      const messageKey = `${message.device.ieeeAddr}|${message.endpoint.ID}|${message.meta.zclTransactionSequenceNumber}`;
      this.log.debug(`Processing synchronous response for message '${messageKey}'`);
      processed = this.messageQueue.processMessage(messageKey, message);
    }

    if (!processed) {
      const state = this.getMessagePayload(message, this.messagePublish);
      this.log.debug(`Decoded state for '${this.name}' from incoming message`, state);
      if (state) {
        this.messagePublish(state);
      }
    }
  }

  private getMessagePayload(data: MessagePayload, publish: (payload: KeyValue) => void): KeyValue {
    const payload = {};
    const entity = this.zigbeeEntity;

    if (!entity.definition) {
      return {};
    }

    const converters = entity.definition.fromZigbee.filter((c) => {
      const type = Array.isArray(c.type) ? c.type.includes(data.type) : c.type === data.type;
      return c.cluster === data.cluster && type;
    });

    // Check if there is an available converter, genOta messages are not interesting.
    if (!converters || (!converters.length && data.cluster !== 'genOta' && data.cluster !== 'genTime')) {
      this.log.warn(
        `No converter available for '${entity.definition.model}' with cluster '${data.cluster}' ` +
          `and type '${data.type}' and data '${stringify(data.data)}'`,
      );
      return {};
    }

    const meta = { state: this.state, logger: this.log, device: data.device };

    converters.forEach((converter) => {
      if (entity.definition === undefined) {
        return;
      }

      const converted = converter.convert(entity.definition, data, publish, this.options, meta);

      if (converted) {
        Object.assign(payload, converted);
      }
    });

    return payload;
  }

  private getEntries(input: KeyValue) {
    /**
     * Order state & brightness based on current bulb state
     *
     * Not all bulbs support setting the color/color_temp while it is off
     * this results in inconsistent behavior between different vendors.
     *
     * bulb on => move state & brightness to the back
     * bulb off => move state & brightness to the front
     */
    const entries = Object.entries(input);
    const sorter = typeof input.state === 'string' && input.state.toLowerCase() === 'off' ? 1 : -1;
    entries.sort((a) => (['state', 'brightness', 'brightness_percent'].includes(a[0]) ? sorter : sorter * -1));
    return entries;
  }

  private legacyRetrieveState(
    entity: ZigbeeEntity,
    converter: ToZigbeeConverter,
    result: ToZigbeeConverterResult,
    target: Endpoint | Group,
    key: string,
    meta: ToZigbeeConverterGetMeta,
  ): void {
    // It's possible for devices to get out of sync when writing an attribute that's not reportable.
    // So here we re-read the value after a specified timeout, this timeout could for example be the
    // transition time of a color change or for forcing a state read for devices that don't
    // automatically report a new state when set.
    // When reporting is requested for a device (report: true in device-specific settings) we won't
    // ever issue a read here, as we assume the device will properly report changes.
    // Only do this when the retrieve_state option is enabled for this device.
    // retrieve_state == deprecated
    if (
      entity instanceof ZigbeeDevice &&
      result &&
      objectHasProperty(result, 'readAfterWriteTime') &&
      entity.settings.retrieve_state
    ) {
      setTimeout(() => converter.convertGet && converter.convertGet(target, key, meta), result.readAfterWriteTime);
    }
  }

  private async publishDeviceState<T>(type: 'get' | 'set', state: T, options: Options = {}): Promise<T> {
    const entity = this.zigbeeEntity;

    if (!(entity instanceof ZigbeeDevice)) {
      this.log.error('Only ZigbeeDevice is implemented!', entity);
      return state;
    }

    const device = entity.zh;

    if (!entity.definition) {
      this.log.warn(`Device with modelID '${device.modelID}' is not supported.`);
      this.log.warn('Please see: https://www.zigbee2mqtt.io/how_tos/how_to_support_new_devices.html');
      return state;
    }

    const target = entity.endpoint();
    if (target === null) {
      this.log.warn(`Device with modelID '${device.modelID}' has no endpoint.`);
      return state;
    }

    const definition = entity.definition;
    const converters = definition.toZigbee;
    const usedConverters: { [s: number]: ToZigbeeConverter[] } = {};
    const responseKeys: string[] = [];

    // For each attribute call the corresponding converter
    for (const [keyIn, value] of this.getEntries(state)) {
      let key = keyIn;
      let endpointName = target.ID.toString();
      let localTarget = target;

      // When the key has a endpointName included (e.g. state_right), this will override the target.
      const propertyEndpointMatch = key.match(propertyEndpointRegex);
      if (propertyEndpointMatch) {
        endpointName = propertyEndpointMatch[2];
        key = propertyEndpointMatch[1];
        localTarget = entity.endpoint(endpointName);
        if (localTarget === null) {
          this.log.error(`Device '${entity.name}' has no endpoint '${endpointName}'`);
          continue;
        }
      }

      const endpointID = localTarget.ID;
      if (!(endpointID in usedConverters)) {
        usedConverters[endpointID] = [];
      }

      const converter = converters.find((c) => c.key.includes(key));
      if (!converter) {
        this.log.error(`No converter available for '${key}' (${state[key]})`);
        continue;
      }

      if (type === 'set' && usedConverters[endpointID].includes(converter)) {
        // Use a converter only once (e.g. light_onoff_brightness converters can convert state and brightness)
        continue;
      }

      const meta = {
        endpoint_name: endpointName,
        options,
        message: { ...state },
        logger: this.log,
        device,
        state: state,
        membersState: null,
        mapped: definition,
      };

      if (type === 'set' && converter.convertSet) {
        this.log.debug(`Publishing '${type}' '${key}' with '${value}' to '${this.name}'`);
        const result = (await converter.convertSet(localTarget, key, value, meta).catch((error) => {
          const message = `Publish '${type}' '${key}' to '${this.name}' failed: '${error}'`;
          this.log.error(message);
        })) as ToZigbeeConverterResult;
        this.legacyRetrieveState(entity, converter, result, localTarget, key, meta);
      } else if (type === 'get' && converter.convertGet) {
        const sequenceNumber = peekNextTransactionSequenceNumber();
        const messageKey = `${device.ieeeAddr}|${endpointID}|${sequenceNumber}`;
        this.log.debug(`Publishing '${type}' '${key}' to '${this.name}' with message key '${messageKey}'`);
        responseKeys.push(this.messageQueue.enqueue(messageKey));
        // TODO: fix messageQueue, we currently rely on the message to get published before we 'wait', possible race condition when the
        // devices responds faster than we can publish the 'get' messages (fails when we 'await' convertGet)
        converter.convertGet(localTarget, key, meta).catch((error) => {
          const message = `Publish '${type}' '${key}' to '${this.name}' failed: '${error}'`;
          this.log.error(message);
        });
      } else {
        this.log.error(`No converter available for '${type}' '${key}' (${value})`);
        continue;
      }

      usedConverters[endpointID].push(converter);
    }

    if (type === 'get' && responseKeys.length) {
      this.log.debug(`TX ${responseKeys.length} message(s) to device ${this.name}`);
      const responses = await this.messageQueue.wait(responseKeys).catch((error) => {
        const message = `Message 'get' timeout: '${error}'`;
        this.log.error(message);
        return [];
      });
      this.log.debug(`RX ${responses.length} message(s) from device ${this.name}`);

      if (responses.length !== responseKeys.length) {
        throw new Error('Did not receive all responses from device');
      }

      responses.forEach((response) => {
        const payload = this.getMessagePayload(response, this.messagePublish);
        this.log.debug(`Decoded state for '${this.name}' from response message`, payload);

        // Update accessory state context only
        // Do not emit the state update event to avoid double processing as this was an explicit 'get' request by the caller
        this.updateState(payload);
      });
    }

    // Return the accessory state context
    return this.state as T;
  }

  public async setDeviceState<T>(state: T, options: Options = {}): Promise<T> {
    return this.publishDeviceState('set', state, options);
  }

  public async getDeviceState<T>(state: T, options: Options = {}): Promise<T> {
    return this.publishDeviceState('get', state, options);
  }
}
