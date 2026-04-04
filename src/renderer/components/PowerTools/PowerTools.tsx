import { useState, useRef, useEffect } from 'react'
import {
    Terminal,
    Package,
    VolumeX,
    Volume2,
    Power,
    RotateCcw,
    Wrench,
    HardDrive,
    ScrollText,
    Search,
    XCircle,
    Copy,
    Check,
    Loader2,
    Trash2,
    ChevronDown,
    ChevronUp,
    Upload,
    FolderUp
} from 'lucide-react'
import type { DeviceInfo, Toast } from '../../types'
import './PowerTools.css'

interface PowerToolsProps {
    device: DeviceInfo | null
    onToast: (toast: Omit<Toast, 'id'>) => void
}

export function PowerTools({ device, onToast }: PowerToolsProps) {
    const [packages, setPackages] = useState<string[]>([])
    const [packageFilter, setPackageFilter] = useState('')
    const [isLoadingPkgs, setIsLoadingPkgs] = useState(false)
    const [showSystemPkgs, setShowSystemPkgs] = useState(false)
    const [disablingPkg, setDisablingPkg] = useState<string | null>(null)
    const [enablingPkg, setEnablingPkg] = useState<string | null>(null)
    const [uninstallingPkg, setUninstallingPkg] = useState<string | null>(null)
    const [logcatOutput, setLogcatOutput] = useState<string[]>([])
    const [isLogcatRunning, setIsLogcatRunning] = useState(false)
    const [logcatFilter, setLogcatFilter] = useState('')
    const [showRebootConfirm, setShowRebootConfirm] = useState<string | null>(null)
    const [showUninstallConfirm, setShowUninstallConfirm] = useState<string | null>(null)
    const [copiedPkg, setCopiedPkg] = useState<string | null>(null)
    const [pushPath, setPushPath] = useState('/sdcard/')
    const [isPushing, setIsPushing] = useState(false)
    const [pkgSectionOpen, setPkgSectionOpen] = useState(true)
    const [inputSectionOpen, setInputSectionOpen] = useState(true)
    const [rebootSectionOpen, setRebootSectionOpen] = useState(true)
    const [logcatSectionOpen, setLogcatSectionOpen] = useState(false)
    const [pushSectionOpen, setPushSectionOpen] = useState(true)
    const logcatRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (logcatRef.current) {
            logcatRef.current.scrollTop = logcatRef.current.scrollHeight
        }
    }, [logcatOutput])

    const loadPackages = async () => {
        if (!device) return
        setIsLoadingPkgs(true)
        try {
            const pkgs = await window.adb.listPackages(device.serial, showSystemPkgs)
            setPackages(pkgs)
        } catch {
            onToast({ type: 'error', message: 'Failed to list packages' })
        } finally {
            setIsLoadingPkgs(false)
        }
    }

    const handleDisablePackage = async (pkg: string) => {
        if (!device) return
        setDisablingPkg(pkg)
        try {
            const result = await window.adb.disablePackage(device.serial, pkg)
            if (result.success) {
                onToast({ type: 'success', message: `Disabled ${pkg}` })
            } else {
                onToast({ type: 'error', message: result.message })
            }
        } catch {
            onToast({ type: 'error', message: `Failed to disable ${pkg}` })
        } finally {
            setDisablingPkg(null)
        }
    }

    const handleEnablePackage = async (pkg: string) => {
        if (!device) return
        setEnablingPkg(pkg)
        try {
            const result = await window.adb.enablePackage(device.serial, pkg)
            if (result.success) {
                onToast({ type: 'success', message: `Enabled ${pkg}` })
            } else {
                onToast({ type: 'error', message: result.message })
            }
        } catch {
            onToast({ type: 'error', message: `Failed to enable ${pkg}` })
        } finally {
            setEnablingPkg(null)
        }
    }

    const handleUninstallPackage = async (pkg: string) => {
        if (!device) return
        setShowUninstallConfirm(null)
        setUninstallingPkg(pkg)
        try {
            const result = await window.adb.uninstallPackage(device.serial, pkg)
            if (result.success) {
                onToast({ type: 'success', message: `Uninstalled ${pkg}` })
                setPackages(prev => prev.filter(p => p !== pkg))
            } else {
                onToast({ type: 'error', message: result.message })
            }
        } catch {
            onToast({ type: 'error', message: `Failed to uninstall ${pkg}` })
        } finally {
            setUninstallingPkg(null)
        }
    }

    const copyPkgName = async (pkg: string) => {
        await navigator.clipboard.writeText(pkg)
        setCopiedPkg(pkg)
        setTimeout(() => setCopiedPkg(null), 1500)
    }

    const sendKeyEvent = async (keycode: string, label: string) => {
        if (!device) return
        try {
            await window.adb.sendKeyEvent(device.serial, keycode)
            onToast({ type: 'info', message: `Sent ${label}` })
        } catch {
            onToast({ type: 'error', message: `Failed to send ${label}` })
        }
    }

    const handleReboot = async (mode: string) => {
        if (!device) return
        setShowRebootConfirm(null)
        onToast({ type: 'info', message: `Rebooting to ${mode}...` })
        try {
            await window.adb.rebootAdvanced(device.serial, mode)
            onToast({ type: 'success', message: `Rebooting to ${mode}` })
        } catch {
            onToast({ type: 'error', message: 'Reboot failed' })
        }
    }

    const startLogcat = async () => {
        if (!device) return
        setIsLogcatRunning(true)
        setLogcatOutput([])
        try {
            const output = await window.adb.runLogcat(device.serial, logcatFilter)
            setLogcatOutput(output.split('\n').filter((l: string) => l.trim()))
        } catch {
            onToast({ type: 'error', message: 'Logcat failed' })
        } finally {
            setIsLogcatRunning(false)
        }
    }

    const clearLogcat = () => {
        setLogcatOutput([])
    }

    const handlePushFiles = async () => {
        if (!device) return
        setIsPushing(true)
        try {
            const result = await window.adb.pushToDevice(device.serial, pushPath)
            if (result.success) {
                onToast({ type: 'success', message: `Files pushed to ${pushPath}` })
            } else {
                onToast({ type: 'error', message: result.message })
            }
        } catch {
            onToast({ type: 'error', message: 'Push failed' })
        } finally {
            setIsPushing(false)
        }
    }

    const filteredPackages = packages.filter(p =>
        p.toLowerCase().includes(packageFilter.toLowerCase())
    )

    if (!device) {
        return (
            <div className="power-tools">
                <div className="no-device">
                    <Terminal size={48} />
                    <h2>No Device Selected</h2>
                    <p>Select a device from the dashboard to use Power Tools</p>
                </div>
            </div>
        )
    }

    return (
        <div className="power-tools">
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon">
                        <Terminal />
                    </div>
                    <div className="header-text">
                        <h1>Power Tools</h1>
                        <p>Advanced operations for {device.model}</p>
                    </div>
                </div>
            </header>

            <div className="tools-content">
                {/* Push Files */}
                <section className="tool-section">
                    <button className="section-header" onClick={() => setPushSectionOpen(!pushSectionOpen)}>
                        <FolderUp size={20} />
                        <span>Push Files to Device</span>
                        {pushSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    {pushSectionOpen && (
                        <div className="section-body animate-in">
                            <div className="push-controls">
                                <div className="push-path-input">
                                    <label>Destination path on device:</label>
                                    <input
                                        type="text"
                                        value={pushPath}
                                        onChange={(e) => setPushPath(e.target.value)}
                                        placeholder="/sdcard/Download/"
                                        className="text-input"
                                    />
                                </div>
                                <button
                                    className="tool-btn primary"
                                    onClick={handlePushFiles}
                                    disabled={isPushing || !pushPath}
                                >
                                    {isPushing ? (
                                        <><Loader2 size={16} className="spin" /> Pushing...</>
                                    ) : (
                                        <><Upload size={16} /> Select & Push Files</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Package Manager */}
                <section className="tool-section">
                    <button className="section-header" onClick={() => setPkgSectionOpen(!pkgSectionOpen)}>
                        <Package size={20} />
                        <span>Package Manager</span>
                        {pkgSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    {pkgSectionOpen && (
                        <div className="section-body animate-in">
                            <div className="pkg-controls">
                                <button className="tool-btn" onClick={loadPackages} disabled={isLoadingPkgs}>
                                    {isLoadingPkgs ? (
                                        <><Loader2 size={16} className="spin" /> Loading...</>
                                    ) : (
                                        <><Package size={16} /> List Packages</>
                                    )}
                                </button>
                                <label className="toggle-label">
                                    <input
                                        type="checkbox"
                                        checked={showSystemPkgs}
                                        onChange={e => setShowSystemPkgs(e.target.checked)}
                                    />
                                    Include system packages
                                </label>
                            </div>

                            {packages.length > 0 && (
                                <>
                                    <div className="pkg-search">
                                        <Search size={16} />
                                        <input
                                            type="text"
                                            placeholder="Filter packages..."
                                            value={packageFilter}
                                            onChange={e => setPackageFilter(e.target.value)}
                                        />
                                        <span className="pkg-count">{filteredPackages.length} of {packages.length}</span>
                                    </div>
                                    <div className="pkg-list">
                                        {filteredPackages.slice(0, 200).map(pkg => (
                                            <div key={pkg} className="pkg-item">
                                                <span className="pkg-name">{pkg}</span>
                                                <div className="pkg-actions">
                                                    <button
                                                        className="pkg-btn copy"
                                                        onClick={() => copyPkgName(pkg)}
                                                        title="Copy package name"
                                                    >
                                                        {copiedPkg === pkg ? <Check size={14} /> : <Copy size={14} />}
                                                    </button>
                                                    <button
                                                        className="pkg-btn disable"
                                                        onClick={() => handleDisablePackage(pkg)}
                                                        disabled={disablingPkg === pkg || uninstallingPkg === pkg}
                                                        title="Disable package (no root)"
                                                    >
                                                        {disablingPkg === pkg ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />}
                                                    </button>
                                                    <button
                                                        className="pkg-btn enable"
                                                        onClick={() => handleEnablePackage(pkg)}
                                                        disabled={enablingPkg === pkg || uninstallingPkg === pkg}
                                                        title="Enable package"
                                                    >
                                                        {enablingPkg === pkg ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                                                    </button>
                                                    {!showSystemPkgs && (
                                                        <button
                                                            className="pkg-btn uninstall"
                                                            onClick={() => setShowUninstallConfirm(pkg)}
                                                            disabled={disablingPkg === pkg || uninstallingPkg === pkg}
                                                            title="Uninstall package"
                                                        >
                                                            {uninstallingPkg === pkg ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {filteredPackages.length > 200 && (
                                            <div className="pkg-overflow">
                                                Showing 200 of {filteredPackages.length}. Use filter to narrow down.
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </section>

                {/* Input Events */}
                <section className="tool-section">
                    <button className="section-header" onClick={() => setInputSectionOpen(!inputSectionOpen)}>
                        <Volume2 size={20} />
                        <span>Input Events</span>
                        {inputSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    {inputSectionOpen && (
                        <div className="section-body animate-in">
                            <div className="input-grid">
                                <button className="input-btn" onClick={() => sendKeyEvent('24', 'Volume Up')}>
                                    <Volume2 size={20} />
                                    <span>Volume Up</span>
                                </button>
                                <button className="input-btn" onClick={() => sendKeyEvent('25', 'Volume Down')}>
                                    <VolumeX size={20} />
                                    <span>Volume Down</span>
                                </button>
                                <button className="input-btn" onClick={() => sendKeyEvent('26', 'Power')}>
                                    <Power size={20} />
                                    <span>Power</span>
                                </button>
                                <button className="input-btn" onClick={() => sendKeyEvent('3', 'Home')}>
                                    <span className="key-label">⌂</span>
                                    <span>Home</span>
                                </button>
                                <button className="input-btn" onClick={() => sendKeyEvent('4', 'Back')}>
                                    <span className="key-label">←</span>
                                    <span>Back</span>
                                </button>
                                <button className="input-btn" onClick={() => sendKeyEvent('187', 'Recents')}>
                                    <span className="key-label">▢</span>
                                    <span>Recents</span>
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Reboot Options */}
                <section className="tool-section">
                    <button className="section-header" onClick={() => setRebootSectionOpen(!rebootSectionOpen)}>
                        <Power size={20} />
                        <span>Reboot Options</span>
                        {rebootSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    {rebootSectionOpen && (
                        <div className="section-body animate-in">
                            <div className="reboot-grid">
                                <button className="reboot-btn" onClick={() => setShowRebootConfirm('system')}>
                                    <RotateCcw size={20} />
                                    <span>System</span>
                                </button>
                                <button className="reboot-btn" onClick={() => setShowRebootConfirm('recovery')}>
                                    <Wrench size={20} />
                                    <span>Recovery</span>
                                </button>
                                <button className="reboot-btn" onClick={() => setShowRebootConfirm('bootloader')}>
                                    <HardDrive size={20} />
                                    <span>Bootloader</span>
                                </button>
                                <button className="reboot-btn danger" onClick={() => setShowRebootConfirm('fastboot')}>
                                    <Terminal size={20} />
                                    <span>Fastboot</span>
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Logcat */}
                <section className="tool-section">
                    <button className="section-header" onClick={() => setLogcatSectionOpen(!logcatSectionOpen)}>
                        <ScrollText size={20} />
                        <span>Logcat</span>
                        {logcatSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    {logcatSectionOpen && (
                        <div className="section-body animate-in">
                            <div className="logcat-controls">
                                <input
                                    type="text"
                                    value={logcatFilter}
                                    onChange={e => setLogcatFilter(e.target.value)}
                                    placeholder="Filter tag (e.g. ActivityManager)"
                                    className="text-input"
                                />
                                <button
                                    className="tool-btn"
                                    onClick={startLogcat}
                                    disabled={isLogcatRunning}
                                >
                                    {isLogcatRunning ? (
                                        <><Loader2 size={16} className="spin" /> Running...</>
                                    ) : (
                                        <><ScrollText size={16} /> Capture Logcat</>
                                    )}
                                </button>
                                <button className="tool-btn danger" onClick={clearLogcat} title="Clear">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div className="logcat-output" ref={logcatRef}>
                                {logcatOutput.length === 0 ? (
                                    <div className="logcat-empty">
                                        Logcat output will appear here. Captures ~500 most recent lines.
                                    </div>
                                ) : (
                                    logcatOutput.map((line, i) => (
                                        <div key={i} className={`logcat-line ${line.includes(' E ') ? 'error' : line.includes(' W ') ? 'warn' : ''}`}>
                                            {line}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {/* Reboot Confirmation Modal */}
            {showRebootConfirm && (
                <div className="modal-overlay" onClick={() => setShowRebootConfirm(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-icon warning">
                            <Power size={32} />
                        </div>
                        <h3>Confirm Reboot</h3>
                        <p>Reboot device to <strong>{showRebootConfirm}</strong>?</p>
                        <div className="modal-actions">
                            <button className="modal-btn cancel" onClick={() => setShowRebootConfirm(null)}>
                                Cancel
                            </button>
                            <button className="modal-btn confirm" onClick={() => handleReboot(showRebootConfirm)}>
                                Reboot
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Uninstall Confirmation Modal */}
            {showUninstallConfirm && (
                <div className="modal-overlay" onClick={() => setShowUninstallConfirm(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-icon danger">
                            <Trash2 size={32} />
                        </div>
                        <h3>Confirm Uninstall</h3>
                        <p>Uninstall <strong>{showUninstallConfirm}</strong>? This cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="modal-btn cancel" onClick={() => setShowUninstallConfirm(null)}>
                                Cancel
                            </button>
                            <button className="modal-btn confirm danger" onClick={() => handleUninstallPackage(showUninstallConfirm)}>
                                Uninstall
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
