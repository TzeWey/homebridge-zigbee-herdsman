import { Service } from 'homebridge';
import { ZigbeeAccessory } from '../zigbeeAccessory';
import { BatteryServiceBuilder, HumiditySensorServiceBuilder, TemperatureSensorServiceBuilder } from '../../builders';

export class XiaomiTemperatureHumidityPressureSensor extends ZigbeeAccessory {
  private battery!: Service;
  private humidity!: Service;
  private temperature!: Service;

  protected resolveServices(): Service[] {
    this.battery = new BatteryServiceBuilder(this).build();
    this.humidity = new HumiditySensorServiceBuilder(this).withHumidity().build();
    this.temperature = new TemperatureSensorServiceBuilder(this).withTemperature().build();
    return [this.battery, this.humidity, this.temperature];
  }

  protected async onStateUpdate() {
    // do nothing
  }

  protected async onIdentify() {
    // do nothing
  }
}
