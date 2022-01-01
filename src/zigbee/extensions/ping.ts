import { MessagePayload } from 'zigbee-herdsman/dist/controller/events';
import * as zhc from 'zigbee-herdsman-converters';

import { Definition, ZigbeeEntity, Events, Device } from '..';

import { Extension } from './extension';

export class ExtensionPing extends Extension {
  // Pingable end devices, some end devices should be pinged
  // e.g. E11-G13 https://github.com/Koenkk/zigbee2mqtt/issues/775#issuecomment-453683846
  PINGABLE_END_DEVICES = [
    zhc.devices.find((d) => d.model === 'E11-G13'),
    zhc.devices.find((d) => d.model === 'E11-N1EA'),
    zhc.devices.find((d) => d.model === '53170161'),
  ];

  private readonly timers = new Map<string, NodeJS.Timeout>();
  private pollInterval = 60 * 60 * 1000;

  public async start(): Promise<void> {
    this.registerEventHandler(Events.started, this.onStarted.bind(this));
    this.registerEventHandler(Events.stop, this.onStop.bind(this));
    this.registerEventHandler(Events.message, this.onMessage.bind(this));
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
  onMessage(data: MessagePayload, entity: ZigbeeEntity) {
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
    const entity = this.zigbee.resolveEntity(device);
    if (!entity) {
      this.log.debug(`Ping: Stop pinging '${device.ieeeAddr}', device is not known anymore`);
      return;
    }

    try {
      await device.ping();
      this.log.debug(`Ping: Successfully pinged '${entity.name}'`);
    } catch (error) {
      this.log.error(`Ping: Failed to ping '${entity.name}'`);
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
    if (this.PINGABLE_END_DEVICES.find((d: Definition) => d && d.zigbeeModel.includes(device.modelID))) {
      return true;
    }

    // Device is a mains powered router
    return device.type === 'Router' && device.powerSource !== 'Battery';
  }
}
