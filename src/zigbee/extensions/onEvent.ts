import { ZigbeeHerdsmanPlatform } from '../../platform';
import { MessagePayload } from 'zigbee-herdsman/dist/controller/events';

import { Zigbee } from '../zigbee';
import { ZigbeeEntity, Events } from '../types';

export class ZigbeeOnEvent {
  private log = this.platform.log;

  constructor(private readonly platform: ZigbeeHerdsmanPlatform, private readonly zigbee: Zigbee) {
    this.zigbee.on(Events.started, this.onStarted.bind(this));
    this.zigbee.on(Events.stop, this.onStop.bind(this));
    this.zigbee.on(Events.message, this.onMessage.bind(this));
    this.log.info(`Registered extension '${this.constructor.name}'`);
  }

  onStarted() {
    for (const device of this.zigbee.getClients()) {
      const resolvedEntity = this.zigbee.resolveEntity(device);
      this.callOnEvent(resolvedEntity, 'start', {});
    }
  }

  onStop() {
    for (const device of this.zigbee.getClients()) {
      const resolvedEntity = this.zigbee.resolveEntity(device);
      this.callOnEvent(resolvedEntity, 'stop', {});
    }
  }

  onMessage(data: MessagePayload, resolvedEntity: ZigbeeEntity) {
    if (resolvedEntity && resolvedEntity.type === 'device') {
      this.callOnEvent(resolvedEntity, Events.message, data);
    }
  }

  callOnEvent(resolvedEntity: ZigbeeEntity, type: Events | 'stop' | 'start', data: Partial<MessagePayload>) {
    if (resolvedEntity.definition && resolvedEntity.definition.onEvent) {
      resolvedEntity.definition.onEvent(type, data, resolvedEntity.device, resolvedEntity.settings);
    }
  }
}
