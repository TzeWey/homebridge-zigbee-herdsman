import { ZigbeeHerdsmanPlatform } from '../../platform';
import { MessagePayload } from 'zigbee-herdsman/dist/controller/events';
import { tradfri } from 'zigbee-herdsman-converters/lib/ota';

import { Zigbee } from '../zigbee';
import { ZigbeeEntity, Events } from '../types';

export class ZigbeeOtaUpdate {
  private log = this.platform.log;
  private inProgress = new Set();
  private lastChecked: Map<string, Date> = new Map(); // eslint-disable-line @typescript-eslint/no-explicit-any

  private ota_ikea_ota_use_test_url = true;
  private ota_disable_automatic_update_check = false;
  private ota_update_check_interval = 1440; // 1 day

  constructor(private readonly platform: ZigbeeHerdsmanPlatform, private readonly zigbee: Zigbee) {
    this.zigbee.on(Events.message, this.onMessage.bind(this));
    this.log.info(`Registered extension '${this.constructor.name}'`);

    if (this.ota_ikea_ota_use_test_url) {
      tradfri.useTestURL();
      this.log.info('Using IKEA test URL');
    }
  }

  private async onMessage(data: MessagePayload, resolvedEntity: ZigbeeEntity) {
    if (this.ota_disable_automatic_update_check) {
      return;
    }

    if (data.type !== 'commandQueryNextImageRequest' || !resolvedEntity || !resolvedEntity.definition) {
      return;
    }

    const definition = resolvedEntity.definition;
    const supportsOTA = Object.prototype.hasOwnProperty.call(definition, 'ota');

    if (supportsOTA) {
      // When a device does a next image request, it will usually do it a few times after each other
      // with only 10 - 60 seconds in between. It doesn't make sense to check for a new update
      // each time, so this interval can be set by the user. The default is 1,440 minutes (one day).
      const updateCheckInterval = this.ota_update_check_interval * 1000 * 60;
      const check = this.lastChecked.has(data.device.ieeeAddr)
        ? Date.now() - this.lastChecked[data.device.ieeeAddr] > updateCheckInterval
        : true;
      if (!check || this.inProgress.has(data.device.ieeeAddr)) {
        return;
      }

      this.lastChecked[data.device.ieeeAddr] = Date.now();
      const available = await definition.ota.isUpdateAvailable(data.device, this.log, data.data);

      if (available) {
        this.log.info(`Update available for '${resolvedEntity.name}'`);
      }
    }

    // Respond to the OTA request:
    // - In case we don't support OTA: respond with NO_IMAGE_AVAILABLE (0x98) (so the client stops requesting OTAs)
    // - In case we do support OTA: respond with ABORT (0x95) as we don't want to update now.
    const endpoint = data.device.endpoints.find((e) => e.supportsOutputCluster('genOta'));
    if (endpoint) {
      const response = { status: supportsOTA ? 0x95 : 0x98 };
      // Some devices send OTA requests without defining OTA cluster as input cluster.
      this.log.info(`Responding to device '${resolvedEntity.name}' OTA request with `, response);
      await endpoint.commandResponse('genOta', 'queryNextImageResponse', response);
    }
  }
}
