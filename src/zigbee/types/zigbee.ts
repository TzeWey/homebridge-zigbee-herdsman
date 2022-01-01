import { Logger } from 'homebridge';
import { Zcl } from 'zigbee-herdsman';

import { Device } from './zh';
import { KeyValue, ToZigbeeConverterGetMeta } from './zhc';

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

export type DeviceSettings = KeyValue;
export type GroupSettings = KeyValue;

export interface Meta extends ToZigbeeConverterGetMeta {
  endpoint_name?: string;
  options?: Options;
  logger?: Logger;
  device: Device;
  state?: KeyValue;
}

export interface ConvertOptions {
  occupancy_timeout?: number;
}
