import { MessagePayload } from 'zigbee-herdsman/dist/controller/events';
import { tradfri } from 'zigbee-herdsman-converters/lib/ota';

import { ZigbeeEntity, Events, ZigbeeDevice } from '..';

import { Extension } from './extension';

export class ExtensionOtaUpdate extends Extension {
  private inProgress = new Set();
  private lastChecked: Map<string, Date> = new Map();

  private ota_ikea_ota_use_test_url = true;
  private ota_disable_automatic_update_check = false;
  private ota_update_check_interval = 1440; // 1 day

  public async start(): Promise<void> {
    this.registerEventHandler(Events.message, this.onMessage.bind(this));

    if (this.ota_ikea_ota_use_test_url) {
      tradfri.useTestURL();
      this.log.info('Using IKEA test URL');
    }
  }

  private async onMessage(data: MessagePayload, entity: ZigbeeEntity) {
    if (this.ota_disable_automatic_update_check) {
      return;
    }

    if (
      data.type !== 'commandQueryNextImageRequest' ||
      !entity ||
      !(entity instanceof ZigbeeDevice) ||
      !entity.definition
    ) {
      return;
    }

    const definition = entity.definition;
    const ota = definition.ota;

    if (ota) {
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
      const available = await ota.isUpdateAvailable(data.device, this.log, data.data);

      if (available) {
        this.log.info(`Update available for '${entity.name}'`);
      }
    }

    // Respond to the OTA request:
    // - In case we don't support OTA: respond with NO_IMAGE_AVAILABLE (0x98) (so the client stops requesting OTAs)
    // - In case we do support OTA: respond with ABORT (0x95) as we don't want to update now.
    const endpoint = data.device.endpoints.find((e) => e.supportsOutputCluster('genOta'));
    if (endpoint) {
      const response = { status: ota ? 0x95 : 0x98 };
      // Some devices send OTA requests without defining OTA cluster as input cluster.
      this.log.info(`Responding to device '${entity.name}' OTA request with`, response);
      await endpoint.commandResponse('genOta', 'queryNextImageResponse', response);
    }
  }
}
