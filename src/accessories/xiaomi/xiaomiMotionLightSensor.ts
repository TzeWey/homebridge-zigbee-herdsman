import { Service } from 'homebridge';
import { ZigbeeAccessory } from '../zigbeeAccessory';
import { BatteryServiceBuilder, LightSensorServiceBuilder, MotionSensorServiceBuilder } from '../../builders';

export class XiaomiMotionLightSensor extends ZigbeeAccessory {
  private battery!: Service;
  private motion!: Service;
  private light!: Service;

  protected resolveServices(): Service[] {
    this.battery = new BatteryServiceBuilder(this).build();
    this.motion = new MotionSensorServiceBuilder(this).build();
    this.light = new LightSensorServiceBuilder(this).build();
    return [this.battery, this.motion, this.light];
  }

  protected async onStateUpdate() {
    // do nothing
  }

  protected async onIdentify() {
    // do nothing
  }
}
