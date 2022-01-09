import {
  CharacteristicValue,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  HAPStatus,
} from 'homebridge';
import { types } from 'util';

import { ZigbeeAccessory, Events } from '../accessories';
import { ServiceBuilder } from './serviceBuilder';
import { HSBType } from '../utils/hsbType';

export class LightbulbServiceBuilder extends ServiceBuilder {
  constructor(protected readonly zigbeeAccessory: ZigbeeAccessory) {
    super(zigbeeAccessory);
    this.service =
      this.platformAccessory.getService(this.platform.Service.Lightbulb) ||
      this.platformAccessory.addService(this.platform.Service.Lightbulb);
  }

  public withOnOff(): LightbulbServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.On)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        try {
          const state = await this.setOn(value === true);
          this.debugState('=> On', state);
          callback();
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    this.service
      .getCharacteristic(Characteristic.On)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const state = await this.getOnOffState();
          callback(null, state.state === 'ON');
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { state?: 'ON' | 'OFF' }) => {
      if (state.state !== undefined) {
        this.debugState('On', state.state);
        this.service.updateCharacteristic(Characteristic.On, state.state === 'ON');
      }
    });

    return this;
  }

  /**
   * untested
   */
  public withBrightnessPercent(): LightbulbServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.Brightness)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        const brightness_percent = Number(value);
        const brightness = Math.round(brightness_percent * 2.55);
        try {
          const state = await this.setBrightness(brightness);
          this.debugState('=> Brightness', state.brightness / 2.55);
          callback();
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    this.service
      .getCharacteristic(Characteristic.Brightness)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const state = await this.getBrightness();
          const brightness = state.brightness || 0;
          const brightness_percent = brightness / 2.55;
          callback(null, brightness_percent);
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { brightness?: number }) => {
      if (state.brightness !== undefined) {
        this.debugState('Brightness', state.brightness);
        this.service.updateCharacteristic(Characteristic.Brightness, state.brightness / 2.55);
      }
    });

    return this;
  }

  /**
   * untested
   */
  public withColorTemperature(): LightbulbServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.ColorTemperature)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        try {
          const colorTemperature = value as number;
          await this.setColorTemperature(colorTemperature);
          this.debugState('=> Color Temperature', colorTemperature);
          callback();
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    this.service
      .getCharacteristic(Characteristic.ColorTemperature)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const state = await this.getColorTemperature();
          const color_temp = state.color_temp || 0;
          callback(null, color_temp);
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { color_temp?: number }) => {
      if (state.color_temp !== undefined) {
        this.debugState('Color Temperature', state.color_temp);
        this.service.updateCharacteristic(Characteristic.ColorTemperature, state.color_temp);
      }
    });

    return this;
  }

  /**
   * untested
   */
  public withHue(): LightbulbServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.Hue)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        try {
          const hue = value as number;
          await this.setHue(hue);
          this.debugState('=> Hue', hue);
          callback();
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    this.service
      .getCharacteristic(Characteristic.Hue)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const state = await this.getHue();
          const hue = state.color?.hue || 0;
          callback(null, hue);
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { color?: { hue?: number } }) => {
      if (state.color && state.color.hue !== undefined) {
        this.debugState('Hue', state.color.hue);
        this.service.updateCharacteristic(Characteristic.Hue, state.color.hue);
      }
    });

    return this;
  }

  /**
   * untested
   * Special treatment for bulbs supporting only XY colors (IKEA Tådfri for example)
   * HomeKit only knows about HSB, so we need to manually convert values
   */
  public withColorXY(): LightbulbServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.Saturation)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        try {
          const saturation = value as number;
          const v = this.service.getCharacteristic(Characteristic.Brightness).value as number;
          const hue = this.service.getCharacteristic(Characteristic.Hue).value as number;
          const hsbType = new HSBType(hue, saturation, v);
          const [r, g, b] = hsbType.toRGBBytes();
          await this.setColorRGB(r, g, b);
          this.debugState('=> Color RGB', { r, g, b });
          callback();
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    this.service
      .getCharacteristic(Characteristic.Saturation)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const state = await this.getColorXY();
          if (state.color && state.color.x !== undefined && state.color.y !== undefined) {
            this.debugState('Color XY', state.color);
            const hsbType = HSBType.fromXY(state.color.x, state.color.y, Y);
            this.service.updateCharacteristic(Characteristic.Hue, hsbType.hue);
            callback(null, hsbType.saturation);
          } else {
            callback(HAPStatus.RESOURCE_BUSY);
          }
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    const Y = (this.service.getCharacteristic(Characteristic.Brightness).value as number) / 100;

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { color?: { x?: number; y?: number } }) => {
      if (state.color && state.color.x !== undefined && state.color.y !== undefined) {
        this.debugState('Color XY', state.color);
        const hsbType = HSBType.fromXY(state.color.x, state.color.y, Y);
        this.service.updateCharacteristic(Characteristic.Hue, hsbType.hue);
        this.service.updateCharacteristic(Characteristic.Saturation, hsbType.saturation);
      }
    });

    return this;
  }

  /**
   * untested
   */
  public withSaturation(): LightbulbServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.Saturation)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        try {
          const saturation = value as number;
          await this.setSaturation(saturation);
          this.debugState('=> Saturation', saturation);
          callback();
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    this.service
      .getCharacteristic(Characteristic.Saturation)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const state = await this.getSaturation();
          const saturation = state.color?.s || 0;
          callback(null, saturation);
        } catch (e) {
          if (types.isNativeError(e)) {
            callback(e);
          }
        }
      });

    this.zigbeeAccessory.on(Events.stateUpdate, (state: { color?: { s?: number } }) => {
      if (state.color && state.color.s !== undefined) {
        this.debugState('Saturation', state.color.s);
        this.service.updateCharacteristic(Characteristic.Saturation, state.color.s);
      }
    });

    return this;
  }
}
