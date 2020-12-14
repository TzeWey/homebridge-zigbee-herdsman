import { ZigbeeHerdsmanPlatform } from '../../platform';
import { MessagePayload } from 'zigbee-herdsman/dist/controller/events';
import * as zigbeeHerdsmanConverters from 'zigbee-herdsman-converters';

import { Zigbee } from '../zigbee';
import { ZigbeeDefinition, ZigbeeEntity, Events, Device } from '../types';

export class ZigbeePing {
  // Pingable end devices, some end devices should be pinged
  // e.g. E11-G13 https://github.com/Koenkk/zigbee2mqtt/issues/775#issuecomment-453683846
  PINGABLE_END_DEVICES = [
    zigbeeHerdsmanConverters.devices.find((d) => d.model === 'E11-G13'),
    zigbeeHerdsmanConverters.devices.find((d) => d.model === '53170161'),
  ];

  private log = this.platform.log;
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly states = new Map<string, boolean>();
  private pollInterval = 60 * 60 * 1000;

  constructor(private readonly platform: ZigbeeHerdsmanPlatform, private readonly zigbee: Zigbee) {
    this.zigbee.on(Events.started, this.onStarted.bind(this));
    this.zigbee.on(Events.stop, this.onStop.bind(this));
    this.zigbee.on(Events.message, this.onMessage.bind(this));
    this.log.info(`Registered extension '${this.constructor.name}'`);
  }

  onStarted() {
    for (const device of this.zigbee.getClients()) {
      if (this.isPingable(device)) {
        this.setTimerPingable(device);
      }
    }
  }

  onStop() {
    this.timers.forEach((timer) => {
      clearTimeout(timer);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onMessage(data: MessagePayload, resolvedEntity: ZigbeeEntity) {
    const device = data.device;
    if (!device) {
      return;
    }

    if (this.isPingable(device)) {
      // When a zigbee message from a device is received we know the device is still alive.
      // => reset the timer.
      this.setTimerPingable(device);
    }
  }

  async handleIntervalPingable(device: Device) {
    // When a device is already unavailable, log the ping failed on 'debug' instead of 'error'.
    const resolvedEntity = this.zigbee.resolveEntity(device);
    if (!resolvedEntity) {
      this.log.debug(`Stop pinging '${device.ieeeAddr}', device is not known anymore`);
      return;
    }

    try {
      await device.ping();
      this.log.debug(`Successfully pinged '${resolvedEntity.name}'`);
    } catch (error) {
      this.log.error(`Failed to ping '${resolvedEntity.name}'`);
    } finally {
      this.setTimerPingable(device);
    }
  }

  private setTimerPingable(device: Device) {
    clearTimeout(this.timers[device.ieeeAddr]);
    this.timers[device.ieeeAddr] = setTimeout(async () => {
      await this.handleIntervalPingable(device);
    }, this.pollInterval);
  }

  private isPingable(device: Device) {
    if (this.PINGABLE_END_DEVICES.find((d: ZigbeeDefinition) => d && d.zigbeeModel.includes(device.modelID))) {
      return true;
    }

    // Device is a mains powered router
    return device.type === 'Router' && device.powerSource !== 'Battery';
  }
}
