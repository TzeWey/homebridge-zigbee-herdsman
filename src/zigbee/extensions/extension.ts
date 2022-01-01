import { Logger } from 'homebridge';
import { Events, Zigbee } from '..';

import { PluginPlatform } from '../../platform';

type EventListener = (...args: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
type EventHandler = [Events, EventListener];

export abstract class Extension {
  protected log: Logger;
  protected platform: PluginPlatform;
  protected zigbee: Zigbee;
  protected eventHandlers: Array<EventHandler>;

  /**
   * Initializes an Extension
   *
   * @param {PluginPlatform} platform Platform controller
   * @param {Zigbee} zigbee Zigbee controller
   */
  constructor(platform: PluginPlatform, zigbee: Zigbee) {
    this.platform = platform;
    this.zigbee = zigbee;
    this.log = platform.log;
    this.eventHandlers = new Array<EventHandler>();
  }

  public get name(): string {
    return this.constructor.name;
  }

  /**
   * Is called once the extension has to start
   */
  public abstract start(): Promise<void>;

  /**
   * Is called once the extension has to stop
   */
  public async stop(): Promise<void> {
    this.eventHandlers?.forEach(([event, handler]) => {
      this.zigbee.removeListener(event, handler);
    });
  }

  /**
   * Registers the event handler
   * @param handler The event handler callback
   * @returns The passed in handler
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected registerEventHandler(event: Events, listener: EventListener): void {
    this.eventHandlers.push([event, listener]);
    this.zigbee.on(event, listener);
  }
}
