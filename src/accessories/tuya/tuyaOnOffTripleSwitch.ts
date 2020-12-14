import { Service } from 'homebridge';
import { ZigbeeAccessory } from '../zigbeeAccessory';
import { ProgrammableSwitchServiceBuilder, BatteryServiceBuilder } from '../../builders';

export class TuyaOnOffTripleSwitch extends ZigbeeAccessory {
  private switchServiceButton1!: Service;
  private switchServiceButton2!: Service;
  private switchServiceButton3!: Service;
  private batteryService!: Service;

  protected resolveServices(): Service[] {
    const ProgrammableSwitchEvent = this.platform.Characteristic.ProgrammableSwitchEvent;

    this.switchServiceButton1 = new ProgrammableSwitchServiceBuilder(this)
      .withStatelessSwitch('Button 1', 'button_1', 1, [
        ProgrammableSwitchEvent.SINGLE_PRESS,
        ProgrammableSwitchEvent.DOUBLE_PRESS,
        ProgrammableSwitchEvent.LONG_PRESS,
      ])
      .build();

    this.switchServiceButton2 = new ProgrammableSwitchServiceBuilder(this)
      .withStatelessSwitch('Button 2', 'button_2', 2, [
        ProgrammableSwitchEvent.SINGLE_PRESS,
        ProgrammableSwitchEvent.DOUBLE_PRESS,
        ProgrammableSwitchEvent.LONG_PRESS,
      ])
      .build();

    this.switchServiceButton3 = new ProgrammableSwitchServiceBuilder(this)
      .withStatelessSwitch('Button 3', 'button_3', 3, [
        ProgrammableSwitchEvent.SINGLE_PRESS,
        ProgrammableSwitchEvent.DOUBLE_PRESS,
        ProgrammableSwitchEvent.LONG_PRESS,
      ])
      .build();

    this.batteryService = new BatteryServiceBuilder(this).build();

    return [this.switchServiceButton1, this.switchServiceButton2, this.switchServiceButton3, this.batteryService];
  }

  protected async onStateUpdate(state: {
    action:
      | '1_single'
      | '1_double'
      | '1_hold'
      | '2_single'
      | '2_double'
      | '2_hold'
      | '3_single'
      | '3_double'
      | '3_hold';
  }) {
    const ProgrammableSwitchEvent = this.platform.Characteristic.ProgrammableSwitchEvent;

    switch (state.action) {
      case '1_single':
        this.switchServiceButton1
          .getCharacteristic(ProgrammableSwitchEvent)
          .setValue(ProgrammableSwitchEvent.SINGLE_PRESS);
        break;
      case '1_double':
        this.switchServiceButton1
          .getCharacteristic(ProgrammableSwitchEvent)
          .setValue(ProgrammableSwitchEvent.DOUBLE_PRESS);
        break;
      case '1_hold':
        this.switchServiceButton1
          .getCharacteristic(ProgrammableSwitchEvent)
          .setValue(ProgrammableSwitchEvent.LONG_PRESS);
        break;

      case '2_single':
        this.switchServiceButton2
          .getCharacteristic(ProgrammableSwitchEvent)
          .setValue(ProgrammableSwitchEvent.SINGLE_PRESS);
        break;
      case '2_double':
        this.switchServiceButton2
          .getCharacteristic(ProgrammableSwitchEvent)
          .setValue(ProgrammableSwitchEvent.DOUBLE_PRESS);
        break;
      case '2_hold':
        this.switchServiceButton2
          .getCharacteristic(ProgrammableSwitchEvent)
          .setValue(ProgrammableSwitchEvent.LONG_PRESS);
        break;

      case '3_single':
        this.switchServiceButton3
          .getCharacteristic(ProgrammableSwitchEvent)
          .setValue(ProgrammableSwitchEvent.SINGLE_PRESS);
        break;
      case '3_double':
        this.switchServiceButton3
          .getCharacteristic(ProgrammableSwitchEvent)
          .setValue(ProgrammableSwitchEvent.DOUBLE_PRESS);
        break;
      case '3_hold':
        this.switchServiceButton3
          .getCharacteristic(ProgrammableSwitchEvent)
          .setValue(ProgrammableSwitchEvent.LONG_PRESS);
        break;
    }
  }

  protected async onIdentify() {
    // do nothing
  }
}
