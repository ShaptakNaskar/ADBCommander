import { AdbService, DeviceInfo } from './AdbService'

export class DeviceMonitor {
    private adbService: AdbService
    private intervalId: NodeJS.Timeout | null = null
    private lastDevices: Map<string, DeviceInfo> = new Map()
    private pollInterval: number = 2000 // 2 seconds
    private pollCallback: ((devices: DeviceInfo[]) => void) | null = null

    constructor(adbService: AdbService) {
        this.adbService = adbService
    }

    start(callback: (devices: DeviceInfo[]) => void): void {
        this.pollCallback = callback

        // Initial fetch
        this.poll(callback)

        // Start polling
        this.intervalId = setInterval(() => {
            this.poll(callback)
        }, this.pollInterval)
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
    }

    private async poll(callback: (devices: DeviceInfo[]) => void): Promise<void> {
        try {
            const devices = await this.adbService.getDevices()

            // Check if devices changed
            const hasChanged = this.hasDevicesChanged(devices)

            if (hasChanged) {
                this.lastDevices.clear()
                devices.forEach(d => this.lastDevices.set(d.serial, d))
                callback(devices)
            } else {
                // Still send updates for battery changes etc
                callback(devices)
            }
        } catch (error) {
            // ADB might not be ready yet, just skip this poll
            console.error('Device poll failed:', error)
        }
    }

    private hasDevicesChanged(newDevices: DeviceInfo[]): boolean {
        if (newDevices.length !== this.lastDevices.size) {
            return true
        }

        for (const device of newDevices) {
            const lastDevice = this.lastDevices.get(device.serial)
            if (!lastDevice) {
                return true
            }

            // Check if device state changed
            if (lastDevice.state !== device.state) {
                return true
            }
        }

        return false
    }

    setPollInterval(ms: number): void {
        this.pollInterval = ms
        if (this.intervalId && this.pollCallback) {
            this.stop()
            this.intervalId = setInterval(() => {
                this.poll(this.pollCallback!)
            }, this.pollInterval)
        }
    }
}
