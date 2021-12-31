import { CharacteristicEventTypes, CharacteristicGetCallback, HAPStatus } from 'homebridge';

import { ZigbeeAccessory, Events } from '../accessories';
import { ServiceBuilder } from './serviceBuilder';

export class LightSensorServiceBuilder extends ServiceBuilder {
  constructor(protected readonly zigbeeAccessory: ZigbeeAccessory) {
    super(zigbeeAccessory);

    const Characteristic = this.platform.Characteristic;

    this.service =
      this.platformAccessory.getService(this.platform.Service.LightSensor) ||
      this.platformAccessory.addService(this.platform.Service.LightSensor);

    this.service
      .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        const illuminance_lux = this.zigbeeAccessory.state?.illuminance_lux || 0.001;
        callback(HAPStatus.SUCCESS, Math.max(illuminance_lux, 0.001));
      });

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { illuminance_lux?: number }) => {
      if (typeof state.illuminance_lux !== 'undefined') {
        const illuminance_lux = Math.max(state.illuminance_lux, 0.001);
        this.debugState('CurrentAmbientLightLevel', illuminance_lux);
        this.service.updateCharacteristic(Characteristic.CurrentAmbientLightLevel, illuminance_lux);
      }
    });
  }
}
