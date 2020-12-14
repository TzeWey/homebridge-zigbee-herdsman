import { Service } from 'homebridge';
import { ZigbeeAccessory } from '../zigbeeAccessory';
import { OutletServiceBuilder } from '../../builders';

export class GenericOutlet extends ZigbeeAccessory {
  private service!: Service;

  protected resolveServices(): Service[] {
    this.service = new OutletServiceBuilder(this).withOnOff().build();
    return [this.service];
  }

  protected async onStateUpdate(state: { state: 'ON' | 'OFF' }) {
    this.service.updateCharacteristic(this.platform.Characteristic.On, state.state === 'ON');
  }

  protected async onIdentify() {
    // do nothing
  }
}
