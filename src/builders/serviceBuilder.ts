import { Logger, Service, PlatformAccessory } from 'homebridge';
import { PluginPlatform } from '../platform';
import { ZigbeeAccessory } from '../accessories';

export abstract class ServiceBuilder {
  protected readonly platform: PluginPlatform = this.zigbeeAccessory.platform;
  protected readonly platformAccessory: PlatformAccessory = this.zigbeeAccessory.accessory;
  protected readonly log: Logger = this.platform.log;
  protected service!: Service;

  protected constructor(protected readonly zigbeeAccessory: ZigbeeAccessory) {}

  public build(): Service {
    return this.service;
  }

  /**
   * Public Common Functions
   */
  public async setOn(on: boolean) {
    return this.zigbeeAccessory.setDeviceState({ state: on ? 'ON' : 'OFF' });
  }

  public async getOnOffState(): Promise<void> {
    await this.zigbeeAccessory.getDeviceState({ state: 'ON' });
  }

  public async setBrightness(brightness: number) {
    return this.zigbeeAccessory.setDeviceState({ brightness });
  }

  public async getBrightness(): Promise<void> {
    await this.zigbeeAccessory.getDeviceState({ brightness: 0 });
  }

  public async setColorTemperature(colorTemperature: number) {
    return this.zigbeeAccessory.setDeviceState({ color_temp: colorTemperature });
  }

  public async getColorTemperature(): Promise<void> {
    await this.zigbeeAccessory.getDeviceState({ color_temp: 0 });
  }

  public async setHue(hue: number) {
    return this.zigbeeAccessory.setDeviceState({ color: { hue } });
  }

  public async getHue(): Promise<void> {
    await this.zigbeeAccessory.getDeviceState({ color: { hue: 0 } });
  }

  public async setColorXY(x: number, y: number) {
    return this.zigbeeAccessory.setDeviceState({ color: { x, y } });
  }

  public async getColorXY(): Promise<void> {
    await this.zigbeeAccessory.getDeviceState({ color: { x: 0, y: 0 } });
  }

  public async setColorRGB(r: number, g: number, b: number) {
    return this.zigbeeAccessory.setDeviceState({ color: { rgb: `${r},${g},${b}` } });
  }

  public async setSaturation(saturation: number) {
    return this.zigbeeAccessory.setDeviceState({ color: { s: saturation } });
  }

  public async getSaturation(): Promise<void> {
    await this.zigbeeAccessory.getDeviceState({ color: { s: 0 } });
  }

  protected debugState(name: string, value: unknown) {
    const displayName = `${this.zigbeeAccessory.ID}:${this.zigbeeAccessory.name}`;
    this.log.info(`[${displayName}] ${this.constructor.name}: ${name}:`, value);
  }
}
