import { Service } from 'homebridge';
import { ZigbeeAccessory } from '..';
import { BatteryServiceBuilder, LightSensorServiceBuilder, MotionSensorServiceBuilder } from '../../builders';

export class XiaomiMotionLightSensor extends ZigbeeAccessory {
  private battery!: Service;
  private motion!: Service;
  private light!: Service;

  protected registerEvents() {
    // No events of interest
  }

  protected resolveServices(): Service[] {
    this.battery = new BatteryServiceBuilder(this).build();
    this.light = new LightSensorServiceBuilder(this).build();
    this.motion = new MotionSensorServiceBuilder(this).build();
    return [this.battery, this.light, this.motion];
  }
}
