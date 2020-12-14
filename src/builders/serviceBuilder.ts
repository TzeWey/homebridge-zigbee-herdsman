import { Logger, Service, PlatformAccessory } from 'homebridge';
import { ZigbeeHerdsmanPlatform } from '../platform';
import { ZigbeeAccessory } from '../accessories';

export abstract class ServiceBuilder {
  protected readonly platform: ZigbeeHerdsmanPlatform = this.zigbeeAccessory.platform;
  protected readonly accessory: PlatformAccessory = this.zigbeeAccessory.accessory;
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
    return await this.zigbeeAccessory.setDeviceState({ state: on ? 'ON' : 'OFF' });
  }

  public async getOnOffState() {
    const payload = await this.zigbeeAccessory.getDeviceState({ state: 'ON' });
    return payload.state === 'ON';
  }

  public async setBrightnessPercent(brightness_percent: number) {
    const brightness = Math.round(Number(brightness_percent) * 2.55);
    const payload = await this.zigbeeAccessory.setDeviceState({ brightness });
    return { brightness_percent: Math.round(Number(payload.brightness) / 2.55) };
  }

  public async getBrightnessPercent() {
    const payload = await this.zigbeeAccessory.getDeviceState({ brightness: 0 });
    return Math.round(Number(payload.brightness) / 2.55);
  }

  public async setColorTemperature(colorTemperature: number) {
    return await this.zigbeeAccessory.setDeviceState({ color_temp: colorTemperature });
  }

  public async getColorTemperature() {
    const payload = await this.zigbeeAccessory.getDeviceState({ color_temp: 0 });
    return payload.color_temp;
  }

  public async setHue(hue: number) {
    return await this.zigbeeAccessory.setDeviceState({ color: { hue } });
  }

  public async getHue() {
    const payload = await this.zigbeeAccessory.getDeviceState({ color: { hue: 0 } });
    return payload.color.hue;
  }

  public async setColorXY(x: number, y: number) {
    return await this.zigbeeAccessory.setDeviceState({ color: { x, y } });
  }

  public async getColorXY() {
    const payload = await this.zigbeeAccessory.getDeviceState({ color: { x: 0, y: 0 } });
    return payload.color;
  }

  public async setColorRGB(r: number, g: number, b: number) {
    return await this.zigbeeAccessory.setDeviceState({ color: { rgb: `${r},${g},${b}` } });
  }

  public async setSaturation(saturation: number) {
    return await this.zigbeeAccessory.setDeviceState({ color: { s: saturation } });
  }

  public async getSaturation() {
    const payload = await this.zigbeeAccessory.getDeviceState({ color: { s: 0 } });
    return payload.color.s;
  }

  protected debugState(name, value) {
    const displayName = `${this.zigbeeAccessory.device.ieeeAddr}:${this.zigbeeAccessory.name}`;
    this.log.info(`[${displayName}] ${this.constructor.name}: ${name}:`, value);
  }
}
