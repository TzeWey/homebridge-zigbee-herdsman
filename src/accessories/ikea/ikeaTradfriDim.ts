import { Service } from 'homebridge';
import { ZigbeeAccessory } from '../zigbeeAccessory';
import { LightbulbServiceBuilder } from '../../builders';

export class IkeaTradfriDim extends ZigbeeAccessory {
  protected service!: Service;

  protected resolveServices() {
    this.service = new LightbulbServiceBuilder(this).withOnOff().withBrightness().build();
    return [this.service];
  }

  protected async onStateUpdate() {
    // do nothing
  }

  protected async onIdentify() {
    // do nothing
  }
}
