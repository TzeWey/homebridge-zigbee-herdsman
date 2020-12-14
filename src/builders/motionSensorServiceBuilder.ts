import { CharacteristicEventTypes, CharacteristicGetCallback } from 'homebridge';

import { ZigbeeAccessory, Events } from '../accessories';
import { ServiceBuilder } from './serviceBuilder';

export class MotionSensorServiceBuilder extends ServiceBuilder {
  constructor(protected readonly zigbeeAccessory: ZigbeeAccessory) {
    super(zigbeeAccessory);

    const Characteristic = this.platform.Characteristic;

    this.service =
      this.accessory.getService(this.platform.Service.MotionSensor) ||
      this.accessory.addService(this.platform.Service.MotionSensor);

    this.service
      .getCharacteristic(Characteristic.MotionDetected)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        callback(null, this.zigbeeAccessory.state.occupancy);
      });

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { occupancy?: boolean }) => {
      if (typeof state.occupancy !== 'undefined') {
        const motionDetected = state.occupancy;
        this.debugState('MotionDetected', motionDetected);
        this.service.updateCharacteristic(Characteristic.MotionDetected, motionDetected);
      }
    });
  }

  withMotionCleared(): MotionSensorServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    // Clear occupancy state and update state
    this.zigbeeAccessory.state.occupancy = false;
    this.service.updateCharacteristic(Characteristic.MotionDetected, false);

    return this;
  }
}
