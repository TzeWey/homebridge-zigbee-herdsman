import { Logger } from 'homebridge';
import Device from 'zigbee-herdsman/dist/controller/model/device';
import Endpoint from 'zigbee-herdsman/dist/controller/model/endpoint';
import Group from 'zigbee-herdsman/dist/controller/model/group';
import { MessagePayload } from 'zigbee-herdsman/dist/controller/events';
import { Zcl } from 'zigbee-herdsman';

export { Device, Endpoint, Group };
export { DeviceType } from 'zigbee-herdsman/dist/controller/tstype';

export enum Events {
  started = 'started',
  stop = 'stop',

  // Events from zigbee-herdsman/dist/controller/events
  message = 'message',
  adapterDisconnected = 'adapterDisconnected',
  deviceJoined = 'deviceJoined',
  deviceInterview = 'deviceInterview',
  deviceAnnounce = 'deviceAnnounce',
  deviceLeave = 'deviceLeave',
}

export interface ZigbeeConfig {
  port: string;
  disableLED: boolean;

  panID: number;
  extendedPanID: number[];
  channel: number;
  networkKey: number[];
  transmitPower?: number;

  databasePath: string;
  coordinatorBackupPath: string;
}

export interface Options {
  manufacturerCode?: number;
  disableDefaultResponse?: boolean;
  disableResponse?: boolean;
  timeout?: number;
  direction?: Zcl.Direction;
  srcEndpoint?: number;
  reservedBits?: number;
  transactionSequenceNumber?: number;
}

export interface Meta {
  endpoint_name?: string;
  options?: Options;
  message?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  logger?: Logger;
  device: Device;
  mapped?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  state?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface ToConverter {
  key: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  convertSet?: (entity: Endpoint, key: string, value: any, meta: Meta) => Promise<any>;
  convertGet?: (entity: Endpoint, key: string, meta?: Meta) => Promise<void>;
}

export interface FromConverter {
  cluster: string;
  type: string | string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  convert: (model, message: MessagePayload, publish: (...args) => void, options: any, meta: Meta) => Partial<any>;
}

export interface MetaBattery {
  voltageToPercentage?: string;
  dontDividePercentage?: boolean;
}

export interface Meta {
  turnsOffAtBrightness1?: boolean;
  supportsHueAndSaturation?: boolean;
  configureKey?: number;
  disableDefaultResponse?: boolean;
  applyRedFix?: boolean;
  enhancedHue?: boolean;
  multiEndpoint?: boolean;
  timeout?: number;
  battery?: MetaBattery;
}

export interface ZigbeeDefinition {
  zigbeeModel: string[];
  model: string;
  vendor: string;
  description: string;
  supports?: string;
  fromZigbee: FromConverter[];
  toZigbee: ToConverter[];
  meta?: Partial<Meta>;
  configure?: (device: Device, coordinatorEndpoint: Endpoint) => Promise<void>;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface ZigbeeEntity {
  type: 'device' | 'coordinator';
  device?: Device;
  group?: Group;
  endpoint?: Endpoint;
  name: string;
  definition?: ZigbeeDefinition;
  settings?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
