import { Logger } from 'homebridge';

import { Endpoint, Device, Group } from '../zh';

export interface KeyValue {
  [s: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface ToZigbeeConverterGetMeta {
  message?: KeyValue;
  mapped?: Definition | Definition[];
}

export interface FromZigbeeConverter {
  cluster: string;
  type: string[] | string;
  convert: (
    model: Definition,
    message: KeyValue,
    publish: (payload: KeyValue) => void,
    options: KeyValue,
    meta: { state: KeyValue; logger: Logger; device: Device },
  ) => Promise<KeyValue>;
}

export interface ToZigbeeConverterResult {
  state: KeyValue;
  membersState: { [s: string]: KeyValue };
  readAfterWriteTime?: number;
}

export interface ToZigbeeConverter {
  key: string[];
  convertGet?: (entity: Endpoint | Group, key: string, meta: ToZigbeeConverterGetMeta) => Promise<void>;
  convertSet?: (
    entity: Endpoint | Group,
    key: string,
    value: KeyValue | string | number,
    meta: { state: KeyValue },
  ) => Promise<ToZigbeeConverterResult>;
}

interface DefinitionExposeFeature {
  name: string;
  endpoint?: string;
  property: string;
  value_max?: number;
  value_min?: number;
  unit?: string;
  value_off?: string;
  value_on?: string;
  value_step?: number;
  values: string[];
  access: number;
}

interface DefinitionExpose {
  type: string;
  name?: string;
  features?: DefinitionExposeFeature[];
  endpoint?: string;
  values?: string[];
  value_off?: string;
  value_on?: string;
  access: number;
  property: string;
  unit?: string;
  value_min?: number;
  value_max?: number;
}

export interface Definition {
  model: string;
  zigbeeModel: string[];
  endpoint?: (device: Device) => { [s: string]: number };
  toZigbee: ToZigbeeConverter[];
  fromZigbee: FromZigbeeConverter[];
  icon?: string;
  description: string;
  options: DefinitionExpose[];
  vendor: string;
  exposes: DefinitionExpose[];
  configure?: (device: Device, coordinatorEndpoint: Endpoint, logger: Logger) => Promise<void>;
  onEvent?: (type: string, data: KeyValue, device: Device, settings: KeyValue) => Promise<void>;
  ota?: {
    isUpdateAvailable: (device: Device, logger: Logger, data?: KeyValue) => Promise<boolean>;
    updateToLatest: (
      device: Device,
      logger: Logger,
      onProgress: (progress: number, remaining: number) => void,
    ) => Promise<void>;
  };
}
