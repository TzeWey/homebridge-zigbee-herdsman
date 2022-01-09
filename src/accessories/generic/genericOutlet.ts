import { Service } from 'homebridge';
import { ZigbeeAccessory, Events } from '..';
import { OutletServiceBuilder } from '../../builders';

export class GenericOutlet extends ZigbeeAccessory {
  private service!: Service;

  protected registerEvents() {
    // No events of interest
  }

  protected resolveServices(): Service[] {
    this.service = new OutletServiceBuilder(this).withOnOff().build();
    return [this.service];
  }
}
