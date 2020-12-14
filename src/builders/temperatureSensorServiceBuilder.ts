import { CharacteristicEventTypes, CharacteristicGetCallback } from 'homebridge';

import { ZigbeeAccessory, Events } from '../accessories';
import { ServiceBuilder } from './serviceBuilder';

export class TemperatureSensorServiceBuilder extends ServiceBuilder {
  constructor(protected readonly zigbeeAccessory: ZigbeeAccessory) {
    super(zigbeeAccessory);
    this.service =
      this.accessory.getService(this.platform.Service.TemperatureSensor) ||
      this.accessory.addService(this.platform.Service.TemperatureSensor);
  }

  public withTemperature(): TemperatureSensorServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        callback(null, this.zigbeeAccessory.state.temperature);
      });

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { temperature?: number }) => {
      if (state.temperature) {
        this.debugState('CurrentTemperature', state.temperature);
        this.service.updateCharacteristic(Characteristic.CurrentTemperature, state.temperature);
      }
    });

    return this;
  }
}
