import {
  CharacteristicValue,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
} from 'homebridge';
import { types } from 'util';

import { ZigbeeAccessory, Events } from '../accessories';
import { ServiceBuilder } from './serviceBuilder';

export class OutletServiceBuilder extends ServiceBuilder {
  constructor(protected readonly zigbeeAccessory: ZigbeeAccessory) {
    super(zigbeeAccessory);

    this.service =
      this.platformAccessory.getService(this.platform.Service.Outlet) ||
      this.platformAccessory.addService(this.platform.Service.Outlet);
  }

  public withOnOff(): OutletServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.On)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        try {
          const on = value as boolean;
          await this.setOn(on);
          this.debugState('=> State', value);
          callback();
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      })
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const state = await this.getOnOffState();
          callback(null, state.state === 'ON');
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { state?: 'ON' | 'OFF' }) => {
      if (state.state !== undefined) {
        this.debugState('State', state.state);
        this.service.updateCharacteristic(Characteristic.On, state.state === 'ON');
      }
    });

    return this;
  }
}
