import { MessagePayload } from 'zigbee-herdsman/dist/controller/events';
import { onEvent as LegacyOnEvent } from 'zigbee-herdsman-converters';

import { ZigbeeEntity, Events, ZigbeeDevice } from '..';

import { Extension } from './extension';

export class ExtensionOnEvent extends Extension {
  public async start(): Promise<void> {
    this.registerEventHandler(Events.started, this.onStarted.bind(this));
    this.registerEventHandler(Events.stop, this.onStop.bind(this));
    this.registerEventHandler(Events.message, this.onMessage.bind(this));
    this.registerEventHandler(Events.adapterDisconnected, this.onAdapterDisconnected.bind(this));
    this.registerEventHandler(Events.deviceJoined, this.onDeviceJoined.bind(this));
    this.registerEventHandler(Events.deviceInterview, this.onDeviceInterview.bind(this));
    this.registerEventHandler(Events.deviceAnnounce, this.onDeviceAnnounce.bind(this));
    this.registerEventHandler(Events.deviceLeave, this.onDeviceLeave.bind(this));
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
