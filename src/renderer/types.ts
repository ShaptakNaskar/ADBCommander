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

export interface Toast {
    id: string
    type: 'success' | 'error' | 'info' | 'warning'
    message: string
}

export interface LogEntry {
    type: 'command' | 'output' | 'error' | 'info'
    message: string
}

declare global {
    interface Window {
        adb: {
            getDevices: () => Promise<DeviceInfo[]>
            getDeviceInfo: (serial: string) => Promise<DeviceInfo>
            onDevicesUpdated: (callback: (devices: DeviceInfo[]) => void) => () => void
            listFiles: (serial: string, path: string) => Promise<FileEntry[]>
            getCommonFolders: (serial: string) => Promise<FileEntry[]>
            selectBackupDestination: () => Promise<string | null>
            backupFiles: (serial: string, sources: string[], destination: string) => Promise<{ success: boolean; errors: string[] }>
            onBackupProgress: (callback: (progress: ProgressInfo) => void) => () => void
            cancelBackup: () => Promise<void>
            selectRestoreSource: () => Promise<string | null>
            restoreFiles: (serial: string, source: string, destination: string) => Promise<{ success: boolean; errors: string[] }>
            onRestoreProgress: (callback: (progress: ProgressInfo) => void) => () => void
            selectApk: () => Promise<string | null>
            installApk: (serial: string, apkPath: string) => Promise<{ success: boolean; message: string }>
            screenshot: (serial: string) => Promise<{ success: boolean; path: string } | null>
            screenRecord: (serial: string, duration: number) => Promise<{ success: boolean; path: string } | null>
            stopScreenRecord: (serial: string) => Promise<void>
            reboot: (serial: string, mode: 'system' | 'recovery' | 'bootloader') => Promise<void>
            openShell: (serial: string) => Promise<void>
            connectWireless: (ip: string, port: number) => Promise<{ success: boolean; message: string }>
            disconnectWireless: (ip: string, port: number) => Promise<void>
            pairDevice: (ip: string, port: number, pairingCode: string) => Promise<{ success: boolean; message: string }>
            execRawAdb: (args: string[]) => Promise<{ stdout: string; stderr: string; success: boolean }>
            openFolder: (path: string) => Promise<void>
            getAdbStatus: () => Promise<{ ready: boolean; path: string | null }>
            onCommandLog: (callback: (logEntry: LogEntry) => void) => () => void
            openExternal: (url: string) => Promise<void>

            // Power tools
            listPackages: (serial: string, includeSystem: boolean) => Promise<string[]>
            disablePackage: (serial: string, pkg: string) => Promise<{ success: boolean; message: string }>
            enablePackage: (serial: string, pkg: string) => Promise<{ success: boolean; message: string }>
            uninstallPackage: (serial: string, pkg: string) => Promise<{ success: boolean; message: string }>
            sendKeyEvent: (serial: string, keycode: string) => Promise<void>
            rebootAdvanced: (serial: string, mode: string) => Promise<void>
            runLogcat: (serial: string, filter: string) => Promise<string>
            pushToDevice: (serial: string, destination: string) => Promise<{ success: boolean; message: string }>

            // Auto-updater
            checkForUpdates: () => Promise<{ available: boolean; info: { version: string; releaseNotes?: string } | null }>
            installUpdate: () => Promise<void>
            onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => () => void
            onUpdateDownloaded: (callback: (info: { version: string; releaseNotes?: string }) => void) => () => void
        }
    }
}

