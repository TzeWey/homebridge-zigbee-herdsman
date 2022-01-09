import { Service } from 'homebridge';
import { ZigbeeAccessory } from '..';
import { LightbulbServiceBuilder } from '../../builders';

export class IkeaTradfriDim extends ZigbeeAccessory {
  protected service!: Service;

  protected registerEvents() {
    // No events of interest
  }

  protected resolveServices() {
    this.service = new LightbulbServiceBuilder(this).withOnOff().withBrightnessPercent().build();
    return [this.service];
  }
}
