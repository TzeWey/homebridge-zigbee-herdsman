import { PluginPlatform } from '../../platform';
import { MessagePayload } from 'zigbee-herdsman/dist/controller/events';
import { onEvent as LegacyOnEvent } from 'zigbee-herdsman-converters';

import { Zigbee, ZigbeeEntity, Events, ZigbeeDevice } from '..';

export class ZigbeeOnEvent {
  private log = this.platform.log;

  constructor(private readonly platform: PluginPlatform, private readonly zigbee: Zigbee) {
    this.zigbee.on(Events.started, this.onStarted.bind(this));
    this.zigbee.on(Events.stop, this.onStop.bind(this));
    this.zigbee.on(Events.message, this.onMessage.bind(this));
    this.zigbee.on(Events.adapterDisconnected, this.onAdapterDisconnected.bind(this));
    this.zigbee.on(Events.deviceJoined, this.onDeviceJoined.bind(this));
    this.zigbee.on(Events.deviceInterview, this.onDeviceInterview.bind(this));
    this.zigbee.on(Events.deviceAnnounce, this.onDeviceAnnounce.bind(this));
    this.zigbee.on(Events.deviceLeave, this.onDeviceLeave.bind(this));
    this.log.info(`Registered extension '${this.constructor.name}'`);
  }

  private onStarted() {
    for (const device of this.zigbee.getClients()) {
      const entity = this.zigbee.resolveEntity(device);
      if (entity) {
        this.callOnEvent(entity, 'start', {});
      }
    }
  }

  private onStop() {
    for (const device of this.zigbee.getClients()) {
      const entity = this.zigbee.resolveEntity(device);
      if (entity) {
        this.callOnEvent(entity, 'stop', {});
      }
    }
  }

  private onMessage(data: MessagePayload, entity: ZigbeeEntity) {
    this.onZigbeeEvent(Events.message, data, entity);
  }

  private onAdapterDisconnected(data: MessagePayload, entity: ZigbeeEntity) {
    this.onZigbeeEvent(Events.adapterDisconnected, data, entity);
  }

  private onDeviceJoined(data: MessagePayload, entity: ZigbeeEntity) {
    this.onZigbeeEvent(Events.deviceJoined, data, entity);
  }

  private onDeviceInterview(data: MessagePayload, entity: ZigbeeEntity) {
    this.onZigbeeEvent(Events.deviceInterview, data, entity);
  }

  private onDeviceAnnounce(data: MessagePayload, entity: ZigbeeEntity) {
    this.onZigbeeEvent(Events.deviceAnnounce, data, entity);
  }

  private onDeviceLeave(data: MessagePayload, entity: ZigbeeEntity) {
    this.onZigbeeEvent(Events.deviceLeave, data, entity);
  }

  private onZigbeeEvent(type: Events, data: MessagePayload, entity: ZigbeeEntity) {
    if (entity && entity instanceof ZigbeeDevice) {
      this.callOnEvent(entity, type, data);
    }
  }

  private callOnEvent(entity: ZigbeeEntity, type: Events | 'stop' | 'start', data: Partial<MessagePayload>) {
    LegacyOnEvent(type, data, entity.zh);

    if (entity instanceof ZigbeeDevice && entity.definition && entity.definition.onEvent) {
      entity.definition.onEvent(type, data, entity.zh, entity.settings);
    }
  }
}
