import { PlatformAccessory } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from '../../settings';
import {
  Zigbee,
  Events,
  MessagePayload,
  DeviceJoinedPayload,
  DeviceLeavePayload,
  Device,
  ZigbeeDevice,
  ZigbeeEntity,
} from '..';
import { ZigbeeAccessory, ZigbeeAccessoryResolver, ZigbeeAccessoryFactory } from '../../accessories';

import { Extension } from './extension';
import { PluginPlatform } from '../../platform';

export class ExtensionHomebridge extends Extension {
  private readonly zigbeeAccessories = new Map<string, ZigbeeAccessory>();
  private readonly zigbeeAccessoryResolver: ZigbeeAccessoryResolver;

  constructor(platform: PluginPlatform, zigbee: Zigbee) {
    super(platform, zigbee);
    this.zigbeeAccessoryResolver = new ZigbeeAccessoryResolver(platform);
  }

  public async start(): Promise<void> {
    this.registerEventHandler(Events.adapterDisconnected, this.onZigbeeAdapterDisconnected.bind(this));
    this.registerEventHandler(Events.message, this.onZigbeeMessage.bind(this));
    this.registerEventHandler(Events.started, this.onZigbeeStarted.bind(this));
    this.registerEventHandler(Events.deviceJoined, this.onZigbeeDeviceJoined.bind(this));
    this.registerEventHandler(Events.deviceLeave, this.onZigbeeDeviceLeave.bind(this));
  }

  /**********************************
   * Private Routines
   **********************************/

  /**
   * Removes any cached devices that are not found in the adapter database.
   * Effectively making the Zigbee database the source of truth.
   */
  private cleanupDevices() {
    const removed: string[] = [];
    const zigbeeDevices = this.zigbee.getDevices();
    const uuids = zigbeeDevices.map((e) => this.platform.api.hap.uuid.generate(e.ieeeAddr));

    this.log.info('Homebridge: Cleaning up any stale accessories...');
    this.platform.accessories.forEach((cachedAccessory) => {
      if (!uuids.includes(cachedAccessory.UUID)) {
        this.log.info('Homebridge: Removing existing accessory from cache: ', cachedAccessory.displayName);
        this.platform.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [cachedAccessory]);
        removed.push(cachedAccessory.UUID);
      }
    });

    removed.forEach((uuid) => this.platform.accessories.delete(uuid));
  }

  private async configureDevice(device: Device, entity: ZigbeeEntity) {
    // Do not associate Coordinators with accessories
    if (device.type === 'Coordinator') {
      return;
    }

    const factory = this.zigbeeAccessoryResolver.getFactory(device);
    if (!factory) {
      this.log.warn('Homebridge: Unrecognized device: ', device);
      return;
    }

    const uuid = this.platform.api.hap.uuid.generate(device.ieeeAddr);
    this.log.info(`Homebridge: Initializing device ${device.ieeeAddr} [${uuid}]`);

    const accessory = this.platform.accessories.get(uuid);
    if (accessory) {
      this.addExistingAccessory(uuid, device, accessory, factory);
    } else {
      this.addNewAccessory(uuid, device, entity, factory);
    }
  }

  /**
   * Updates an existing accessory in the cache with any new changes
   * @param uuid
   * @param device
   * @param accessory
   * @param factory
   */
  private addExistingAccessory(
    uuid: string,
    device: Device,
    accessory: PlatformAccessory,
    factory: ZigbeeAccessoryFactory,
  ) {
    const zigbeeAccessory = new factory(this.platform, accessory, device);
    this.zigbeeAccessories.set(uuid, zigbeeAccessory);
    this.log.info(
      'Homebridge: > Restoring existing accessory from cache: ',
      zigbeeAccessory.vendor,
      zigbeeAccessory.description,
    );
    this.platform.api.updatePlatformAccessories([accessory]);
  }

  /**
   * Creates a new accessory and links the accessory to the platform
   * @param uuid
   * @param device
   * @param entity
   * @param factory
   */
  private addNewAccessory(uuid: string, device: Device, entity: ZigbeeEntity, factory: ZigbeeAccessoryFactory) {
    const newEntity = entity || this.zigbee.resolveEntity(device);
    const displayName = newEntity?.definition?.description || device.modelID || device.ieeeAddr;
    const newAccessory = new this.platform.api.platformAccessory(displayName, uuid);
    const zigbeeAccessory = new factory(this.platform, newAccessory, device);
    this.zigbeeAccessories.set(uuid, zigbeeAccessory);
    this.log.info('Homebridge: > Registering new accessory: ', zigbeeAccessory.vendor, zigbeeAccessory.description);
    this.platform.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [newAccessory]);
    this.platform.accessories.set(newAccessory.UUID, newAccessory);
  }

  /**
   * Get the ZigbeeAccessory associated with the ZigbeeEntity
   * @param entity
   * @returns the ZigbeeAccessory instance
   */
  private getZigbeeAccessory(entity: ZigbeeEntity): ZigbeeAccessory | null {
    if (!(entity instanceof ZigbeeDevice)) {
      return null;
    }

    const uuid = this.platform.api.hap.uuid.generate(entity.ieeeAddr);
    const zigbeeAccessory = this.zigbeeAccessories.get(uuid);

    if (!zigbeeAccessory) {
      this.log.debug(`Homebridge: Could not find accessory '${uuid}' [${entity.ieeeAddr}]`);
      return null;
    }

    return zigbeeAccessory;
  }

  /**********************************
   * Internal Event Handlers
   **********************************/
  private async onZigbeeStarted() {
    this.cleanupDevices();

    for (const device of this.zigbee.getClients()) {
      const entity = this.zigbee.resolveEntity(device);
      if (entity && entity instanceof ZigbeeDevice) {
        this.configureDevice(device, entity);
      }
    }
  }

  private async onZigbeeAdapterDisconnected() {
    this.log.warn('Homebridge: Adapter disconnected, stopping platform: ', this.platform.config.name);
    await this.stop();
  }

  private async onZigbeeDeviceJoined(data: DeviceJoinedPayload, entity: ZigbeeEntity) {
    this.configureDevice(data.device, entity);
  }

  private async onZigbeeDeviceLeave(data: DeviceLeavePayload) {
    const ieeeAddr = data.ieeeAddr;
    const uuid = this.platform.api.hap.uuid.generate(ieeeAddr);
    const existingAccessory = this.platform.accessories.get(uuid);
    if (existingAccessory) {
      this.log.info('Homebridge: Removing accessory from cache: ', existingAccessory.displayName);
      this.platform.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
      this.platform.accessories.delete(uuid);
    }
  }

  private async onZigbeeMessage(data: MessagePayload, entity: ZigbeeEntity) {
    const zigbeeAccessory = this.getZigbeeAccessory(entity);
    if (zigbeeAccessory === null) {
      this.log.warn(`Homebridge: > ZigbeeAccessory instance for '${entity.ID}' not found`);
    }
    await zigbeeAccessory?.processMessage(data);
  }
}
