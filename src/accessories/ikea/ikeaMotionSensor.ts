import { Service } from 'homebridge';
import { ZigbeeAccessory } from '../zigbeeAccessory';
import { BatteryServiceBuilder, MotionSensorServiceBuilder } from '../../builders';

export class IkeaMotionSensor extends ZigbeeAccessory {
  private motion!: Service;
  private battery!: Service;

  protected resolveServices(): Service[] {
    this.battery = new BatteryServiceBuilder(this).build();
    this.motion = new MotionSensorServiceBuilder(this).withMotionCleared().build();

    return [this.battery, this.motion];
  }

  protected async onStateUpdate() {
    // do nothing
  }

  protected async onIdentify() {
    // do nothing
  }
}
