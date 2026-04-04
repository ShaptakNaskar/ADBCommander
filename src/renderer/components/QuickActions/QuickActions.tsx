import { useState, useEffect, useRef } from 'react'
import {
    Zap,
    Package,
    Camera,
    Video,
    Upload,
    Square
} from 'lucide-react'
import type { DeviceInfo, Toast } from '../../types'
import './QuickActions.css'

interface QuickActionsProps {
    device: DeviceInfo | null
    onToast: (toast: Omit<Toast, 'id'>) => void
}

export function QuickActions({ device, onToast }: QuickActionsProps) {
    const [isRecording, setIsRecording] = useState(false)
    const [recordMode, setRecordMode] = useState<'timed' | 'manual'>('manual')
    const [recordDuration, setRecordDuration] = useState(30)
    const [recordElapsed, setRecordElapsed] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [])

    const handleInstallApk = async () => {
        if (!device) return

        const apkPath = await window.adb.selectApk()
        if (!apkPath) return

        onToast({ type: 'info', message: 'Installing APK...' })

        try {
            const result = await window.adb.installApk(device.serial, apkPath)
            if (result.success) {
                onToast({ type: 'success', message: 'APK installed successfully!' })
            } else {
                onToast({ type: 'error', message: `Installation failed: ${result.message}` })
            }
        } catch {
            onToast({ type: 'error', message: 'APK installation failed' })
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        if (!device) return

        const files = Array.from(e.dataTransfer.files)
        const apkFile = files.find(f => f.name.endsWith('.apk'))

        if (!apkFile) {
            onToast({ type: 'warning', message: 'Please drop an APK file' })
            return
        }

        onToast({ type: 'info', message: `Installing ${apkFile.name}...` })

        try {
            const result = await window.adb.installApk(device.serial, (apkFile as any).path)
            if (result.success) {
                onToast({ type: 'success', message: 'APK installed successfully!' })
            } else {
                onToast({ type: 'error', message: `Installation failed: ${result.message}` })
            }
        } catch {
            onToast({ type: 'error', message: 'APK installation failed' })
        }
    }

    const handleScreenshot = async () => {
        if (!device) return

        try {
            const result = await window.adb.screenshot(device.serial)
            if (result) {
                onToast({ type: 'success', message: 'Screenshot saved!' })
                await window.adb.openFolder(result.path)
            }
        } catch {
            onToast({ type: 'error', message: 'Screenshot failed' })
        }
    }

    const handleStartRecording = async () => {
        if (!device) return

        setIsRecording(true)
        setRecordElapsed(0)

        // Start elapsed timer
        timerRef.current = setInterval(() => {
            setRecordElapsed(prev => prev + 1)
        }, 1000)

        const duration = recordMode === 'timed' ? recordDuration : 180 // max 3 min for manual

        onToast({ type: 'info', message: recordMode === 'manual' ? 'Recording started — click Stop when done' : `Recording for ${recordDuration}s...` })

        try {
            const result = await window.adb.screenRecord(device.serial, duration)
            if (result) {
                onToast({ type: 'success', message: 'Recording saved!' })
                await window.adb.openFolder(result.path)
            }
        } catch {
            onToast({ type: 'error', message: 'Screen recording failed' })
        } finally {
            setIsRecording(false)
            setRecordElapsed(0)
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
        }
    }

    const handleStopRecording = async () => {
        if (!device) return
        try {
            await window.adb.stopScreenRecord(device.serial)
        } catch {
            // Process may already have stopped
        }
    }

    const formatElapsed = (seconds: number): string => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    if (!device) {
        return (
            <div className="quick-actions">
                <div className="no-device">
                    <Zap size={48} />
                    <h2>No Device Selected</h2>
                    <p>Select a device from the dashboard to perform quick actions</p>
                </div>
            </div>
        )
    }

    return (
        <div className="quick-actions">
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon">
                        <Zap />
                    </div>
                    <div className="header-text">
                        <h1>Quick Actions</h1>
                        <p>One-click operations for {device.model}</p>
                    </div>
                </div>
            </header>

            <div className="actions-content">
                {/* APK Install */}
                <section className="action-section">
                    <h2><Package size={20} /> Install APK</h2>
                    <div
                        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={handleInstallApk}
                    >
                        <Upload size={32} />
                        <span className="drop-title">Drag & drop APK here</span>
                        <span className="drop-subtitle">or click to browse</span>
                    </div>
                </section>

                {/* Screen Capture */}
                <section className="action-section">
                    <h2><Camera size={20} /> Screen Capture</h2>

                    <div className="capture-grid">
                        <button className="capture-card" onClick={handleScreenshot}>
                            <Camera size={28} />
                            <span className="capture-label">Screenshot</span>
                            <span className="capture-desc">Capture current screen</span>
                        </button>

                        <div className="capture-card record-card">
                            <div className="record-header-row">
                                <Video size={28} />
                                <span className="capture-label">Screen Record</span>
                            </div>

                            <div className="record-mode-toggle">
                                <button
                                    className={`mode-btn ${recordMode === 'manual' ? 'active' : ''}`}
                                    onClick={() => setRecordMode('manual')}
                                    disabled={isRecording}
                                >
                                    Manual
                                </button>
                                <button
                                    className={`mode-btn ${recordMode === 'timed' ? 'active' : ''}`}
                                    onClick={() => setRecordMode('timed')}
                                    disabled={isRecording}
                                >
                                    Timed
                                </button>
                            </div>

                            {recordMode === 'timed' && (
                                <div className="duration-selector">
                                    <label>Duration:</label>
                                    <select
                                        value={recordDuration}
                                        onChange={(e) => setRecordDuration(Number(e.target.value))}
                                        disabled={isRecording}
                                    >
                                        <option value={10}>10 seconds</option>
                                        <option value={30}>30 seconds</option>
                                        <option value={60}>1 minute</option>
                                        <option value={120}>2 minutes</option>
                                        <option value={180}>3 minutes (max)</option>
                                    </select>
                                </div>
                            )}

                            {isRecording ? (
                                <div className="recording-controls">
                                    <div className="recording-indicator">
                                        <span className="rec-dot" />
                                        <span className="rec-time">{formatElapsed(recordElapsed)}</span>
                                    </div>
                                    <button className="stop-btn" onClick={handleStopRecording}>
                                        <Square size={16} />
                                        Stop Recording
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className="record-btn"
                                    onClick={handleStartRecording}
                                >
                                    Start Recording
                                </button>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
