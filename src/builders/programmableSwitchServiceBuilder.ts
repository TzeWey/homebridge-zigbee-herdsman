import {
  CharacteristicValue,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
} from 'homebridge';

import { ZigbeeAccessory, Events } from '../accessories';
import { ServiceBuilder } from './serviceBuilder';

export type ProgrammableSwitchClickAction = { click: string; action: number };

export class ProgrammableSwitchServiceBuilder extends ServiceBuilder {
  constructor(protected readonly zigbeeAccessory: ZigbeeAccessory) {
    super(zigbeeAccessory);
  }

  withStatelessSwitch(
    displayName: string,
    subType: string,
    index: number,
    actions?: ProgrammableSwitchClickAction[],
  ): ProgrammableSwitchServiceBuilder {
    const StatelessProgrammableSwitch = this.platform.Service.StatelessProgrammableSwitch;
    const Characteristic = this.platform.Characteristic;

    this.service =
      this.platformAccessory.getServiceById(StatelessProgrammableSwitch, subType) ||
      this.platformAccessory.addService(StatelessProgrammableSwitch, displayName, subType);

    this.service
      .setCharacteristic(Characteristic.Name, displayName)
      .setCharacteristic(Characteristic.ServiceLabelIndex, index);

    const eventActionMap = new Map<string, number>();

    if (actions && actions.length > 0) {
      const supportedActions = actions.map((action) => action.action);
      this.service.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setProps({
        validValues: supportedActions,
      });

      actions.forEach((action) => {
        eventActionMap.set(action.click, action.action);
      });
    }

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { click?: string }) => {
      this.debugState('DEBUG Click state', state);

      if (!state.click) {
        return;
      }

      this.debugState('Click', state.click);

      if (!eventActionMap.has(state.click)) {
        this.log.warn(`Unhandled click event: '${state.click}'`);
      }

      const action = eventActionMap[state.click];
      this.service.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setValue(action);
    });

    return this;
  }

  /**
   * untested, no stateUpdate event handling, most probably doesn't work, no accessory handlers
   */
  withStatefulSwitch(displayName: string, subType: string, index: number): ProgrammableSwitchServiceBuilder {
    const Characteristic = this.platform.Characteristic;
    this.service =
      this.platformAccessory.getServiceById(this.platform.Service.StatefulProgrammableSwitch, subType) ||
      this.platformAccessory.addService(this.platform.Service.StatefulProgrammableSwitch, displayName, subType);

    this.service
      .setCharacteristic(Characteristic.Name, displayName)
      .setCharacteristic(Characteristic.ServiceLabelIndex, index)
      .setCharacteristic(Characteristic.ProgrammableSwitchOutputState, 0);

    let buttonState = false;
    this.service
      .getCharacteristic(Characteristic.ProgrammableSwitchOutputState)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        buttonState = !buttonState;
        callback(null, buttonState ? 1 : 0);
      })
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        callback(null, buttonState ? 1 : 0);
      });

    return this;
  }
}
