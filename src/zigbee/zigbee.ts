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

import { ZigbeeHerdsmanPlatform } from '../platform';

import { ZigbeeConfig, ZigbeeEntity, ZigbeeDefinition, Device, DeviceType, Group, Events } from './types';
import { ZigbeeConfigure, ZigbeeOnEvent, ZigbeePing } from './extensions';

export class Zigbee extends EventEmitter {
  private readonly herdsman: Controller;
  private readonly log = this.platform.log;

  private readonly zigbeeConfigure: ZigbeeConfigure;
  private readonly zigbeeOnEvent: ZigbeeOnEvent;
  private readonly zigbeePing: ZigbeePing;

  constructor(private readonly platform: ZigbeeHerdsmanPlatform, private readonly config: ZigbeeConfig) {
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
      },
      acceptJoiningDeviceHandler: (ieeeAddr) => this.acceptJoiningDeviceHandler(ieeeAddr),
    });

    // Initialize extensions
    this.zigbeeConfigure = new ZigbeeConfigure(platform, this);
    this.zigbeeOnEvent = new ZigbeeOnEvent(platform, this);
    this.zigbeePing = new ZigbeePing(platform, this);
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

    // Check if we have to turn off the led
    if (this.config.disableLED) {
      await this.herdsman.setLED(false);
    }

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
    const resolvedEntity = this.resolveEntity(data.device);
    this.log.debug(
      `Received Zigbee message from '${name}', type '${data.type}', cluster '${data.cluster}'` +
        `, data '${stringify(data.data)}' from endpoint ${data.endpoint.ID}` +
        (data.groupID ? ` with groupID ${data.groupID}` : ''),
    );
    this.emit(Events.message, data, resolvedEntity);
  }

  private async onZigbeeDeviceJoined(data: DeviceJoinedPayload) {
    const name = data.device && data.device.ieeeAddr;
    const resolvedEntity = this.resolveEntity(data.device);
    this.log.info(`Device '${name}' joined`);
    this.emit(Events.deviceJoined, data, resolvedEntity);
  }

  private async onZigbeeDeviceInterview(data: DeviceInterviewPayload) {
    const name = data.device && data.device.ieeeAddr;
    const resolvedEntity = this.resolveEntity(data.device);

    switch (data.status) {
      case 'successful':
        this.log.info(`Successfully interviewed '${name}', device has successfully been paired`);
        if (resolvedEntity.definition) {
          const { vendor, description, model } = resolvedEntity.definition;
          this.log.info(`Device '${name}' is supported, identified as: ${vendor} ${description} (${model})`);
        } else {
          this.log.warn(
            `Device '${name}' with Zigbee model '${data.device.modelID}' is NOT supported, ` +
              'please follow https://www.zigbee2mqtt.io/how_tos/how_to_support_new_devices.html',
          );
        }
        break;

      case 'failed':
        this.log.error(`Failed to interview '${name}', device has not successfully been paired`);
        break;

      case 'started':
        this.log.info(`Starting interview of '${name}'`);
        break;

      default:
        this.log.error('Unknown DeviceInterview status!');
        break;
    }

    this.emit(Events.deviceInterview, data, resolvedEntity);
  }

  private async onZigbeeDeviceAnnounce(data: DeviceAnnouncePayload) {
    const name = data.device && data.device.ieeeAddr;
    const resolvedEntity = this.resolveEntity(data.device);
    this.log.info(`Device '${name}' announced itself`);
    this.emit(Events.deviceAnnounce, data, resolvedEntity);
  }

  private async onZigbeeDeviceLeave(data: DeviceLeavePayload) {
    const ieeeAddr = data.ieeeAddr;
    const resolvedEntity = this.resolveEntity(ieeeAddr);
    this.log.info(`Device '${ieeeAddr}' left the network`);
    this.emit(Events.deviceLeave, data, resolvedEntity);
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

  async permitJoin(permit: boolean, resolvedEntity?: ZigbeeEntity) {
    permit
      ? this.log.info(`Zigbee: allowing new devices to join${resolvedEntity ? ` via ${resolvedEntity.name}` : ''}.`)
      : this.log.info('Zigbee: disabling joining of new devices.');

    if (resolvedEntity && permit) {
      await this.herdsman.permitJoin(permit, resolvedEntity.device);
    } else {
      await this.herdsman.permitJoin(permit);
    }
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

  getDeviceByIeeeAddr(ieeeAddr: string) {
    return this.herdsman.getDeviceByIeeeAddr(ieeeAddr);
  }

  getDeviceByNetworkAddress(networkAddress: number) {
    return this.herdsman.getDeviceByNetworkAddress(networkAddress);
  }

  getDevicesByType(type: DeviceType): Device[] {
    return this.herdsman.getDevicesByType(type);
  }

  getGroupByID(ID: number) {
    return this.herdsman.getGroupByID(ID);
  }

  getGroups() {
    return this.herdsman.getGroups();
  }

  createGroup(groupID: number) {
    return this.herdsman.createGroup(groupID);
  }

  async touchlinkFactoryResetFirst() {
    return this.herdsman.touchlinkFactoryResetFirst();
  }

  async touchlinkFactoryReset(ieeeAddr: string, channel: number) {
    return this.herdsman.touchlinkFactoryReset(ieeeAddr, channel);
  }

  async touchlinkIdentify(ieeeAddr: string, channel: number) {
    await this.herdsman.touchlinkIdentify(ieeeAddr, channel);
  }

  async touchlinkScan() {
    return this.herdsman.touchlinkScan();
  }

  /**
   * @param {string} key
   * @return {object} {
   *      type: device | coordinator
   *      device|group: zigbee-herdsman entity
   *      endpoint: selected endpoint (only if type === device)
   *      settings: from configuration.yaml
   *      name: name of the entity
   *      definition: zigbee-herdsman-converters definition (only if type === device)
   * }
   */
  resolveEntity(key: string | number | Device | Group): ZigbeeEntity {
    if (key instanceof Device) {
      return {
        type: 'device',
        device: key,
        endpoint: key.endpoints[0],
        name: key.type === 'Coordinator' ? 'Coordinator' : key.ieeeAddr,
        definition: findByDevice(key) as ZigbeeDefinition,
      };
    }

    if (typeof key === 'string') {
      if (key.toLowerCase() === 'coordinator') {
        const coordinator = this.herdsman.getDevicesByType('Coordinator')[0];
        return {
          type: 'device',
          device: coordinator,
          endpoint: coordinator.getEndpoint(1),
          name: 'Coordinator',
        };
      }
    }

    this.log.warn('Failed to resolve entity: ', key);
    return null!;
  }
}
