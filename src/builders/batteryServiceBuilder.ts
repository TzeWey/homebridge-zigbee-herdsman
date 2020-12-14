import { CharacteristicEventTypes, CharacteristicGetCallback } from 'homebridge';

import { ZigbeeAccessory, Events } from '../accessories';
import { ServiceBuilder } from './serviceBuilder';

export class BatteryServiceBuilder extends ServiceBuilder {
  constructor(protected readonly zigbeeAccessory: ZigbeeAccessory) {
    super(zigbeeAccessory);

    const Characteristic = this.platform.Characteristic;

    this.service =
      this.accessory.getService(this.platform.Service.BatteryService) ||
      this.accessory.addService(this.platform.Service.BatteryService);

    // BatteryLevel, assume 100% battery if uninitialized
    this.service
      .getCharacteristic(Characteristic.BatteryLevel)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        const battery = (this.zigbeeAccessory.state.battery as number) || 100;
        callback(null, battery);
      });

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { battery?: number }) => {
      if (state.battery) {
        this.debugState('BatteryLevel', state.battery);
        this.service.updateCharacteristic(Characteristic.BatteryLevel, state.battery);
      }
    });
  }
}
