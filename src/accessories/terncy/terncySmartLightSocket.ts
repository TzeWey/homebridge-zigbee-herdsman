import { Service } from 'homebridge';
import { ZigbeeAccessory, Events } from '..';
import { LightbulbServiceBuilder } from '../../builders';

export class TerncySmartLightSocket extends ZigbeeAccessory {
  private service!: Service;

  protected registerEvents() {
    // No events of interest
  }

  protected resolveServices(): Service[] {
    this.service = new LightbulbServiceBuilder(this).withOnOff().build();
    return [this.service];
  }
}
