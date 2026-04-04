import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, chmodSync, rmSync } from 'fs'
import { get } from 'https'

const PLATFORM_TOOLS_URLS: Record<string, string> = {
    win32: 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
    darwin: 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip',
    linux: 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip'
}

export class BinaryManager {
    private binariesDir: string
    private platform: NodeJS.Platform

    constructor() {
        this.platform = process.platform
        // Don't add 'platform-tools' here - the zip already extracts to a 'platform-tools' folder
        this.binariesDir = app.getPath('userData')
    }

    get adbPath(): string {
        const adbName = this.platform === 'win32' ? 'adb.exe' : 'adb'
        return join(this.binariesDir, 'platform-tools', adbName)
    }

    async ensureAdb(): Promise<string> {
        // Check if ADB already exists
        if (existsSync(this.adbPath)) {
            console.log('ADB binary found at:', this.adbPath)
            return this.adbPath
        }

        // Download and extract
        console.log('ADB not found, downloading platform-tools...')
        await this.downloadAndExtract()

        // Make executable on Unix
        if (this.platform !== 'win32') {
            chmodSync(this.adbPath, 0o755)
            // Also chmod fastboot
            const fastbootPath = join(this.binariesDir, 'platform-tools', 'fastboot')
            if (existsSync(fastbootPath)) {
                chmodSync(fastbootPath, 0o755)
            }
        }

        return this.adbPath
    }

    private async downloadAndExtract(): Promise<void> {
        const url = PLATFORM_TOOLS_URLS[this.platform]
        if (!url) {
            throw new Error(`Unsupported platform: ${this.platform}`)
        }

        // Create binaries directory
        if (!existsSync(this.binariesDir)) {
            mkdirSync(this.binariesDir, { recursive: true })
        }

        const zipPath = join(this.binariesDir, 'platform-tools.zip')

        // Download
        await this.downloadFile(url, zipPath)

        // Extract
        await this.extractZip(zipPath, this.binariesDir)

        // Cleanup zip
        rmSync(zipPath)
    }

    private downloadFile(url: string, dest: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = createWriteStream(dest)

            const request = (urlToFetch: string): void => {
                get(urlToFetch, (response) => {
                    // Handle redirects
                    if (response.statusCode === 301 || response.statusCode === 302) {
                        const redirectUrl = response.headers.location
                        if (redirectUrl) {
                            response.resume() // drain so the socket is released
                            request(redirectUrl)
                            return
                        }
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`Download failed with status: ${response.statusCode}`))
                        return
                    }

                    response.pipe(file)

                    file.on('finish', () => {
                        file.close()
                        resolve()
                    })
                }).on('error', (err) => {
                    rmSync(dest, { force: true })
                    reject(err)
                })
            }

            request(url)
        })
    }

    private async extractZip(zipPath: string, destDir: string): Promise<void> {
        const extractZip = await import('extract-zip')
        await extractZip.default(zipPath, { dir: destDir })
    }

    async checkForUpdates(): Promise<boolean> {
        // For now, just check if the binary exists
        // In future, could compare versions
        return !existsSync(this.adbPath)
    }

    async cleanup(): Promise<void> {
        const platformToolsDir = join(this.binariesDir, 'platform-tools')
        if (existsSync(platformToolsDir)) {
            rmSync(platformToolsDir, { recursive: true, force: true })
        }
    }
}
