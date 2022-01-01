import { EventEmitter } from 'events';
import { Controller } from 'zigbee-herdsman';
import stringify from 'json-stable-stringify-without-jsonify';
import { findByDevice } from 'zigbee-herdsman-converters';
import {
  Events as HerdsmanEvents,
  MessagePayload,
  DeviceJoinedPayload,
  DeviceInterviewPayload,
  DeviceAnnouncePayload,
  DeviceLeavePayload,
} from 'zigbee-herdsman/dist/controller/events';

import { PluginPlatform } from '../platform';

import { ZigbeeConfig, Events, ZigbeeDevice, Endpoint, Device } from './types';

import { ZigbeeConfigure, ZigbeeOnEvent, ZigbeePing, ZigbeeOtaUpdate } from './extensions';

export class Zigbee extends EventEmitter {
  private readonly herdsman: Controller;
  private readonly log = this.platform.log;

  private readonly zigbeeConfigure: ZigbeeConfigure;
  private readonly zigbeeOnEvent: ZigbeeOnEvent;
  private readonly zigbeePing: ZigbeePing;
  private readonly zigbeeOtaUpdate: ZigbeeOtaUpdate;

  private deviceLookup: { [s: string]: ZigbeeDevice } = {};

  constructor(private readonly platform: PluginPlatform, private readonly config: ZigbeeConfig) {
    super();
    this.herdsman = new Controller({
      network: {
        panID: this.config.panID,
        extendedPanID: this.config.extendedPanID,
        channelList: [this.config.channel],
        networkKey: this.config.networkKey,
      },
      databasePath: this.config.databasePath,
      databaseBackupPath: this.config.databasePath + '.backup',
      backupPath: this.config.coordinatorBackupPath,
      serialPort: {
        baudRate: 115200,
        rtscts: false,
        path: this.config.port,
        adapter: 'zstack',
      },
      adapter: {
        concurrent: 16,
        disableLED: config.disableLED,
      },
      acceptJoiningDeviceHandler: (ieeeAddr) => this.acceptJoiningDeviceHandler(ieeeAddr),
    });

    // Initialize extensions
    this.zigbeeConfigure = new ZigbeeConfigure(platform, this);
    this.zigbeeOnEvent = new ZigbeeOnEvent(platform, this);
    this.zigbeePing = new ZigbeePing(platform, this);
    this.zigbeeOtaUpdate = new ZigbeeOtaUpdate(platform, this);
  }

  async start() {
    this.log.info('Starting zigbee-herdsman...');

    try {
      await this.herdsman.start();
    } catch (error) {
      this.log.error('Error while starting zigbee-herdsman');
      throw error;
    }

    this.log.info(`Coordinator firmware version: '${stringify(await this.getCoordinatorVersion())}'`);
    this.log.debug(`Zigbee network parameters: ${stringify(await this.getNetworkParameters())}`);

    this.herdsman.on(HerdsmanEvents.adapterDisconnected, () => this.emit(Events.adapterDisconnected));
    this.herdsman.on(HerdsmanEvents.deviceAnnounce, this.onZigbeeDeviceAnnounce.bind(this));
    this.herdsman.on(HerdsmanEvents.deviceInterview, this.onZigbeeDeviceInterview.bind(this));
    this.herdsman.on(HerdsmanEvents.deviceJoined, this.onZigbeeDeviceJoined.bind(this));
    this.herdsman.on(HerdsmanEvents.deviceLeave, this.onZigbeeDeviceLeave.bind(this));
    this.herdsman.on(HerdsmanEvents.message, this.onZigbeeMessage.bind(this));
    this.log.debug('Registered zigbee-herdsman event handlers');

    // Check if we have to set a transmit power
    if (this.config.transmitPower) {
      await this.herdsman.setTransmitPower(this.config.transmitPower);
      this.log.info(`Set transmit power to '${this.config.transmitPower}'`);
    }

    this.log.info('zigbee-herdsman started');
    this.emit(Events.started);
  }

  async stop() {
    this.emit(Events.stop);
    await this.herdsman.stop();
    this.log.info('zigbee-herdsman stopped');
  }

  /**
   * Internal Event Handlers
   */
  private async onZigbeeMessage(data: MessagePayload) {
    const name = data.device && data.device.ieeeAddr;
    const entity = this.resolveEntity(data.device);
    this.log.debug(
      `Received Zigbee message from '${name}', type '${data.type}', cluster '${data.cluster}'` +
        `, data '${stringify(data.data)}' from endpoint ${data.endpoint.ID}` +
        (data.groupID ? ` with groupID ${data.groupID}` : ''),
    );
    this.emit(Events.message, data, entity);
  }

  private async onZigbeeDeviceJoined(data: DeviceJoinedPayload) {
    const name = data.device && data.device.ieeeAddr;
    this.log.info(`Device '${name}' joined`);
  }

  private async onZigbeeDeviceInterview(data: DeviceInterviewPayload) {
    const name = data.device && data.device.ieeeAddr;
    const entity = this.resolveEntity(data.device);

    if (!entity) {
      return;
    }

    // Can only interview a Zigbee Device
    if (!(entity instanceof ZigbeeDevice)) {
      return;
    }

    switch (data.status) {
      case 'successful':
        this.log.info(`Successfully interviewed '${name}', device has successfully been paired`);
        if (entity.definition) {
          const { vendor, description, model } = entity.definition;
          this.log.info(`Device '${name}' is supported, identified as: ${vendor} ${description} (${model})`);
          this.emit(Events.deviceJoined, data, entity);
        } else {
          this.log.warn(
            `Device '${name}' with Zigbee model '${data.device.modelID}' is NOT supported, ` +
              'please follow https://www.zigbee2mqtt.io/how_tos/how_to_support_new_devices.html',
          );
        }
        break;

      case 'failed':
        this.log.error(`Failed to interview '${name}', device paring was NOT successful`);
        break;

      case 'started':
        this.log.info(`Starting interview of '${name}'`);
        break;

      default:
        this.log.error('Unknown DeviceInterview status!');
        break;
    }

    this.emit(Events.deviceInterview, data, entity);
  }

  private async onZigbeeDeviceAnnounce(data: DeviceAnnouncePayload) {
    const name = data.device && data.device.ieeeAddr;
    const entity = this.resolveEntity(data.device);
    this.log.info(`Device '${name}' announced itself`);
    this.emit(Events.deviceAnnounce, data, entity);
  }

  private async onZigbeeDeviceLeave(data: DeviceLeavePayload) {
    const ieeeAddr = data.ieeeAddr;
    const entity = this.resolveEntity(ieeeAddr);
    this.log.info(`Device '${ieeeAddr}' left the network`);
    this.emit(Events.deviceLeave, data, entity);
  }

  /**
   * Public Functions
   */
  async acceptJoiningDeviceHandler(ieeeAddr: string) {
    this.log.info(`Accepting joining whitelisted device '${ieeeAddr}'`);
    return true;
  }

  async getCoordinatorVersion() {
    return this.herdsman.getCoordinatorVersion();
  }

  async getNetworkParameters() {
    return this.herdsman.getNetworkParameters();
  }

  async reset(type: 'soft' | 'hard') {
    await this.herdsman.reset(type);
  }

  async permitJoin(permit: boolean, device?: ZigbeeDevice, time?: number) {
    let logEntityName = '';

    if (permit && device) {
      logEntityName = ` via ${device.name}`;
      await this.herdsman.permitJoin(permit, device.zh, time);
    } else {
      await this.herdsman.permitJoin(permit, undefined, time);
    }

    permit
      ? this.log.info(`* New devices are allowed to join${logEntityName}`)
      : this.log.info(`* New devices are NOT allowed to join${logEntityName}`);
  }

  async getPermitJoin() {
    return this.herdsman.getPermitJoin();
  }

  getClients() {
    return this.herdsman.getDevices().filter((device) => device.type !== 'Coordinator');
  }

  getDevices() {
    return this.herdsman.getDevices();
  }

  private resolveDevice(ieeeAddr: string): ZigbeeDevice | null {
    if (!this.deviceLookup[ieeeAddr]) {
      const deviceFound = this.herdsman.getDeviceByIeeeAddr(ieeeAddr);
      if (deviceFound) {
        this.deviceLookup[ieeeAddr] = new ZigbeeDevice(deviceFound);
      }
    }

    const device = this.deviceLookup[ieeeAddr];
    if (device && !device.zh.isDeleted) {
      return device;
    }

    return null;
  }

  /**
   * @param {string} key
   */
  resolveEntity(key: string | number | Device): ZigbeeDevice | null {
    if (typeof key === 'object') {
      return this.resolveDevice(key.ieeeAddr);
    } else if (typeof key === 'string' && key.toLowerCase() === 'coordinator') {
      return this.resolveDevice(this.herdsman.getDevicesByType('Coordinator')[0].ieeeAddr);
    } else {
      this.log.warn('Failed to resolve entity: ', key);
      return null;
    }
  }

  firstCoordinatorEndpoint(): Endpoint {
    return this.herdsman.getDevicesByType('Coordinator')[0].endpoints[0];
  }
}
