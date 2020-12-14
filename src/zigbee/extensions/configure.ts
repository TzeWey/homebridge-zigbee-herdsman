import { ZigbeeHerdsmanPlatform } from '../../platform';
import { DeviceJoinedPayload } from 'zigbee-herdsman/dist/controller/events';

import { Zigbee } from '../zigbee';
import { ZigbeeEntity, Endpoint, Events } from '../types';

export class ZigbeeConfigure {
  private log = this.platform.log;
  private readonly configuring = new Set();
  private readonly attempts = new Map<string, number>();
  private coordinatorEndpoint!: Endpoint;

  constructor(private readonly platform: ZigbeeHerdsmanPlatform, private readonly zigbee: Zigbee) {
    this.zigbee.on(Events.started, this.onStarted.bind(this));
    this.zigbee.on(Events.deviceJoined, this.onDeviceJoined.bind(this));
    this.zigbee.on(Events.message, this.onMessage.bind(this));
    this.log.info(`Registered extension '${this.constructor.name}'`);
  }

  async onStarted() {
    this.coordinatorEndpoint = this.zigbee.getDevicesByType('Coordinator')[0].getEndpoint(1);

    for (const device of this.zigbee.getClients()) {
      const resolvedEntity = this.zigbee.resolveEntity(device);
      if (this.shouldConfigure(resolvedEntity)) {
        await this.configure(resolvedEntity);
      }
    }
  }

  onDeviceJoined(data: DeviceJoinedPayload, resolvedEntity: ZigbeeEntity) {
    const device = data.device;
    const meta = (<any>device).meta; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (Object.prototype.hasOwnProperty.call(meta, 'configured')) {
      delete meta.configured;
      data.device.save();
    }

    if (this.shouldConfigure(resolvedEntity)) {
      this.configure(resolvedEntity);
    }
  }

  onMessage(_, resolvedEntity: ZigbeeEntity) {
    if (this.shouldConfigure(resolvedEntity)) {
      this.configure(resolvedEntity);
    }
  }

  shouldConfigure(resolvedEntity: ZigbeeEntity) {
    if (!resolvedEntity || !resolvedEntity.definition || !resolvedEntity.definition.configure) {
      return false;
    }

    if (!resolvedEntity.device) {
      return false;
    }

    const meta = (<any>resolvedEntity.device).meta; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (
      meta &&
      Object.prototype.hasOwnProperty.call(meta, 'configured') &&
      meta.configured === resolvedEntity.definition?.meta?.configureKey
    ) {
      return false;
    }

    if (resolvedEntity.device?.interviewing === true) {
      return false;
    }

    return true;
  }

  async configure(resolvedEntity: ZigbeeEntity, force = false, throwError = false) {
    const device = resolvedEntity.device;
    if (!device) {
      return false;
    }

    const ieeeAddr = device.ieeeAddr;
    if (this.configuring.has(ieeeAddr) || (this.attempts[ieeeAddr] >= 3 && !force)) {
      return false;
    }

    this.configuring.add(ieeeAddr);

    if (!this.attempts.has(ieeeAddr)) {
      this.attempts[ieeeAddr] = 0;
    }

    this.log.info(`Configuring '${resolvedEntity.name}'`);

    if (!resolvedEntity.definition) {
      this.log.error('Resolved entity has no definition!');
      return false;
    }

    if (!resolvedEntity.definition.configure) {
      this.log.error('Resolved entity definition has no configure!');
      return false;
    }

    try {
      await resolvedEntity.definition.configure(device, this.coordinatorEndpoint);
      this.log.info(`Successfully configured '${resolvedEntity.name}'`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (<any>device).meta.configured = resolvedEntity.definition.meta?.configureKey;
      device.save();
    } catch (error) {
      this.attempts[ieeeAddr]++;
      const attempt = this.attempts[ieeeAddr];
      const msg = `Failed to configure '${resolvedEntity.name}', attempt ${attempt} (${error.stack})`;
      this.log.error(msg);

      if (throwError) {
        throw error;
      }
    }

    this.configuring.delete(ieeeAddr);
  }
}
