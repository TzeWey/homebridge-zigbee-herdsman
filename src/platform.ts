import {
  API,
  APIEvent,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import * as path from 'path';
import retry from 'async-retry';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Zigbee, ZigbeeEntity, Events, MessagePayload } from './zigbee';
import { ZigbeeAccessory, ZigbeeAccessoryResolver } from './accessories';

interface ZigbeeHerdsmanPlatformConfig extends PlatformConfig {
  port?: string;
  panID?: number;
  channel?: number;
  disableLED?: boolean;
  permitJoin?: boolean;
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ZigbeeHerdsmanPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  private readonly accessories = new Map<string, PlatformAccessory>();
  private readonly zigbeeAccessories = new Map<string, ZigbeeAccessory>();

  public readonly zigbee: Zigbee;
  public readonly zigbeeAccessoryResolver: ZigbeeAccessoryResolver;

  constructor(
    public readonly log: Logger,
    public readonly config: ZigbeeHerdsmanPlatformConfig,
    public readonly api: API,
  ) {
    const databasePath = path.join(this.api.user.storagePath(), 'database.db');
    const coordinatorBackupPath = path.join(this.api.user.storagePath(), 'coordinator.json');
    this.zigbee = new Zigbee(this, {
      port: config.port || '',
      panID: config.panID || 13662,
      channel: config.channel || 11,
      disableLED: config.disableLED || false,
      extendedPanID: [0xdd, 0xdd, 0xdd, 0xdd, 0xdd, 0xdd, 0xdd, 0xdd],
      networkKey: [0x01, 0x03, 0x05, 0x07, 0x09, 0x0b, 0x0d, 0x0f, 0x00, 0x02, 0x04, 0x06, 0x08, 0x0a, 0x0c, 0x0d],
      databasePath,
      coordinatorBackupPath,
    });

    this.zigbeeAccessoryResolver = new ZigbeeAccessoryResolver(this);

    this.zigbee.on(Events.adapterDisconnected, this.onZigbeeAdapterDisconnected.bind(this));
    this.zigbee.on(Events.message, this.onZigbeeMessage.bind(this));

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, this.start.bind(this));
    this.api.on(APIEvent.SHUTDOWN, this.stop.bind(this));

    this.log.debug('Finished initializing platform:', this.config.name);
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory);
  }

  private async start() {
    try {
      await retry(
        async () => {
          await this.zigbee.start();
        },
        {
          retries: 10,
          minTimeout: 1000,
          maxTimeout: 8000,
          onRetry: () => this.log.info('Retrying connect to ZigBee adapter'),
        },
      );
    } catch (error) {
      this.log.error('Zigbee Start:', error);
    }
    this.cleanupDevices();
    this.configureDevices();
    this.log.info('Started platform:', this.config.name);

    await this.zigbee.permitJoin(this.config.permitJoin || false);
  }

  private async stop() {
    await this.zigbee.stop();
    this.log.info('Stopped platform:', this.config.name);
  }

  private async onZigbeeAdapterDisconnected() {
    this.log.error('Adapter disconnected, stopping Zigbee');
    await this.stop();
  }

  private async onZigbeeMessage(data: MessagePayload, resolvedEntity: ZigbeeEntity) {
    const device = resolvedEntity.device;
    if (!device) {
      return;
    }

    const uuid = this.api.hap.uuid.generate(device.ieeeAddr);
    const zigbeeAccessory = this.zigbeeAccessories.get(uuid);
    if (!zigbeeAccessory) {
      this.log.debug(`could not find accessory ${uuid} [${device.ieeeAddr}]`);
      return;
    }

    await zigbeeAccessory.processMessage(data);
  }

  /**
   * We use the Zigbee database as the source of truth, this routine will remove
   * cached devices which are not longer found in the adapter database
   */
  private cleanupDevices() {
    const removed: string[] = [];
    const zigbeeDevices = this.zigbee.getDevices();
    const uuids = zigbeeDevices.map((e) => this.api.hap.uuid.generate(e.ieeeAddr));

    this.accessories.forEach((cachedAccessory) => {
      if (!uuids.includes(cachedAccessory.UUID)) {
        this.log.info('Removing existing accessory from cache:', cachedAccessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [cachedAccessory]);
        removed.push(cachedAccessory.UUID);
      }
    });

    removed.forEach((uuid) => this.accessories.delete(uuid));
  }

  private async configureDevices() {
    // Loop through each known Zigbee Device
    this.zigbee.getDevices().forEach((device) => {
      // Do not associate Coordinators with accessories
      if (device.type === 'Coordinator') {
        return;
      }

      const uuid = this.api.hap.uuid.generate(device.ieeeAddr);
      this.log.info(`Initializing device ${device.ieeeAddr} [${uuid}]`);

      const ZigbeeAccessory = this.zigbeeAccessoryResolver.getAccessoryClass(device);
      if (!ZigbeeAccessory) {
        this.log.warn('Unrecognized device:', device);
        return;
      }

      const existingAccessory = this.accessories.get(uuid);
      if (existingAccessory) {
        // Update accessory cache with any changes to the accessory details and information
        const zigbeeAccessory = new ZigbeeAccessory(this, existingAccessory, device);
        this.zigbeeAccessories.set(uuid, zigbeeAccessory);
        this.log.info(
          '> Restoring existing accessory from cache:',
          zigbeeAccessory.vendor,
          zigbeeAccessory.description,
        );
        this.api.updatePlatformAccessories([existingAccessory]);
      } else {
        // Create a new accessory and link the accessory to the platform
        const zigbeeEntity = this.zigbee.resolveEntity(device);
        const displayName = zigbeeEntity?.definition?.description || device.modelID || device.ieeeAddr;
        const newAccessory = new this.api.platformAccessory(displayName, uuid);
        const zigbeeAccessory = new ZigbeeAccessory(this, newAccessory, device);
        this.zigbeeAccessories.set(uuid, zigbeeAccessory);
        this.log.info('> Adding new accessory:', zigbeeAccessory.vendor, zigbeeAccessory.description);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [newAccessory]);
      }
    });
  }
}
