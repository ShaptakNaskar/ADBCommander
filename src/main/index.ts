import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { AdbService } from './adb/AdbService'
import { DeviceMonitor } from './adb/DeviceMonitor'
import { FileBrowser } from './adb/FileBrowser'
import { BinaryManager } from './binaries/BinaryManager'
import { logger } from './utils/LogService'
import { autoUpdater } from 'electron-updater'

// Disable Chromium sandbox on Linux to avoid SUID permission issues
// This must be called before app.whenReady()
if (process.platform === 'linux') {
    app.commandLine.appendSwitch('no-sandbox')
}

let mainWindow: BrowserWindow | null = null
let adbService: AdbService | null = null
let deviceMonitor: DeviceMonitor | null = null

async function createWindow(): Promise<void> {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: true,
        backgroundColor: '#0a0a0f',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    })

    // Remove menu bar on Windows/Linux
    if (process.platform !== 'darwin') {
        mainWindow.setMenu(null)
    }

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))

        // Disable DevTools in production builds
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow?.webContents.closeDevTools()
        })

        // Block DevTools keyboard shortcuts in production
        mainWindow.webContents.on('before-input-event', (event, input) => {
            // Block F12
            if (input.key === 'F12') {
                event.preventDefault()
            }
            // Block Ctrl+Shift+I / Cmd+Shift+I
            if (input.key === 'I' && input.shift && (input.control || input.meta)) {
                event.preventDefault()
            }
            // Block Ctrl+Shift+J / Cmd+Shift+J (Console)
            if (input.key === 'J' && input.shift && (input.control || input.meta)) {
                event.preventDefault()
            }
        })
    }

    mainWindow.on('closed', () => {
        mainWindow = null
    })

    // Set up logger to use this window
    logger.setMainWindow(mainWindow)
}

async function initializeAdb(): Promise<void> {
    const binaryManager = new BinaryManager()

    // Ensure ADB binary is available
    const adbPath = await binaryManager.ensureAdb()

    adbService = new AdbService(adbPath)
    deviceMonitor = new DeviceMonitor(adbService)

    logger.info(`ADB initialized at: ${adbPath}`)

    // Start device monitoring
    deviceMonitor.start((devices) => {
        mainWindow?.webContents.send('devices-updated', devices)
    })
}

// IPC Handlers
function setupIpcHandlers(): void {
    // Device operations
    ipcMain.handle('get-devices', async () => {
        return adbService?.getDevices() ?? []
    })

    ipcMain.handle('get-device-info', async (_, serial: string) => {
        return adbService?.getDeviceInfo(serial)
    })

    // File browser
    ipcMain.handle('list-files', async (_, serial: string, path: string) => {
        if (!adbService) return []
        try {
            const fileBrowser = new FileBrowser(adbService)
            return fileBrowser.listFiles(serial, path)
        } catch (error) {
            logger.error(`List files failed: ${error}`)
            return []
        }
    })

    // Backup/Restore
    ipcMain.handle('select-backup-destination', async () => {
        try {
            const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openDirectory', 'createDirectory'],
                title: 'Select Backup Destination'
            })
            return result.canceled ? null : result.filePaths[0]
        } catch (error) {
            logger.error(`File dialog error: ${error}`)
            return null
        }
    })

    ipcMain.handle('backup-files', async (_, serial: string, sources: string[], destination: string) => {
        logger.command(`adb pull ${sources.join(' ')} -> ${destination}`)
        const result = await adbService?.pullFiles(serial, sources, destination, (progress) => {
            mainWindow?.webContents.send('backup-progress', progress)
        })
        if (result?.success) {
            logger.output(`Backup completed: ${sources.length} items`)
        } else {
            logger.error(`Backup failed with ${result?.errors.length} errors`)
        }
        return result
    })

    ipcMain.handle('cancel-backup', async () => {
        logger.command('Cancelling backup...')
        adbService?.cancelPull()
        logger.output('Backup cancelled by user')
    })

    ipcMain.handle('restore-files', async (_, serial: string, source: string, destination: string) => {
        return adbService?.pushFiles(serial, source, destination, (progress) => {
            mainWindow?.webContents.send('restore-progress', progress)
        })
    })

    ipcMain.handle('select-restore-source', async () => {
        try {
            const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openDirectory'],
                title: 'Select Folder to Restore'
            })
            return result.canceled ? null : result.filePaths[0]
        } catch (error) {
            logger.error(`File dialog error: ${error}`)
            return null
        }
    })

    // APK Installation
    ipcMain.handle('select-apk', async () => {
        try {
            const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openFile'],
                filters: [{ name: 'Android Package', extensions: ['apk'] }],
                title: 'Select APK to Install'
            })
            return result.canceled ? null : result.filePaths[0]
        } catch (error) {
            logger.error(`File dialog error: ${error}`)
            return null
        }
    })

    ipcMain.handle('install-apk', async (_, serial: string, apkPath: string) => {
        logger.command(`adb install ${apkPath}`)
        const result = await adbService?.installApk(serial, apkPath)
        if (result?.success) {
            logger.output(result.message)
        } else {
            logger.error(result?.message ?? 'Install failed')
        }
        return result
    })

    // Screen capture
    ipcMain.handle('screenshot', async (_, serial: string) => {
        try {
            const result = await dialog.showSaveDialog(mainWindow!, {
                title: 'Save Screenshot',
                defaultPath: `screenshot_${Date.now()}.png`,
                filters: [{ name: 'PNG Image', extensions: ['png'] }]
            })
            if (result.canceled || !result.filePath) return null
            return adbService?.screenshot(serial, result.filePath)
        } catch (error) {
            logger.error(`File dialog error: ${error}`)
            return null
        }
    })

    ipcMain.handle('screen-record', async (_, serial: string, duration: number) => {
        try {
            const result = await dialog.showSaveDialog(mainWindow!, {
                title: 'Save Screen Recording',
                defaultPath: `recording_${Date.now()}.mp4`,
                filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
            })
            if (result.canceled || !result.filePath) return null
            return adbService?.screenRecord(serial, result.filePath, duration)
        } catch (error) {
            logger.error(`File dialog error: ${error}`)
            return null
        }
    })

    ipcMain.handle('stop-screen-record', async (_, serial: string) => {
        if (!adbService) return
        try {
            // Kill the screenrecord process on the device
            await adbService.execDeviceShell(serial, 'pkill -2 screenrecord')
            logger.command('pkill -2 screenrecord')
        } catch {
            // Process may already have exited
        }
    })

    // Reboot
    ipcMain.handle('reboot', async (_, serial: string, mode: 'system' | 'recovery' | 'bootloader') => {
        return adbService?.reboot(serial, mode)
    })

    // Shell
    ipcMain.handle('open-shell', async (_, serial: string) => {
        return adbService?.openShell(serial)
    })

    // Utility
    ipcMain.handle('open-folder', async (_, path: string) => {
        shell.openPath(path)
    })

    ipcMain.handle('open-external', async (_, url: string) => {
        shell.openExternal(url)
    })

    ipcMain.handle('get-adb-status', async () => {
        return {
            ready: adbService !== null,
            path: adbService?.adbPath ?? null
        }
    })

    // ======== Power Tools IPC ========

    ipcMain.handle('list-packages', async (_, serial: string, includeSystem: boolean) => {
        if (!adbService) return []
        try {
            const flag = includeSystem ? '' : '-3'
            const output = await adbService.execDeviceShell(serial, `pm list packages ${flag}`)
            return output
                .replace(/\r\n/g, '\n')
                .split('\n')
                .filter(l => l.startsWith('package:'))
                .map(l => l.replace('package:', '').trim())
                .sort()
        } catch {
            return []
        }
    })

    ipcMain.handle('disable-package', async (_, serial: string, pkg: string) => {
        if (!adbService) return { success: false, message: 'ADB not ready' }
        try {
            const output = await adbService.execDeviceShell(serial, `pm disable-user --user 0 ${pkg}`)
            logger.command(`pm disable-user --user 0 ${pkg}`)
            logger.output(output)
            return { success: true, message: output }
        } catch (error: any) {
            logger.error(`Failed to disable ${pkg}: ${error.message}`)
            return { success: false, message: error.message ?? 'Failed' }
        }
    })

    ipcMain.handle('enable-package', async (_, serial: string, pkg: string) => {
        if (!adbService) return { success: false, message: 'ADB not ready' }
        try {
            const output = await adbService.execDeviceShell(serial, `pm enable ${pkg}`)
            logger.command(`pm enable ${pkg}`)
            logger.output(output)
            return { success: true, message: output }
        } catch (error: any) {
            logger.error(`Failed to enable ${pkg}: ${error.message}`)
            return { success: false, message: error.message ?? 'Failed' }
        }
    })

    ipcMain.handle('uninstall-package', async (_, serial: string, pkg: string) => {
        if (!adbService) return { success: false, message: 'ADB not ready' }
        try {
            const output = await adbService.execDeviceShell(serial, `pm uninstall ${pkg}`)
            logger.command(`pm uninstall ${pkg}`)
            logger.output(output)
            const success = output.toLowerCase().includes('success')
            return { success, message: output }
        } catch (error: any) {
            logger.error(`Failed to uninstall ${pkg}: ${error.message}`)
            return { success: false, message: error.message ?? 'Failed' }
        }
    })

    ipcMain.handle('send-key-event', async (_, serial: string, keycode: string) => {
        if (!adbService) return
        try {
            await adbService.execDeviceShell(serial, `input keyevent ${keycode}`)
            logger.command(`input keyevent ${keycode}`)
        } catch (error: any) {
            logger.error(`Key event failed: ${error.message}`)
        }
    })

    ipcMain.handle('reboot-advanced', async (_, serial: string, mode: string) => {
        if (!adbService) return
        try {
            if (mode === 'system') {
                await adbService.reboot(serial, 'system')
            } else if (mode === 'recovery') {
                await adbService.reboot(serial, 'recovery')
            } else if (mode === 'bootloader') {
                await adbService.reboot(serial, 'bootloader')
            } else if (mode === 'fastboot') {
                // reboot fastboot is effectively reboot bootloader on most devices,
                // but some have a separate fastboot mode
                await adbService.execDeviceShell(serial, 'reboot fastboot')
            }
            logger.command(`reboot ${mode}`)
        } catch (error: any) {
            logger.error(`Reboot failed: ${error.message}`)
            throw error
        }
    })

    ipcMain.handle('run-logcat', async (_, serial: string, filter: string) => {
        if (!adbService) return ''
        try {
            const filterArg = filter ? `-s ${filter}` : ''
            const output = await adbService.execDeviceShell(serial, `logcat -d -t 500 ${filterArg}`)
            logger.command(`logcat -d -t 500 ${filterArg}`)
            return output
        } catch (error: any) {
            logger.error(`Logcat failed: ${error.message}`)
            return `Error: ${error.message}`
        }
    })

    // Wireless ADB
    ipcMain.handle('connect-wireless', async (_, ip: string, port: number) => {
        if (!adbService) return { success: false, message: 'ADB not ready' }
        logger.command(`adb connect ${ip}:${port}`)
        const result = await adbService.connectWireless(ip, port)
        if (result.success) logger.output(result.message)
        else logger.error(result.message)
        return result
    })

    ipcMain.handle('disconnect-wireless', async (_, ip: string, port: number) => {
        if (!adbService) return
        logger.command(`adb disconnect ${ip}:${port}`)
        await adbService.disconnectWireless(ip, port)
    })

    ipcMain.handle('pair-device', async (_, ip: string, port: number, pairingCode: string) => {
        if (!adbService) return { success: false, message: 'ADB not ready' }
        logger.command(`adb pair ${ip}:${port}`)
        const result = await adbService.pairDevice(ip, port, pairingCode)
        if (result.success) logger.output(result.message)
        else logger.error(result.message)
        return result
    })

    // Raw ADB command execution
    ipcMain.handle('exec-raw-adb', async (_, args: string[]) => {
        if (!adbService) return { stdout: '', stderr: 'ADB not ready', success: false }
        logger.command(`adb ${args.join(' ')}`)
        const result = await adbService.execRawCommand(args)
        if (result.stdout) logger.output(result.stdout)
        if (result.stderr) logger.error(result.stderr)
        return result
    })

    // Auto-updater
    ipcMain.handle('check-for-updates', async () => {
        try {
            const result = await autoUpdater.checkForUpdates()
            return { available: !!result?.updateInfo, info: result?.updateInfo ?? null }
        } catch {
            return { available: false, info: null }
        }
    })

    ipcMain.handle('install-update', () => {
        autoUpdater.quitAndInstall()
    })

    ipcMain.handle('push-to-device', async (_, serial: string, destination: string) => {
        if (!adbService) return { success: false, message: 'ADB not ready' }
        try {
            const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openFile', 'multiSelections'],
                title: 'Select Files to Push'
            })
            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, message: 'No files selected' }
            }

            const errors: string[] = []
            for (const filePath of result.filePaths) {
                try {
                    logger.command(`adb push ${filePath} -> ${destination}`)
                    await adbService.pushFiles(serial, filePath, destination, (progress) => {
                        mainWindow?.webContents.send('backup-progress', progress)
                    })
                } catch (error: any) {
                    errors.push(`${filePath}: ${error.message}`)
                }
            }

            if (errors.length === 0) {
                logger.output(`Pushed ${result.filePaths.length} file(s) to ${destination}`)
                return { success: true, message: `Pushed ${result.filePaths.length} file(s)` }
            } else {
                logger.error(`Push completed with ${errors.length} error(s)`)
                return { success: false, message: errors.join('\n') }
            }
        } catch (error: any) {
            return { success: false, message: error.message ?? 'Push failed' }
        }
    })
}

app.whenReady().then(async () => {
    setupIpcHandlers()
    await createWindow()
    try {
        await initializeAdb()
    } catch (error) {
        logger.error(`ADB initialization failed: ${error}`)
        mainWindow?.webContents.send('adb-init-error', String(error))
    }

    // Wire auto-updater events to renderer
    autoUpdater.on('update-available', (info) => {
        mainWindow?.webContents.send('update-available', info)
    })
    autoUpdater.on('update-downloaded', (info) => {
        mainWindow?.webContents.send('update-downloaded', info)
    })
    autoUpdater.on('error', (err) => {
        logger.error(`Auto-updater error: ${err.message}`)
    })

    // Check for updates silently in background (only in production)
    if (process.env.NODE_ENV !== 'development') {
        autoUpdater.checkForUpdates().catch(() => { /* ignore update check failures */ })
    }
})

app.on('window-all-closed', () => {
    deviceMonitor?.stop()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow()
    }
})
