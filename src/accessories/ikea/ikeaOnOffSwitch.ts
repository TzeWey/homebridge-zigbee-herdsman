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

  private eventTranslation(state: unknown): string {
    const eventState = state as { click: string };
    return eventState.click || 'unknown';
  }

  protected resolveServices(): Service[] {
    const Characteristic = this.platform.Characteristic;
    const ProgrammableSwitchEvent = Characteristic.ProgrammableSwitchEvent;

    const switchBuilder = new ProgrammableSwitchServiceBuilder(this);
    const battBuilder = new BatteryServiceBuilder(this);

    this.switchServiceOn = switchBuilder
      .withStatelessSwitch('ON', 'on', 1, this.eventTranslation, [
        { event: 'on', action: ProgrammableSwitchEvent.SINGLE_PRESS },
        { event: 'brightness_up', action: ProgrammableSwitchEvent.LONG_PRESS },
      ])
      .build();

    this.switchServiceOff = switchBuilder
      .withStatelessSwitch('OFF', 'off', 2, this.eventTranslation, [
        { event: 'off', action: ProgrammableSwitchEvent.SINGLE_PRESS },
        { event: 'brightness_down', action: ProgrammableSwitchEvent.LONG_PRESS },
      ])
      .build();

    this.switchBattery = battBuilder.build();

    return [this.switchServiceOn, this.switchServiceOff, this.switchBattery];
  }
}
