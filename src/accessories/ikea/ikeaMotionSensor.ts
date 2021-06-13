import { Service } from 'homebridge';
import { ZigbeeAccessory } from '..';
import { BatteryServiceBuilder, MotionSensorServiceBuilder } from '../../builders';

export class IkeaMotionSensor extends ZigbeeAccessory {
  private motion!: Service;
  private battery!: Service;

  protected registerEvents() {
    // No events of interest
  }

  protected resolveServices(): Service[] {
    this.battery = new BatteryServiceBuilder(this).build();
    this.motion = new MotionSensorServiceBuilder(this).withMotionCleared().build();

    return [this.battery, this.motion];
  }
}
