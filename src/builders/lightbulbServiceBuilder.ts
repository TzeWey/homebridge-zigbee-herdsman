import {
  CharacteristicValue,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
} from 'homebridge';

import { ZigbeeAccessory } from '../accessories';
import { ServiceBuilder } from './serviceBuilder';
import { HSBType } from '../util/hsbType';

export class LightbulbServiceBuilder extends ServiceBuilder {
  constructor(protected readonly zigbeeAccessory: ZigbeeAccessory) {
    super(zigbeeAccessory);
    this.service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);
  }

  public withOnOff(): LightbulbServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.On)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        try {
          const state = await this.setOn(value === true);
          this.debugState('setOn', state);
          callback();
        } catch (e) {
          callback(e);
        }
      });

    this.service
      .getCharacteristic(Characteristic.On)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const state = await this.getOnOffState();
          this.debugState('getOnOffState', state);
          callback(null, state);
        } catch (e) {
          callback(e);
        }
      });

    return this;
  }

  public withBrightness(): LightbulbServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.Brightness)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        const brightness_percent = value as number;
        try {
          const state = await this.setBrightnessPercent(brightness_percent);
          this.debugState('Brightness SET', state.brightness_percent);
          callback();
        } catch (e) {
          callback(e);
        }
      });

    this.service
      .getCharacteristic(Characteristic.Brightness)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const brightness_percent = await this.getBrightnessPercent();
          this.debugState('Brightness GET', brightness_percent);
          callback(null, brightness_percent);
        } catch (e) {
          callback(e);
        }
      });
    return this;
  }

  public withColorTemperature(): LightbulbServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.ColorTemperature)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        try {
          const colorTemperature = value as number;
          await this.setColorTemperature(colorTemperature);
          callback();
        } catch (e) {
          callback(e);
        }
      });

    this.service
      .getCharacteristic(Characteristic.ColorTemperature)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const color_temp = await this.getColorTemperature();
          callback(null, color_temp);
        } catch (e) {
          callback(e);
        }
      });

    return this;
  }

  public withHue(): LightbulbServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.Hue)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        try {
          const hue = value as number;
          await this.setHue(hue);
          callback();
        } catch (e) {
          callback(e);
        }
      });

    this.service
      .getCharacteristic(Characteristic.Hue)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const hue = await this.getHue();
          callback(null, hue);
        } catch (e) {
          callback(e);
        }
      });

    return this;
  }

  /**
   * Special treatment for bulbs supporting only XY colors (IKEA Tådfri for example)
   * HomeKit only knows about HSB, so we need to manually convert values
   */
  public withColorXY(): LightbulbServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    // this.service
    //   .getCharacteristic(Characteristic.Hue)
    //   .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
    //     try {
    //       const h = value as number;
    //       const s = this.service.getCharacteristic(Characteristic.Saturation).value as number;
    //       const v = this.service.getCharacteristic(Characteristic.Brightness).value as number;
    //       const hsbType = new HSBType(h, s, v);
    //       const [r, g, b] = hsbType.toRGBBytes();
    //       const state = await this.setColorRGB(r, g, b);
    //       callback();
    //     } catch (e) {
    //       callback(e);
    //     }
    //   });
    // this.service
    //   .getCharacteristic(Characteristic.Hue)
    //   .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
    //     try {
    //       const color = await this.getColorXY();
    //       const Y = (this.service.getCharacteristic(Characteristic.Brightness).value as number) / 100;
    //       const hsbType = HSBType.fromXY(color.x, color.y, Y);
    //       const hue = hsbType.hue;
    //       this.service.updateCharacteristic(Characteristic.Saturation, hsbType.saturation);
    //       callback(null, hue);
    //     } catch (e) {
    //       callback(e);
    //     }
    //   });

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
          callback();
        } catch (e) {
          callback(e);
        }
      });

    this.service
      .getCharacteristic(Characteristic.Saturation)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const color = await this.getColorXY();
          const Y = (this.service.getCharacteristic(Characteristic.Brightness).value as number) / 100;
          const hsbType = HSBType.fromXY(color.x, color.y, Y);
          this.service.updateCharacteristic(Characteristic.Hue, hsbType.hue);
          callback(null, hsbType.saturation);
        } catch (e) {
          callback(e);
        }
      });

    return this;
  }

  public withSaturation(): LightbulbServiceBuilder {
    const Characteristic = this.platform.Characteristic;

    this.service
      .getCharacteristic(Characteristic.Saturation)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        try {
          const saturation = value as number;
          await this.setSaturation(saturation);
          callback();
        } catch (e) {
          callback(e);
        }
      });
    this.service
      .getCharacteristic(Characteristic.Saturation)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
        try {
          const saturation = await this.getSaturation();
          callback(null, saturation);
        } catch (e) {
          callback(e);
        }
      });

    return this;
  }
}
