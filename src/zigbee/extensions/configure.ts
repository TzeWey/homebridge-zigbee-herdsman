import { types } from 'util';
import { DeviceJoinedPayload } from 'zigbee-herdsman/dist/controller/events';
import { getConfigureKey } from 'zigbee-herdsman-converters';

import { objectHasProperty } from '../../utils/utils';
import { Events, Endpoint, ZigbeeEntity, ZigbeeDevice } from '..';

import { Extension } from './extension';

export class ExtensionConfigure extends Extension {
  private readonly configuring = new Set();
  private readonly attempts = new Map<string, number>();
  private coordinatorEndpoint!: Endpoint;

  public async start(): Promise<void> {
    this.registerEventHandler(Events.started, this.onStarted.bind(this));
    this.registerEventHandler(Events.deviceJoined, this.onDeviceJoined.bind(this));
    this.registerEventHandler(Events.message, this.onMessage.bind(this));
  }

  private async onStarted(): Promise<void> {
    this.coordinatorEndpoint = this.zigbee.firstCoordinatorEndpoint();

    for (const device of this.zigbee.getClients()) {
      const entity = this.zigbee.resolveEntity(device);

      if (!entity || !(entity instanceof ZigbeeDevice)) {
        return;
      }

      if (this.shouldConfigure(entity, Events.started)) {
        await this.configure(entity);
      }
    }
  }

  private async onDeviceJoined(data: DeviceJoinedPayload, entity: ZigbeeEntity): Promise<void> {
    const device = data.device;
    const meta = device.meta;

    if (objectHasProperty(meta, 'configured')) {
      delete meta.configured;
      data.device.save();
    }

    if (!entity || !(entity instanceof ZigbeeDevice)) {
      return;
    }

    if (this.shouldConfigure(entity, Events.deviceJoined)) {
      await this.configure(entity);
    }
  }

  private async onMessage(_, entity: ZigbeeEntity) {
    if (!entity || !(entity instanceof ZigbeeDevice)) {
      return false;
    }

    if (this.shouldConfigure(entity, Events.message)) {
      await this.configure(entity);
    }
  }

  private shouldConfigure(entity: ZigbeeDevice, event: Events) {
    if (!entity || !entity.definition || !entity.definition.configure) {
      return false;
    }

    const meta = entity.zh.meta;
    if (meta && objectHasProperty(meta, 'configured') && meta.configured === getConfigureKey(entity.definition)) {
      return false;
    }

    if (entity.zh.interviewing === true) {
      return false;
    }

    // Only configure end devices when a message is received, otherwise it will likely fails as they are sleeping.
    if (entity.zh.type === 'EndDevice' && event !== Events.message) {
      return false;
    }

    return true;
  }

  private async configure(entity: ZigbeeDevice) {
    const entityName = entity.name;
    const entityDescription = entity.definition?.description;
    const device = entity.zh;
    const ieeeAddr = device.ieeeAddr;

    // Check to satisfy compiler warning, 'configure' is already verified by 'shouldConfigure'
    if (!entity.definition?.configure) {
      return false;
    }

    if (this.configuring.has(ieeeAddr) || this.attempts[ieeeAddr] >= 3) {
      return false;
    }

    this.configuring.add(ieeeAddr);

    if (!this.attempts.has(ieeeAddr)) {
      this.attempts[ieeeAddr] = 0;
    }

    try {
      this.log.info(`Configure: Configuring '${entityName}' [${entityDescription}]`);
      await entity.definition.configure(device, this.coordinatorEndpoint, this.log);
      device.meta.configured = getConfigureKey(entity.definition);
      this.log.info(`Configure: Successfully configured '${entityName}' [${entityDescription}]`);
      device.save();
    } catch (error) {
      this.attempts[ieeeAddr]++;
      const attempt = this.attempts[ieeeAddr];

      if (types.isNativeError(error)) {
        const msg = `Configure: Failed to configure '${entityName}' [${entityDescription}], attempt ${attempt} (${error.stack})`;
        this.log.error(msg);
      }
    }

    this.configuring.delete(ieeeAddr);
  }
}
