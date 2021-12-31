import { findByDevice } from 'zigbee-herdsman-converters';

import { Device, Endpoint } from './zh';
import { Definition } from './zhc';
import { DeviceSettings } from './zigbee';

export class ZigbeeDevice {
  /** The zigbee-herdsman device instance */
  public zh: Device;
  private _definition: Definition | undefined;

  constructor(device: Device) {
    this.zh = device;
  }

  get ieeeAddr(): string {
    return this.zh.ieeeAddr;
  }

  get ID(): string {
    return this.zh.ieeeAddr;
  }

  get settings(): DeviceSettings {
    return {};
  }

  get name(): string {
    return this.zh.type === 'Coordinator' ? 'Coordinator' : this.settings?.friendly_name || this.ieeeAddr;
  }

  get definition(): Definition | undefined {
    if (!this._definition && !this.zh.interviewing) {
      this._definition = findByDevice(this.zh);
    }
    return this._definition;
  }

  endpoint(key?: string | number): Endpoint | null {
    let endpoint: Endpoint;
    if (!key || key === '') {
      key = 'default';
    }

    if (!isNaN(Number(key))) {
      endpoint = this.zh.getEndpoint(Number(key));
    } else if (this.definition?.endpoint) {
      const ID = this.definition?.endpoint?.(this.zh)[key];
      if (ID) {
        endpoint = this.zh.getEndpoint(ID);
      } else if (key === 'default') {
        endpoint = this.zh.endpoints[0];
      } else {
        return null;
      }
    } else {
      if (key !== 'default') {
        return null;
      }
      endpoint = this.zh.endpoints[0];
    }

    return endpoint;
  }

  endpointName(endpoint: Endpoint): string {
    let name = '';
    if (this.definition?.endpoint) {
      const endpoints = this.definition.endpoint(this.zh);
      const endpointEntry = Object.entries(endpoints).find((e) => e[1] === endpoint.ID);
      if (endpointEntry) {
        name = endpointEntry[0];
      }
    }
    return name === 'default' ? '' : name;
  }

  isXiaomi(): boolean {
    const xiaomiManufacturerID = [4151, 4447];
    return (
      this.zh.modelID !== 'lumi.router' &&
      xiaomiManufacturerID.includes(this.zh.manufacturerID) &&
      (!this.zh.manufacturerName || !this.zh.manufacturerName.startsWith('Trust'))
    );
  }

  isIkeaTradfri(): boolean {
    return this.zh.manufacturerID === 4476;
  }

  isDevice(): boolean {
    return true;
  }

  isGroup(): boolean {
    return false;
  }
}
