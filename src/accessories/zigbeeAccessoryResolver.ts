import { Logger, PlatformAccessory } from 'homebridge';
import { findByDevice } from 'zigbee-herdsman-converters';

import { PluginPlatform } from '../platform';
import { Device } from '../zigbee';
import { ZigbeeAccessory } from './zigbeeAccessory';

import { GenericOutlet } from './generic';
import { IkeaMotionSensor, IkeaOnOffSwitch, IkeaTradfriDimColor } from './ikea';
import { TerncySmartLightSocket } from './terncy';
import { TuyaOnOffTripleSwitch } from './tuya';
import { XiaomiMotionLightSensor, XiaomiTemperatureHumidityPressureSensor } from './xiaomi';

export interface ZigbeeAccessoryFactory {
  new (platform: PluginPlatform, accessory: PlatformAccessory, device: Device): ZigbeeAccessory;
}

export class ZigbeeAccessoryResolver {
  private readonly log: Logger = this.platform.log;
  private readonly registry: Map<string, ZigbeeAccessoryFactory> = new Map();

  constructor(private readonly platform: PluginPlatform) {
    let vendor: string;

    /*
     * IKEA
     */
    vendor = 'IKEA';
    this.registerFactory(vendor, ['E1603/E1702/E1708'], GenericOutlet);
    this.registerFactory(vendor, ['E1525/E1745'], IkeaMotionSensor);
    this.registerFactory(vendor, ['E1743'], IkeaOnOffSwitch);
    this.registerFactory(vendor, ['LED1624G9'], IkeaTradfriDimColor);

    /*
     * SONOFF
     */
    vendor = 'SONOFF';
    this.registerFactory(vendor, ['ZBMINI'], GenericOutlet);

    /*
     * TERNCY
     */
    vendor = 'TERNCY';
    this.registerFactory(vendor, ['TERNCY-LS01'], TerncySmartLightSocket);

    /*
     * TuYa
     */
    vendor = 'TuYa';
    this.registerFactory(vendor, ['TS0043'], TuyaOnOffTripleSwitch);
    this.registerFactory(vendor, ['TS011F_socket_module'], GenericOutlet);

    /*
     * Xiaomi
     */
    vendor = 'Xiaomi';
    this.registerFactory(vendor, ['RTCGQ11LM'], XiaomiMotionLightSensor);
    this.registerFactory(vendor, ['WSDCGQ11LM'], XiaomiTemperatureHumidityPressureSensor);
  }

  private getKey(vendor: string, model: string) {
    return `${vendor}:${model}`;
  }

  private registerFactory(vendor: string, models: string[], factory: ZigbeeAccessoryFactory) {
    models.forEach((model) => this.registry.set(this.getKey(vendor, model), factory));
  }

  public getFactory(device: Device): ZigbeeAccessoryFactory | undefined {
    const definition = findByDevice(device);
    if (!definition) {
      this.log.warn(
        `Unable to resolve definition for '${device.ieeeAddr}' [${device.manufacturerName}:${device.modelID}] `,
      );
      return undefined;
    }

    const key = this.getKey(definition.vendor, definition.model);
    const factory = this.registry.get(key);

    if (!factory) {
      this.log.warn(
        `Unable to resolve accessory factory for '${device.ieeeAddr}' [${definition.vendor}:${definition.model}] `,
      );
      return undefined;
    }

    return factory;
  }
}
