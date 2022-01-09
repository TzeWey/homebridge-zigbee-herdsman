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
  Definition,
} from '../zigbee';
import { getEndpointNames, objectHasProperty } from '../utils/utils';
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
    const state = this.getMessagePayload(message, this.messagePublish);
    this.log.debug(`Decoded state for '${this.name}' from incoming message`, state);
    if (state) {
      this.messagePublish(state);
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

  private getPublishTarget(
    entity: ZigbeeDevice,
    endpoint: Endpoint,
    key: string,
  ): { endpointName: string; publishEndpoint: Endpoint; publishKey: string } | null {
    let endpointName = endpoint.ID.toString();
    let publishKey = key;
    let publishEndpoint: Endpoint = endpoint;

    // When the key has a endpointName included (e.g. state_right), this will override the target.
    const propertyEndpointMatch = publishKey.match(propertyEndpointRegex);
    if (propertyEndpointMatch) {
      endpointName = propertyEndpointMatch[2];
      publishKey = propertyEndpointMatch[1];
      const tempEndpoint = entity.endpoint(endpointName);
      if (tempEndpoint === null) {
        this.log.error(`Device '${entity.name}' has no endpoint '${endpointName}'`);
        return null;
      }
      publishEndpoint = tempEndpoint;
    }

    return {
      endpointName,
      publishEndpoint,
      publishKey,
    };
  }

  /**
   * Check whether a converter has already been used.
   */
  private checkConverterAlreadyUsed(
    endpoint: Endpoint,
    usedConverters: Map<number, ToZigbeeConverter[]>,
    converter: ToZigbeeConverter,
  ): boolean {
    const endpointID = endpoint.ID;
    const converters = usedConverters.get(endpointID);

    if (converters === undefined) {
      usedConverters.set(endpointID, []);
      return false;
    }

    if (converters.includes(converter)) {
      return true;
    }

    converters.push(converter);
    return false;
  }

  private getConverter(
    type: 'get' | 'set',
    endpoint: Endpoint,
    definition: Definition,
    usedConverters: Map<number, ToZigbeeConverter[]>,
    key: string,
  ): ToZigbeeConverter | false | null {
    const converters = definition.toZigbee;
    const converter = converters.find((c) => c.key.includes(key));

    if (!converter) {
      return null;
    }

    // Check to ensure a converter is only used once for 'set' requests.
    // (e.g. light_onoff_brightness converters can convert state and brightness)
    if (type === 'set' && this.checkConverterAlreadyUsed(endpoint, usedConverters, converter)) {
      return false;
    }

    return converter;
  }

  private async publishDeviceState<T>(type: 'get' | 'set', state: T, options: Options = {}): Promise<T> {
    const entity = this.zigbeeEntity;

    if (!(entity instanceof ZigbeeDevice)) {
      this.log.error('Only ZigbeeDevice is implemented!', entity);
      return this.state as T;
    }

    const device = entity.zh;

    if (!entity.definition) {
      this.log.warn(`Device with modelID '${device.modelID}' is not supported.`);
      this.log.warn('Please see: https://www.zigbee2mqtt.io/how_tos/how_to_support_new_devices.html');
      return this.state as T;
    }

    const endpoint = entity.endpoint();
    if (endpoint === null) {
      this.log.warn(`Device with modelID '${device.modelID}' has no endpoint.`);
      return this.state as T;
    }

    const usedConverters = new Map<number, ToZigbeeConverter[]>();

    // For each attribute call the corresponding converter
    for (const [originalKey, value] of this.getEntries(state)) {
      const publishTarget = this.getPublishTarget(entity, endpoint, originalKey);

      if (publishTarget === null) {
        continue;
      }

      const { endpointName, publishEndpoint, publishKey: key } = publishTarget;

      const definition = entity.definition;
      const converter = this.getConverter(type, endpoint, definition, usedConverters, key);

      if (converter === null) {
        this.log.warn(`No converter available for '${key}' (${state[key]})`);
        continue;
      } else if (converter === false) {
        // Converter has already been used
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

      // Invoke converter to publish message
      // Do not await converters as it may cause homebridge to appear unresponsive should the device be unreachable
      if (type === 'set' && converter.convertSet) {
        this.log.debug(`Publishing '${type}' '${key}' with '${value}' to '${this.name}'`);
        converter
          .convertSet(publishEndpoint, key, value, meta)
          .then((result: ToZigbeeConverterResult) => {
            // Invoke the legacy state retrieve handler
            this.legacyRetrieveState(entity, converter, result, publishEndpoint, key, meta);
          })
          .catch((error) => {
            this.log.warn(`Publish '${type}' '${key}' to '${this.name}' failed:\n${error}`);
          });
      } else if (type === 'get' && converter.convertGet) {
        this.log.debug(`Publishing '${type}' '${key}' to '${this.name}'`);
        converter.convertGet(publishEndpoint, key, meta).catch((error) => {
          this.log.warn(`Publish '${type}' '${key}' to '${this.name}' failed:\n${error}`);
        });
      } else {
        // No converters available for state
        this.log.warn(`No converter available for '${type}' '${key}' (${value})`);
        continue;
      }
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
