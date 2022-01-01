import {
  CharacteristicValue,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
} from 'homebridge';

import { ZigbeeAccessory } from '../accessories';
import { ServiceBuilder } from './serviceBuilder';

export class ProgrammableSwitchServiceBuilder extends ServiceBuilder {
  constructor(protected readonly zigbeeAccessory: ZigbeeAccessory) {
    super(zigbeeAccessory);
  }

  withStatelessSwitch(
    displayName: string,
    subType: string,
    index: number,
    supportedActions?: number[],
  ): ProgrammableSwitchServiceBuilder {
    this.service =
      this.platformAccessory.getServiceById(this.platform.Service.StatelessProgrammableSwitch, subType) ||
      this.platformAccessory.addService(this.platform.Service.StatelessProgrammableSwitch, displayName, subType);

    this.service
      .setCharacteristic(this.platform.Characteristic.Name, displayName)
      .setCharacteristic(this.platform.Characteristic.ServiceLabelIndex, index);

    if (supportedActions && supportedActions.length) {
      this.service.getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent).setProps({
        validValues: supportedActions,
      });
    }

    return this;
  }

  withStatefulSwitch(displayName: string, subType: string, index: number): ProgrammableSwitchServiceBuilder {
    const Characteristic = this.platform.Characteristic;
    this.service =
      this.platformAccessory.getServiceById(this.platform.Service.StatefulProgrammableSwitch, subType) ||
      this.platformAccessory.addService(this.platform.Service.StatefulProgrammableSwitch, displayName, subType);

    this.service
      .setCharacteristic(Characteristic.Name, displayName)
      .setCharacteristic(Characteristic.ServiceLabelIndex, index)
      .setCharacteristic(Characteristic.ProgrammableSwitchOutputState, 0);

    let btnState = false;
    this.service
      .getCharacteristic(Characteristic.ProgrammableSwitchOutputState)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        btnState = !btnState;
        callback(null, btnState ? 1 : 0);
      })
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        callback(null, btnState ? 1 : 0);
      });

    return this;
  }
}
