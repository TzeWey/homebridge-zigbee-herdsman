import { ZigbeeHerdsmanPlatform } from '../../platform';
import { MessagePayload } from 'zigbee-herdsman/dist/controller/events';
import { zigbeeHerdsmanConverters } from 'zigbee-herdsman-converters';

import { Zigbee } from '../zigbee';
import { ZigbeeEntity, Events } from '../types';

export class ZigbeeOnEvent {
  private log = this.platform.log;

  constructor(private readonly platform: ZigbeeHerdsmanPlatform, private readonly zigbee: Zigbee) {
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
      const resolvedEntity = this.zigbee.resolveEntity(device);
      this.callOnEvent(resolvedEntity, 'start', {});
    }
  }

  private onStop() {
    for (const device of this.zigbee.getClients()) {
      const resolvedEntity = this.zigbee.resolveEntity(device);
      this.callOnEvent(resolvedEntity, 'stop', {});
    }
  }

  private onMessage(data: MessagePayload, resolvedEntity: ZigbeeEntity) {
    this.onZigbeeEvent(Events.message, data, resolvedEntity);
  }

  private onAdapterDisconnected(data: MessagePayload, resolvedEntity: ZigbeeEntity) {
    this.onZigbeeEvent(Events.adapterDisconnected, data, resolvedEntity);
  }

  private onDeviceJoined(data: MessagePayload, resolvedEntity: ZigbeeEntity) {
    this.onZigbeeEvent(Events.deviceJoined, data, resolvedEntity);
  }

  private onDeviceInterview(data: MessagePayload, resolvedEntity: ZigbeeEntity) {
    this.onZigbeeEvent(Events.deviceInterview, data, resolvedEntity);
  }

  private onDeviceAnnounce(data: MessagePayload, resolvedEntity: ZigbeeEntity) {
    this.onZigbeeEvent(Events.deviceAnnounce, data, resolvedEntity);
  }

  private onDeviceLeave(data: MessagePayload, resolvedEntity: ZigbeeEntity) {
    this.onZigbeeEvent(Events.deviceLeave, data, resolvedEntity);
  }

  private onZigbeeEvent(type: Events, data: MessagePayload, resolvedEntity: ZigbeeEntity) {
    if (resolvedEntity && resolvedEntity.type === 'device') {
      this.callOnEvent(resolvedEntity, type, data);
    }
  }

  private callOnEvent(resolvedEntity: ZigbeeEntity, type: Events | 'stop' | 'start', data: Partial<MessagePayload>) {
    zigbeeHerdsmanConverters.onEvent(type, data, resolvedEntity.device, resolvedEntity.settings);

    if (resolvedEntity.definition && resolvedEntity.definition.onEvent) {
      resolvedEntity.definition.onEvent(type, data, resolvedEntity.device, resolvedEntity.settings);
    }
  }
}
