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

import { Zigbee, Events } from './zigbee';

interface PluginPlatformConfig extends PlatformConfig {
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
export class PluginPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly zigbee: Zigbee;

  constructor(public readonly log: Logger, public readonly config: PluginPlatformConfig, public readonly api: API) {
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

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, this.start.bind(this));
    this.api.on(APIEvent.SHUTDOWN, this.stop.bind(this));

    this.log.debug('Finished initializing platform: ', this.config.name);
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.zigbee.emit(Events.configureAccessory, accessory);
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
          onRetry: () => this.log.info('Reattempt connect to ZigBee adapter'),
        },
      );
    } catch (error) {
      this.log.error('Failed to connect to ZigBee adapter: ', error);
      await this.zigbee.stop();
      throw error;
    }
    this.log.info('Started platform: ', this.config.name);

    await this.zigbee.permitJoin(this.config.permitJoin || false);
  }

  private async stop() {
    await this.zigbee.stop();
    this.log.info('Stopped platform: ', this.config.name);
  }
}
