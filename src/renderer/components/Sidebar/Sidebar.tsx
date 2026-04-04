import {
    Smartphone,
    HardDrive,
    Zap,
    Terminal,
    ScrollText,
    Home,
    Info,
    Wifi,
    TerminalSquare
} from 'lucide-react'
import type { DeviceInfo } from '../../types'
import './Sidebar.css'

type View = 'welcome' | 'dashboard' | 'backup' | 'actions' | 'powertools' | 'wireless' | 'adbshell' | 'console' | 'about'

interface SidebarProps {
    currentView: string
    onViewChange: (view: View) => void
    deviceCount: number
    selectedDevice: DeviceInfo | null
    adbReady: boolean
}

export function Sidebar({ currentView, onViewChange, deviceCount, selectedDevice, adbReady }: SidebarProps) {
    const navItems = [
        { id: 'welcome', icon: Home, label: 'Welcome' },
        { id: 'dashboard', icon: Smartphone, label: 'Devices', badge: deviceCount > 0 ? deviceCount : undefined },
        { id: 'backup', icon: HardDrive, label: 'Backup & Restore', disabled: !selectedDevice },
        { id: 'actions', icon: Zap, label: 'Quick Actions', disabled: !selectedDevice },
        { id: 'powertools', icon: Terminal, label: 'Power Tools', disabled: !selectedDevice },
        { id: 'wireless', icon: Wifi, label: 'Wireless ADB' },
        { id: 'adbshell', icon: TerminalSquare, label: 'ADB Terminal' },
        { id: 'console', icon: ScrollText, label: 'Console' },
        { id: 'about', icon: Info, label: 'About' }
    ]

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="logo">
                    <Terminal className="logo-icon" />
                    <span className="logo-text">ADB Commander</span>
                </div>
                <div className={`adb-status ${adbReady ? 'ready' : 'loading'}`}>
                    <span className="status-dot" />
                    <span className="status-text">{adbReady ? 'ADB Ready' : 'Loading...'}</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        className={`nav-item ${currentView === item.id ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
                        onClick={() => !item.disabled && onViewChange(item.id as View)}
                        disabled={item.disabled}
                    >
                        <item.icon className="nav-icon" />
                        <span className="nav-label">{item.label}</span>
                        {item.badge && <span className="nav-badge">{item.badge}</span>}
                    </button>
                ))}
            </nav>

            {selectedDevice && (
                <div className="sidebar-footer">
                    <div className="selected-device">
                        <div className="device-icon">
                            <Smartphone size={16} />
                        </div>
                        <div className="device-info">
                            <span className="device-model">{selectedDevice.model}</span>
                            <span className="device-serial">{selectedDevice.serial}</span>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    )
}
