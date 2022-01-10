import { Service } from 'homebridge';
import { ZigbeeAccessory } from '..';
import { ProgrammableSwitchServiceBuilder, BatteryServiceBuilder } from '../../builders';

export class IkeaOnOffSwitch extends ZigbeeAccessory {
  private switchServiceOn!: Service;
  private switchServiceOff!: Service;
  private switchBattery!: Service;

  protected registerEvents() {
    // No events of interest
  }

  private eventTranslation(state: unknown) {
    const eventState = state as { click: string };
    return eventState.click || null;
  }

  protected resolveServices(): Service[] {
    const Characteristic = this.platform.Characteristic;
    const ProgrammableSwitchEvent = Characteristic.ProgrammableSwitchEvent;

    this.switchServiceOn = new ProgrammableSwitchServiceBuilder(this)
      .withStatelessSwitch('ON', 'on', 1, this.eventTranslation, [
        { event: 'on', action: ProgrammableSwitchEvent.SINGLE_PRESS },
        { event: 'brightness_up', action: ProgrammableSwitchEvent.LONG_PRESS },
      ])
      .build();

    this.switchServiceOff = new ProgrammableSwitchServiceBuilder(this)
      .withStatelessSwitch('OFF', 'off', 2, this.eventTranslation, [
        { event: 'off', action: ProgrammableSwitchEvent.SINGLE_PRESS },
        { event: 'brightness_down', action: ProgrammableSwitchEvent.LONG_PRESS },
      ])
      .build();

    this.switchBattery = new BatteryServiceBuilder(this).build();

    return [this.switchServiceOn, this.switchServiceOff, this.switchBattery];
  }
}
