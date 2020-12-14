<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

# Homebridge `zigbee-herdsman` Plugin

Zigbee plugin for [HomeBridge](https://github.com/homebridge/homebridge)

# Description

This plugin exposes Zigbee devices as Apple HomeKit accessories.

Communication with the Zigbee devices are made via [zigbee-herdsman](https://github.com/Koenkk/zigbee-herdsman) and requires a Zigbee radio running the [Z-Stack-firmware](https://github.com/Koenkk/Z-Stack-firmware).

Message decoding is performed by [zigbee-herdsman-converters](https://github.com/Koenkk/zigbee-herdsman-converters) which already has a large database of supported devices. However, there is still a need to map features of the Zigbee device to a corresponding HomeKit service.

This project is based off [homebridge-zigbee-nt](https://github.com/madchicken/homebridge-zigbee-nt) plugin by Pierpaolo Follia .
