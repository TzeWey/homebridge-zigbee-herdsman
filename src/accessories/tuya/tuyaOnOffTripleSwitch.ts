import { Service } from 'homebridge';
import { ZigbeeAccessory } from '..';
import { ProgrammableSwitchServiceBuilder, BatteryServiceBuilder } from '../../builders';

export class TuyaOnOffTripleSwitch extends ZigbeeAccessory {
  private switchServiceButton1!: Service;
  private switchServiceButton2!: Service;
  private switchServiceButton3!: Service;
  private batteryService!: Service;

  protected registerEvents(): void {
    // No events of interest
  }

  protected resolveServices(): Service[] {
    const ProgrammableSwitchEvent = this.platform.Characteristic.ProgrammableSwitchEvent;

    this.switchServiceButton1 = new ProgrammableSwitchServiceBuilder(this)
      .withStatelessSwitch('Button 1', 'button_1', 1, [
        { click: '1_single', action: ProgrammableSwitchEvent.SINGLE_PRESS },
        { click: '1_double', action: ProgrammableSwitchEvent.DOUBLE_PRESS },
        { click: '1_hold', action: ProgrammableSwitchEvent.LONG_PRESS },
      ])
      .build();

    this.switchServiceButton2 = new ProgrammableSwitchServiceBuilder(this)
      .withStatelessSwitch('Button 2', 'button_2', 2, [
        { click: '2_single', action: ProgrammableSwitchEvent.SINGLE_PRESS },
        { click: '2_double', action: ProgrammableSwitchEvent.DOUBLE_PRESS },
        { click: '2_hold', action: ProgrammableSwitchEvent.LONG_PRESS },
      ])
      .build();

    this.switchServiceButton3 = new ProgrammableSwitchServiceBuilder(this)
      .withStatelessSwitch('Button 3', 'button_3', 3, [
        { click: '3_single', action: ProgrammableSwitchEvent.SINGLE_PRESS },
        { click: '3_double', action: ProgrammableSwitchEvent.DOUBLE_PRESS },
        { click: '3_hold', action: ProgrammableSwitchEvent.LONG_PRESS },
      ])
      .build();

    this.batteryService = new BatteryServiceBuilder(this).build();

    return [this.switchServiceButton1, this.switchServiceButton2, this.switchServiceButton3, this.batteryService];
  }
}
