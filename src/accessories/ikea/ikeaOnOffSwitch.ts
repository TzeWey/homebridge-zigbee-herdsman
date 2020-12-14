import { Service } from 'homebridge';
import { ZigbeeAccessory } from '../zigbeeAccessory';
import { ProgrammableSwitchServiceBuilder, BatteryServiceBuilder } from '../../builders';

export class IkeaOnOffSwitch extends ZigbeeAccessory {
  private switchServiceOn!: Service;
  private switchServiceOff!: Service;
  private switchBattery!: Service;

  protected resolveServices(): Service[] {
    const Characteristic = this.platform.Characteristic;
    const ProgrammableSwitchEvent = Characteristic.ProgrammableSwitchEvent;

    const switchBuilder = new ProgrammableSwitchServiceBuilder(this);
    const battBuilder = new BatteryServiceBuilder(this);

    this.switchServiceOn = switchBuilder
      .withStatelessSwitch('ON', 'on', 1, [ProgrammableSwitchEvent.SINGLE_PRESS, ProgrammableSwitchEvent.LONG_PRESS])
      .build();

    this.switchServiceOff = switchBuilder
      .withStatelessSwitch('OFF', 'off', 2, [ProgrammableSwitchEvent.SINGLE_PRESS, ProgrammableSwitchEvent.LONG_PRESS])
      .build();

    this.switchBattery = battBuilder.build();

    return [this.switchServiceOn, this.switchServiceOff, this.switchBattery];
  }

  protected async onStateUpdate(state: { click: 'brightness_up' | 'brightness_down' | 'on' | 'off' }) {
    const Characteristic = this.platform.Characteristic;
    const ProgrammableSwitchEvent = Characteristic.ProgrammableSwitchEvent;

    switch (state.click) {
      case 'brightness_up':
        this.switchServiceOn.getCharacteristic(ProgrammableSwitchEvent).setValue(ProgrammableSwitchEvent.LONG_PRESS);
        break;
      case 'brightness_down':
        this.switchServiceOff.getCharacteristic(ProgrammableSwitchEvent).setValue(ProgrammableSwitchEvent.LONG_PRESS);
        break;
      case 'on':
        this.switchServiceOn.getCharacteristic(ProgrammableSwitchEvent).setValue(ProgrammableSwitchEvent.SINGLE_PRESS);
        break;
      case 'off':
        this.switchServiceOff.getCharacteristic(ProgrammableSwitchEvent).setValue(ProgrammableSwitchEvent.SINGLE_PRESS);
        break;
    }
  }

  protected async onIdentify() {
    // do nothing
  }
}
