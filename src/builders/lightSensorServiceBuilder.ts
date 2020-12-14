import { CharacteristicEventTypes, CharacteristicGetCallback } from 'homebridge';

import { ZigbeeAccessory, Events } from '../accessories';
import { ServiceBuilder } from './serviceBuilder';

export class LightSensorServiceBuilder extends ServiceBuilder {
  constructor(protected readonly zigbeeAccessory: ZigbeeAccessory) {
    super(zigbeeAccessory);

    const Characteristic = this.platform.Characteristic;

    this.service =
      this.accessory.getService(this.platform.Service.LightSensor) ||
      this.accessory.addService(this.platform.Service.LightSensor);

    this.service
      .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        callback(null, this.zigbeeAccessory.state.illuminance_lux);
      });

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { illuminance_lux?: number }) => {
      if (typeof state.illuminance_lux !== 'undefined') {
        const illuminance_lux = state.illuminance_lux;
        this.debugState('CurrentAmbientLightLevel', illuminance_lux);
        this.service.updateCharacteristic(Characteristic.CurrentAmbientLightLevel, illuminance_lux);
      }
    });
  }
}
