import { useState, useEffect, useCallback } from 'react'
import { Dashboard } from './components/Dashboard/Dashboard'
import { Sidebar } from './components/Sidebar/Sidebar'
import { BackupRestore } from './components/BackupRestore/BackupRestore'
import { QuickActions } from './components/QuickActions/QuickActions'
import { Welcome } from './components/Welcome/Welcome'
import { About } from './components/About/About'
import { PowerTools } from './components/PowerTools/PowerTools'
import { Console, LogEntry } from './components/Console/Console'
import { WirelessConnect } from './components/WirelessConnect/WirelessConnect'
import { AdbTerminal } from './components/AdbTerminal/AdbTerminal'

import { Toaster, Toast } from './components/Toast/Toast'
import { BackupOverlay } from './components/BackupOverlay/BackupOverlay'
import type { DeviceInfo, ProgressInfo } from './types'

type View = 'welcome' | 'dashboard' | 'backup' | 'actions' | 'powertools' | 'wireless' | 'adbshell' | 'console' | 'about'

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.adb !== undefined

export default function App() {
    const [devices, setDevices] = useState<DeviceInfo[]>([])
    const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null)
    const [currentView, setCurrentView] = useState<View>('welcome')
    const [adbReady, setAdbReady] = useState(false)
    const [toasts, setToasts] = useState<Toast[]>([])
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [backupActive, setBackupActive] = useState(false)
    const [backupProgress, setBackupProgress] = useState<ProgressInfo>({
        current: 0, total: 0, currentFile: '', speed: '', eta: '',
        overallPercent: 0, filePercent: 0, elapsed: 0
    })
    const [overlayDismissed, setOverlayDismissed] = useState(false)
    const [updateDownloaded, setUpdateDownloaded] = useState<{ version: string } | null>(null)

    const addLog = useCallback((type: LogEntry['type'], message: string) => {
        setLogs(prev => [...prev, {
            id: Date.now().toString() + Math.random(),
            timestamp: new Date(),
            type,
            message
        }])
    }, [])

    const clearLogs = useCallback(() => {
        setLogs([])
    }, [])

    // Show error if not in Electron
    if (!isElectron) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: '#0a0a0f',
                color: '#f4f4f5',
                fontFamily: 'Inter, sans-serif',
                textAlign: 'center',
                padding: '20px'
            }}>
                <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>⚡ ADB Commander</h1>
                <p style={{ color: '#a1a1aa', maxWidth: '400px' }}>
                    This application must be run inside Electron.
                    Please launch the app using <code style={{ color: '#8b5cf6' }}>npm run dev</code> or the packaged executable.
                </p>
            </div>
        )
    }

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Date.now().toString()
        setToasts(prev => [...prev, { ...toast, id }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 5000)
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    useEffect(() => {
        // Check ADB status
        window.adb.getAdbStatus().then(status => {
            setAdbReady(status.ready)
            if (!status.ready) {
                addToast({ type: 'info', message: 'Downloading ADB binaries...' })
            }
        })

        // Subscribe to device updates
        const unsubscribe = window.adb.onDevicesUpdated((updatedDevices) => {
            setDevices(updatedDevices)
            setAdbReady(true)

            // Auto-select first device if none selected
            if (!selectedDevice && updatedDevices.length > 0) {
                setSelectedDevice(updatedDevices[0])
            }

            // Update selected device info
            if (selectedDevice) {
                const updated = updatedDevices.find(d => d.serial === selectedDevice.serial)
                if (updated) {
                    setSelectedDevice(updated)
                } else if (updatedDevices.length > 0) {
                    setSelectedDevice(updatedDevices[0])
                } else {
                    setSelectedDevice(null)
                }
            }
        })

        // Initial device fetch
        window.adb.getDevices().then(setDevices)

        // Subscribe to command logs
        const unsubscribeLogs = window.adb.onCommandLog?.((logEntry) => {
            addLog(logEntry.type, logEntry.message)
        })

        // Subscribe to backup progress at app level for overlay
        const unsubscribeBackup = window.adb.onBackupProgress((progress) => {
            setBackupActive(true)
            setBackupProgress(progress)
            setOverlayDismissed(false)

            // Auto-deactivate when backup completes
            if (progress.current === progress.total && progress.overallPercent === 100) {
                setTimeout(() => setBackupActive(false), 2000)
            }
        })

        // Subscribe to auto-updater events
        const unsubscribeUpdateAvailable = window.adb.onUpdateAvailable?.((info) => {
            addToast({ type: 'info', message: `Update v${info.version} is downloading...` })
        })

        const unsubscribeUpdateDownloaded = window.adb.onUpdateDownloaded?.((info) => {
            setUpdateDownloaded({ version: info.version })
        })

        return () => {
            unsubscribe()
            unsubscribeLogs?.()
            unsubscribeBackup()
            unsubscribeUpdateAvailable?.()
            unsubscribeUpdateDownloaded?.()
        }
    }, [selectedDevice, addToast, addLog])

    const renderContent = () => {
        switch (currentView) {
            case 'welcome':
                return (
                    <Welcome
                        onNavigate={(view) => setCurrentView(view as View)}
                        hasDevice={devices.length > 0}
                    />
                )
            case 'dashboard':
                return (
                    <Dashboard
                        devices={devices}
                        selectedDevice={selectedDevice}
                        onSelectDevice={setSelectedDevice}
                        onToast={addToast}
                    />
                )
            case 'backup':
                return (
                    <BackupRestore
                        device={selectedDevice}
                        onToast={addToast}
                    />
                )
            case 'actions':
                return (
                    <QuickActions
                        device={selectedDevice}
                        onToast={addToast}
                    />
                )
            case 'powertools':
                return (
                    <PowerTools
                        device={selectedDevice}
                        onToast={addToast}
                    />
                )
            case 'wireless':
                return <WirelessConnect onToast={addToast} />
            case 'adbshell':
                return (
                    <AdbTerminal
                        device={selectedDevice}
                        onToast={addToast}
                    />
                )
            case 'console':
                return (
                    <Console
                        logs={logs}
                        onClearLogs={clearLogs}
                    />
                )
            case 'about':
                return (
                    <About
                        onOpenExternal={(url) => window.adb.openExternal(url)}
                    />
                )
            default:
                return null
        }
    }

    return (
        <div className="app">
            {updateDownloaded && (
                <div className="update-banner">
                    <span>Update v{updateDownloaded.version} ready to install</span>
                    <button onClick={() => window.adb.installUpdate()}>Restart &amp; Install</button>
                    <button className="dismiss" onClick={() => setUpdateDownloaded(null)}>✕</button>
                </div>
            )}
            <div className="app-container">
                <Sidebar
                    currentView={currentView}
                    onViewChange={setCurrentView}
                    deviceCount={devices.length}
                    selectedDevice={selectedDevice}
                    adbReady={adbReady}
                />
                <main className="main-content" key={currentView}>
                    <div className="page-transition">
                        {renderContent()}
                    </div>
                </main>
            </div>
            <Toaster toasts={toasts} onRemove={removeToast} />
            {backupActive && currentView !== 'backup' && !overlayDismissed && (
                <BackupOverlay
                    progress={backupProgress}
                    onNavigate={() => setCurrentView('backup')}
                    onDismiss={() => setOverlayDismissed(true)}
                />
            )}
        </div>
    )
}
