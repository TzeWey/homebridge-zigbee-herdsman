import { CharacteristicEventTypes, CharacteristicGetCallback } from 'homebridge';

import { ZigbeeAccessory, Events } from '../accessories';
import { ServiceBuilder } from './serviceBuilder';

export class HumiditySensorServiceBuilder extends ServiceBuilder {
  constructor(protected readonly zigbeeAccessory: ZigbeeAccessory) {
    super(zigbeeAccessory);
    this.service =
      this.platformAccessory.getService(this.platform.Service.HumiditySensor) ||
      this.platformAccessory.addService(this.platform.Service.HumiditySensor);
  }

  public withHumidity(): HumiditySensorServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        callback(null, this.zigbeeAccessory.state.humidity || 0);
      });

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { humidity?: number }) => {
      if (state.humidity !== undefined) {
        this.debugState('CurrentRelativeHumidity', state.humidity);
        this.service.updateCharacteristic(Characteristic.CurrentRelativeHumidity, state.humidity);
      }
    });

    return this;
  }
}
