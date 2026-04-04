import { execSync, execFile, execFileSync, spawn } from 'child_process'
import { join, basename, dirname } from 'path'
import { existsSync, mkdirSync, readdirSync, statSync, renameSync, rmSync } from 'fs'
import { promisify } from 'util'
import { FilenameSanitizer } from '../utils/FilenameSanitizer'

const execFileAsync = promisify(execFile)

export interface DeviceInfo {
    serial: string
    state: 'device' | 'unauthorized' | 'offline' | 'no permissions'
    model: string
    manufacturer: string
    androidVersion: string
    sdkVersion: string
    batteryLevel: number
    batteryStatus: 'charging' | 'discharging' | 'full' | 'not charging' | 'unknown'
    usbDebugging: boolean
    bootloader: 'locked' | 'unlocked' | 'unknown'
    connectionType: 'usb' | 'wifi'
}

export interface FileEntry {
    name: string
    path: string
    isDirectory: boolean
    size: number
    modifiedTime: string
    permissions: string
}

export interface ProgressInfo {
    current: number
    total: number
    currentFile: string
    speed: string
    eta: string
    overallPercent: number
    filePercent: number
    elapsed: number
}

export class AdbService {
    public readonly adbPath: string
    private sanitizer: FilenameSanitizer
    private activePullProc: ReturnType<typeof spawn> | null = null
    private pullCancelled = false

    constructor(adbPath: string) {
        this.adbPath = adbPath
        this.sanitizer = new FilenameSanitizer()
    }

    cancelPull(): void {
        this.pullCancelled = true
        if (this.activePullProc) {
            this.activePullProc.kill('SIGTERM')
            this.activePullProc = null
        }
    }

    private exec(args: string[]): string {
        try {
            const result = execSync(`"${this.adbPath}" ${args.join(' ')}`, {
                encoding: 'utf-8',
                timeout: 30000,
                maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large outputs
            })
            return result.trim()
        } catch (error: unknown) {
            const err = error as { stderr?: Buffer; message?: string }
            throw new Error(err.stderr?.toString() ?? err.message ?? 'ADB command failed')
        }
    }

    private execDevice(serial: string, args: string[]): string {
        return this.exec(['-s', serial, ...args])
    }

    private async execAsync(args: string[]): Promise<string> {
        try {
            const { stdout } = await execFileAsync(this.adbPath, args, {
                encoding: 'utf-8',
                timeout: 0, // no timeout for large transfers
                maxBuffer: 50 * 1024 * 1024
            })
            return (stdout as string).trim()
        } catch (error: unknown) {
            const err = error as { stderr?: string; message?: string }
            throw new Error(err.stderr?.toString() ?? err.message ?? 'ADB command failed')
        }
    }

    private async execDeviceAsync(serial: string, args: string[]): Promise<string> {
        return this.execAsync(['-s', serial, ...args])
    }

    // Public async shell command for power tools
    async execDeviceShell(serial: string, command: string): Promise<string> {
        return this.execDeviceAsync(serial, ['shell', command])
    }

    async getDevices(): Promise<DeviceInfo[]> {
        const output = this.exec(['devices', '-l'])
        const lines = output.replace(/\r\n/g, '\n').split('\n').slice(1).filter(line => line.trim())

        const devices: DeviceInfo[] = []

        for (const line of lines) {
            const parts = line.split(/\s+/)
            const serial = parts[0]
            const state = parts[1] as DeviceInfo['state']

            if (state === 'device') {
                try {
                    const info = await this.getDeviceInfo(serial)
                    devices.push(info)
                } catch {
                    devices.push({
                        serial,
                        state,
                        model: 'Unknown',
                        manufacturer: 'Unknown',
                        androidVersion: 'Unknown',
                        sdkVersion: 'Unknown',
                        batteryLevel: -1,
                        batteryStatus: 'unknown',
                        usbDebugging: true,
                        bootloader: 'unknown',
                        connectionType: serial.includes(':') ? 'wifi' : 'usb'
                    })
                }
            } else {
                devices.push({
                    serial,
                    state,
                    model: 'Unknown',
                    manufacturer: 'Unknown',
                    androidVersion: 'Unknown',
                    sdkVersion: 'Unknown',
                    batteryLevel: -1,
                    batteryStatus: 'unknown',
                    usbDebugging: false,
                    bootloader: 'unknown',
                    connectionType: serial.includes(':') ? 'wifi' : 'usb'
                })
            }
        }

        return devices
    }

    async getDeviceInfo(serial: string): Promise<DeviceInfo> {
        const getProp = (prop: string): string => {
            try {
                return this.execDevice(serial, ['shell', 'getprop', prop])
            } catch {
                return 'Unknown'
            }
        }

        const getBattery = (): { level: number; status: DeviceInfo['batteryStatus'] } => {
            try {
                const output = this.execDevice(serial, ['shell', 'dumpsys', 'battery'])
                const levelMatch = output.match(/level:\s*(\d+)/)
                const statusMatch = output.match(/status:\s*(\d+)/)

                const level = levelMatch ? parseInt(levelMatch[1]) : -1
                const statusNum = statusMatch ? parseInt(statusMatch[1]) : 0

                const statusMap: Record<number, DeviceInfo['batteryStatus']> = {
                    1: 'unknown',
                    2: 'charging',
                    3: 'discharging',
                    4: 'not charging',
                    5: 'full'
                }

                return { level, status: statusMap[statusNum] ?? 'unknown' }
            } catch {
                return { level: -1, status: 'unknown' }
            }
        }

        // Note: Bootloader state cannot be reliably detected via ADB
        // This attempts common properties but most devices don't expose this
        const getBootloaderState = (): DeviceInfo['bootloader'] => {
            try {
                // Try common properties (device-specific, often not available)
                const props = [
                    'ro.boot.flash.locked',
                    'ro.boot.verifiedbootstate',
                    'ro.secureboot.lockstate'
                ]

                for (const prop of props) {
                    const val = getProp(prop)
                    if (val === '0' || val === 'orange' || val === 'unlocked') return 'unlocked'
                    if (val === '1' || val === 'green' || val === 'locked') return 'locked'
                }

                return 'unknown'
            } catch {
                return 'unknown'
            }
        }

        const battery = getBattery()

        return {
            serial,
            state: 'device',
            model: getProp('ro.product.model'),
            manufacturer: getProp('ro.product.manufacturer'),
            androidVersion: getProp('ro.build.version.release'),
            sdkVersion: getProp('ro.build.version.sdk'),
            batteryLevel: battery.level,
            batteryStatus: battery.status,
            usbDebugging: true,
            bootloader: getBootloaderState(),
            connectionType: serial.includes(':') ? 'wifi' : 'usb'
        }
    }

    /**
     * Get remote directory size in bytes via `adb shell du -s`.
     * Returns 0 if the command fails.
     */
    private getRemoteSize(serial: string, path: string): number {
        try {
            // Pass du args separately to avoid shell injection via single-quoted path
            const output = execFileSync(
                this.adbPath,
                ['-s', serial, 'shell', 'du', '-s', '-k', path],
                { encoding: 'utf-8', timeout: 60000 }
            )
            // Output format: "12345   /path/to/file"
            const match = output.trim().match(/^(\d+)/)
            if (match) {
                const kb = parseInt(match[1])
                return kb * 1024 // Convert to bytes
            }
            return 0
        } catch (e) {
            console.error('Failed to get remote size:', e)
            return 0
        }
    }

    /**
     * Recursively get local directory size in bytes.
     */
    private getLocalDirSize(dirPath: string): number {
        let size = 0
        try {
            const entries = readdirSync(dirPath, { withFileTypes: true })
            for (const entry of entries) {
                const fullPath = join(dirPath, entry.name)
                try {
                    if (entry.isDirectory()) {
                        size += this.getLocalDirSize(fullPath)
                    } else {
                        size += statSync(fullPath).size
                    }
                } catch {
                    // File might be actively written
                }
            }
        } catch {
            // Directory might not exist yet
        }
        return size
    }

    /**
     * Find the most recently modified file in a directory (recursive).
     * Returns the relative path of the file currently being written.
     */
    private findLatestFile(dirPath: string, basePath?: string): { name: string; mtime: number } | null {
        const root = basePath || dirPath
        let latest: { name: string; mtime: number } | null = null
        try {
            const entries = readdirSync(dirPath, { withFileTypes: true })
            for (const entry of entries) {
                const fullPath = join(dirPath, entry.name)
                try {
                    if (entry.isDirectory()) {
                        const sub = this.findLatestFile(fullPath, root)
                        if (sub && (!latest || sub.mtime > latest.mtime)) {
                            latest = sub
                        }
                    } else {
                        const mtime = statSync(fullPath).mtimeMs
                        if (!latest || mtime > latest.mtime) {
                            latest = { name: fullPath.replace(root, '').replace(/^\/|^\\/, ''), mtime }
                        }
                    }
                } catch {
                    // skip
                }
            }
        } catch {
            // skip
        }
        return latest
    }

    /**
     * Format bytes/sec into a human-readable speed string.
     */
    private formatSpeed(bytesPerSec: number): string {
        if (bytesPerSec <= 0) return ''
        if (bytesPerSec >= 1024 * 1024) {
            return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
        } else if (bytesPerSec >= 1024) {
            return `${(bytesPerSec / 1024).toFixed(0)} KB/s`
        }
        return `${Math.round(bytesPerSec)} B/s`
    }

    async pullFiles(
        serial: string,
        sources: string[],
        destination: string,
        onProgress?: (progress: ProgressInfo) => void
    ): Promise<{ success: boolean; errors: string[] }> {
        const errors: string[] = []
        const total = sources.length
        let current = 0
        const startTime = Date.now()
        this.pullCancelled = false

        for (const source of sources) {
            if (this.pullCancelled) break
            current++
            const sanitizedName = this.sanitizer.sanitize(basename(source))
            const destPath = join(destination, sanitizedName)

            onProgress?.({
                current,
                total,
                currentFile: source,
                speed: 'Calculating size...',
                eta: `${total - current} folders remaining`,
                overallPercent: 0,
                filePercent: 0,
                elapsed: Math.floor((Date.now() - startTime) / 1000)
            })

            try {
                // Create destination directory
                const destDir = dirname(destPath)
                if (!existsSync(destDir)) {
                    mkdirSync(destDir, { recursive: true })
                }

                // Get remote size for progress calculation
                const remoteSize = this.getRemoteSize(serial, source)

                // Rotation: Rename existing folder to .tmp_old to ensure fresh pull and accurate progress
                const tempBackupPath = destPath + '.tmp_old'
                let rotated = false
                try {
                    if (existsSync(destPath)) {
                        if (existsSync(tempBackupPath)) {
                            rmSync(tempBackupPath, { recursive: true, force: true })
                        }
                        renameSync(destPath, tempBackupPath)
                        rotated = true
                    }
                } catch (e) {
                    console.error('Failed to rotate backup folder:', e)
                    // If rotation fails, we proceed with overwrite (progress might be inaccurate but backup still works)
                }

                // Start adb pull as a child process
                const proc = spawn(this.adbPath, ['-s', serial, 'pull', '-a', source, destPath])
                this.activePullProc = proc
                let output = ''

                proc.stdout.on('data', (chunk: Buffer) => { output += chunk.toString() })
                proc.stderr.on('data', (chunk: Buffer) => { output += chunk.toString() })

                // Poll destination size for progress
                let lastPollSize = 0
                let lastPollTime = Date.now()
                let lastSpeed = ''
                const folderStartTime = Date.now()

                const pollInterval = setInterval(() => {
                    try {
                        const currentSize = this.getLocalDirSize(destPath)
                        const now = Date.now()
                        const deltaSec = (now - lastPollTime) / 1000

                        // Calculate speed from delta
                        if (deltaSec > 0) {
                            const deltaBytes = currentSize - lastPollSize
                            if (deltaBytes > 0) {
                                lastSpeed = this.formatSpeed(deltaBytes / deltaSec)
                            }
                        }

                        // Calculate percentage
                        const overallPercent = remoteSize > 0
                            ? Math.min(99, Math.round((currentSize / remoteSize) * 100))
                            : 0

                        // Calculate ETA from average transfer speed
                        let etaStr = 'Calculating...'
                        const elapsedSec = (now - folderStartTime) / 1000

                        if (remoteSize > 0 && currentSize > 0 && elapsedSec > 0) {
                            const avgBytesPerSec = currentSize / elapsedSec
                            const remainingBytes = Math.max(0, remoteSize - currentSize)
                            const etaSec = Math.ceil(remainingBytes / avgBytesPerSec)
                            if (etaSec < 60) {
                                etaStr = `~${etaSec}s remaining`
                            } else {
                                const m = Math.floor(etaSec / 60)
                                const s = etaSec % 60
                                etaStr = `~${m}m ${s}s remaining`
                            }
                        } else if (total > current) {
                            etaStr = `${total - current} folders remaining`
                        } else if (remoteSize === 0) {
                            // If remote size failed, just show we are working
                            etaStr = 'Transferring...'
                        }

                        // Find the file currently being written
                        const latestFile = this.findLatestFile(destPath)
                        const currentFileName = latestFile?.name || basename(source)

                        onProgress?.({
                            current,
                            total,
                            currentFile: currentFileName,
                            speed: lastSpeed || 'Transferring...',
                            eta: etaStr,
                            overallPercent,
                            filePercent: 0,
                            elapsed: Math.floor((Date.now() - startTime) / 1000)
                        })

                        lastPollSize = currentSize
                        lastPollTime = now
                    } catch {
                        // Ignore polling errors
                    }
                }, 500)

                // Wait for process to complete
                await new Promise<void>((resolve, reject) => {
                    proc.on('close', (code) => {
                        clearInterval(pollInterval)
                        this.activePullProc = null
                        if (this.pullCancelled) {
                            // Rollback if cancelled
                            if (rotated) {
                                try {
                                    if (existsSync(destPath)) rmSync(destPath, { recursive: true, force: true })
                                    if (existsSync(tempBackupPath)) renameSync(tempBackupPath, destPath)
                                } catch (e) { console.error('Rollback failed:', e) }
                            }
                            resolve()
                        }
                        else if (code === 0) {
                            // Success: Cleanup old backup
                            if (rotated && existsSync(tempBackupPath)) {
                                try { rmSync(tempBackupPath, { recursive: true, force: true }) }
                                catch (e) { console.error('Cleanup failed:', e) }
                            }
                            resolve()
                        }
                        else {
                            // Failure: Rollback
                            if (rotated) {
                                try {
                                    if (existsSync(destPath)) rmSync(destPath, { recursive: true, force: true })
                                    if (existsSync(tempBackupPath)) renameSync(tempBackupPath, destPath)
                                } catch (e) { console.error('Rollback failed:', e) }
                            }
                            reject(new Error(output || `adb pull exited with code ${code}`))
                        }
                    })
                    proc.on('error', (err) => {
                        clearInterval(pollInterval)
                        this.activePullProc = null
                        // Failure: Rollback
                        if (rotated) {
                            try {
                                if (existsSync(destPath)) rmSync(destPath, { recursive: true, force: true })
                                if (existsSync(tempBackupPath)) renameSync(tempBackupPath, destPath)
                            } catch (e) { console.error('Rollback failed:', e) }
                        }
                        reject(err)
                    })
                })

                if (this.pullCancelled) break

                // Parse speed from final output
                const speedMatch = output.match(/(\d+\.?\d*)\s*(MB\/s|KB\/s|B\/s)/)
                const finalSpeed = speedMatch ? `${speedMatch[1]} ${speedMatch[2]}` : lastSpeed

                onProgress?.({
                    current,
                    total,
                    currentFile: `✓ ${basename(source)}`,
                    speed: finalSpeed,
                    eta: current < total ? `${total - current} folders remaining` : 'Finishing...',
                    overallPercent: 100,
                    filePercent: 100,
                    elapsed: Math.floor((Date.now() - startTime) / 1000)
                })
            } catch (error: unknown) {
                const err = error as { message?: string }
                errors.push(`${source}: ${err.message ?? 'Unknown error'}`)
            }
        }

        return { success: errors.length === 0, errors }
    }

    async pushFiles(
        serial: string,
        source: string,
        destination: string,
        onProgress?: (progress: ProgressInfo) => void
    ): Promise<{ success: boolean; errors: string[] }> {
        const errors: string[] = []

        onProgress?.({
            current: 1,
            total: 1,
            currentFile: source,
            speed: 'Calculating...',
            eta: 'Calculating...',
            overallPercent: 0,
            filePercent: 0,
            elapsed: 0
        })

        try {
            // Use async exec so the main thread stays responsive
            const output = await this.execDeviceAsync(serial, ['push', source, destination])

            const speedMatch = output.match(/(\d+\.?\d*)\s*(MB\/s|KB\/s|B\/s)/)
            const speed = speedMatch ? `${speedMatch[1]} ${speedMatch[2]}` : ''

            onProgress?.({
                current: 1,
                total: 1,
                currentFile: source,
                speed,
                eta: 'Finishing...',
                overallPercent: 100,
                filePercent: 100,
                elapsed: 0
            })
        } catch (error: unknown) {
            const err = error as { message?: string }
            errors.push(`${source}: ${err.message ?? 'Unknown error'}`)
        }

        return { success: errors.length === 0, errors }
    }

    async installApk(serial: string, apkPath: string): Promise<{ success: boolean; message: string }> {
        try {
            const output = await this.execDeviceAsync(serial, ['install', '-r', apkPath])
            return { success: output.includes('Success'), message: output }
        } catch (error: unknown) {
            const err = error as { message?: string }
            return { success: false, message: err.message ?? 'Installation failed' }
        }
    }

    async screenshot(serial: string, outputPath: string): Promise<{ success: boolean; path: string }> {
        try {
            const tempPath = '/sdcard/screenshot_temp.png'
            await this.execDeviceAsync(serial, ['shell', 'screencap', '-p', tempPath])
            await this.execDeviceAsync(serial, ['pull', tempPath, outputPath])
            await this.execDeviceAsync(serial, ['shell', 'rm', tempPath])
            return { success: true, path: outputPath }
        } catch (error: unknown) {
            const err = error as { message?: string }
            throw new Error(`Screenshot failed: ${err.message}`)
        }
    }

    async screenRecord(
        serial: string,
        outputPath: string,
        duration: number = 180
    ): Promise<{ success: boolean; path: string }> {
        const tempPath = '/sdcard/recording_temp.mp4'

        try {
            // Start recording (runs for the given duration)
            await this.execDeviceAsync(serial, [
                'shell',
                'screenrecord',
                '--time-limit',
                String(Math.min(duration, 180)),
                tempPath
            ])

            // Pull recording
            await this.execDeviceAsync(serial, ['pull', tempPath, outputPath])
            await this.execDeviceAsync(serial, ['shell', 'rm', tempPath])

            return { success: true, path: outputPath }
        } catch (error: unknown) {
            const err = error as { message?: string }
            throw new Error(`Screen recording failed: ${err.message}`)
        }
    }

    async reboot(serial: string, mode: 'system' | 'recovery' | 'bootloader'): Promise<void> {
        const args = mode === 'system' ? ['reboot'] : ['reboot', mode]
        this.execDevice(serial, args)
    }

    async pairDevice(ip: string, port: number, pairingCode: string): Promise<{ success: boolean; message: string }> {
        try {
            const output = this.exec(['pair', `${ip}:${port}`, pairingCode])
            const success = output.toLowerCase().includes('paired') || output.toLowerCase().includes('success')
            return { success, message: output }
        } catch (error: unknown) {
            const err = error as { message?: string }
            return { success: false, message: err.message ?? 'Pairing failed' }
        }
    }

    async execRawCommand(args: string[]): Promise<{ stdout: string; stderr: string; success: boolean }> {
        try {
            const { stdout, stderr } = await execFileAsync(this.adbPath, args, {
                encoding: 'utf-8',
                timeout: 30000,
                maxBuffer: 50 * 1024 * 1024
            })
            return {
                stdout: (stdout as string).trim(),
                stderr: (stderr as string).trim(),
                success: true
            }
        } catch (error: unknown) {
            const err = error as { stdout?: string; stderr?: string; message?: string }
            return {
                stdout: err.stdout?.trim() ?? '',
                stderr: err.stderr?.trim() ?? err.message ?? 'Command failed',
                success: false
            }
        }
    }

    async connectWireless(ip: string, port: number = 5555): Promise<{ success: boolean; message: string }> {
        try {
            const output = this.exec(['connect', `${ip}:${port}`])
            return {
                success: output.includes('connected'),
                message: output
            }
        } catch (error: unknown) {
            const err = error as { message?: string }
            return { success: false, message: err.message ?? 'Connection failed' }
        }
    }

    async disconnectWireless(ip: string, port: number = 5555): Promise<void> {
        this.exec(['disconnect', `${ip}:${port}`])
    }

    async openShell(serial: string): Promise<void> {
        // This opens a terminal with adb shell - platform dependent
        const { spawn, execSync } = await import('child_process')

        if (process.platform === 'win32') {
            // Build the /k command as a single string so Node.js doesn't double-escape the quotes
            const adbCmd = `"${this.adbPath}" -s ${serial} shell`
            spawn('cmd', ['/c', 'start', 'cmd', '/k', adbCmd], {
                detached: true,
                stdio: 'ignore',
                windowsVerbatimArguments: true
            })
        } else if (process.platform === 'darwin') {
            spawn('osascript', [
                '-e', `tell application "Terminal" to do script "\\"${this.adbPath}\\" -s ${serial} shell"`
            ], { detached: true, stdio: 'ignore' })
        } else {
            // Linux - use $TERMINAL env var first (most portable)
            const userTerminal = process.env.TERMINAL

            if (userTerminal) {
                try {
                    const child = spawn(userTerminal, ['-e', `${this.adbPath} -s ${serial} shell`], {
                        detached: true,
                        stdio: 'ignore'
                    })
                    child.unref()
                    return
                } catch {
                    // Fall through to auto-detection
                }
            }

            // Auto-detect available terminal
            const terminals = [
                { cmd: 'x-terminal-emulator', args: ['-e', `${this.adbPath} -s ${serial} shell`] },
                { cmd: 'alacritty', args: ['-e', this.adbPath, '-s', serial, 'shell'] },
                { cmd: 'kitty', args: ['--', this.adbPath, '-s', serial, 'shell'] },
                { cmd: 'wezterm', args: ['start', '--', this.adbPath, '-s', serial, 'shell'] },
                { cmd: 'konsole', args: ['-e', this.adbPath, '-s', serial, 'shell'] },
                { cmd: 'gnome-terminal', args: ['--', this.adbPath, '-s', serial, 'shell'] },
                { cmd: 'xfce4-terminal', args: ['-e', `${this.adbPath} -s ${serial} shell`] },
                { cmd: 'xterm', args: ['-e', this.adbPath, '-s', serial, 'shell'] }
            ]

            for (const term of terminals) {
                try {
                    execSync(`which ${term.cmd}`, { encoding: 'utf-8', stdio: 'pipe' })
                    const child = spawn(term.cmd, term.args, {
                        detached: true,
                        stdio: 'ignore'
                    })
                    child.unref()
                    return
                } catch {
                    continue
                }
            }

            throw new Error('No terminal found. Set $TERMINAL env var or install a terminal emulator.')
        }
    }
}
