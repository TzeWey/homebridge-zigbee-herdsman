import { Service } from 'homebridge';
import { ZigbeeAccessory } from '..';
import { LightbulbServiceBuilder } from '../../builders';

export class IkeaTradfriDimColor extends ZigbeeAccessory {
  protected service!: Service;

  protected registerEvents() {
    // No events of interest
  }

  protected resolveServices() {
    this.service = new LightbulbServiceBuilder(this).withOnOff().withBrightness().withColorXY().build();
    return [this.service];
  }
}
