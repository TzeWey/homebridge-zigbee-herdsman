import { types } from 'util';
import { DeviceJoinedPayload } from 'zigbee-herdsman/dist/controller/events';
import { getConfigureKey } from 'zigbee-herdsman-converters';

import { Zigbee } from '../zigbee';
import { ZigbeeEntity, Endpoint, Events } from '../types';
import { ZigbeeHerdsmanPlatform } from '../../platform';

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
      if (this.shouldConfigure(resolvedEntity, Events.started)) {
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

    if (this.shouldConfigure(resolvedEntity, Events.deviceJoined)) {
      this.configure(resolvedEntity);
    }
  }

  onMessage(_, resolvedEntity: ZigbeeEntity) {
    if (this.shouldConfigure(resolvedEntity, Events.message)) {
      this.configure(resolvedEntity);
    }
  }

  shouldConfigure(resolvedEntity: ZigbeeEntity, event: Events) {
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
      meta.configured === getConfigureKey(resolvedEntity.definition)
    ) {
      return false;
    }

    if (resolvedEntity.device.interviewing === true) {
      return false;
    }

    // Only configure end devices when a message is received, otherwise it will likely fails as they are sleeping.
    if (resolvedEntity.device.type === 'EndDevice' && event !== Events.message) {
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

    const entityName = resolvedEntity.name;
    if (!resolvedEntity.definition) {
      this.log.error(`Failed to configure '${entityName}', entity has no definition!`);
      return false;
    }

    const entityDescription = resolvedEntity.definition.description;
    if (!resolvedEntity.definition.configure) {
      this.log.error(
        `Failed to configure '${entityName}' [${entityDescription}], entity definition has no method 'configure'`,
      );
      return false;
    }

    try {
      this.log.info(`Configuring '${entityName}' [${entityDescription}]`);
      await resolvedEntity.definition.configure(device, this.coordinatorEndpoint);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (<any>device).meta.configured = getConfigureKey(resolvedEntity.definition);
      this.log.info(`Successfully configured '${entityName}' [${entityDescription}]`);
      device.save();
    } catch (error) {
      this.attempts[ieeeAddr]++;
      const attempt = this.attempts[ieeeAddr];

      if (types.isNativeError(error)){
        const msg = `Failed to configure '${entityName}' [${entityDescription}], attempt ${attempt} (${error.stack})`;
        this.log.error(msg);
      }

      if (throwError) {
        throw error;
      }
    }

    this.configuring.delete(ieeeAddr);
  }
}
