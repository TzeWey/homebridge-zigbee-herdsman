import { Service } from 'homebridge';
import { ZigbeeAccessory, Events } from '..';
import { LightbulbServiceBuilder } from '../../builders';

export class TerncySmartLightSocket extends ZigbeeAccessory {
  private service!: Service;

  protected registerEvents() {
    this.on(Events.stateUpdate, this.onStateUpdate.bind(this));
  }

  protected resolveServices(): Service[] {
    this.service = new LightbulbServiceBuilder(this).withOnOff().build();
    return [this.service];
  }

  private onStateUpdate(state: { state: 'ON' | 'OFF' }) {
    this.service.updateCharacteristic(this.platform.Characteristic.On, state.state === 'ON');
  }
}
