import { useState } from 'react'
import { Wifi, Loader2, Link, Unlink, KeyRound, ChevronRight } from 'lucide-react'
import type { Toast } from '../../types'
import './WirelessConnect.css'

interface WirelessConnectProps {
    onToast: (toast: Omit<Toast, 'id'>) => void
}

type Tab = 'pair' | 'connect'

export function WirelessConnect({ onToast }: WirelessConnectProps) {
    const [tab, setTab] = useState<Tab>('pair')

    // Pair tab state
    const [pairIp, setPairIp] = useState('')
    const [pairPort, setPairPort] = useState('')
    const [pairCode, setPairCode] = useState('')
    const [isPairing, setIsPairing] = useState(false)
    const [pairedIp, setPairedIp] = useState('')

    // Connect tab state
    const [connectIp, setConnectIp] = useState('')
    const [connectPort, setConnectPort] = useState('5555')
    const [isConnecting, setIsConnecting] = useState(false)
    const [connectedDevices, setConnectedDevices] = useState<string[]>([])

    const handlePair = async () => {
        if (!pairIp.trim() || !pairPort.trim() || !pairCode.trim()) {
            onToast({ type: 'warning', message: 'Please fill in all pairing fields' })
            return
        }
        setIsPairing(true)
        try {
            const result = await window.adb.pairDevice(pairIp.trim(), parseInt(pairPort), pairCode.trim())
            if (result.success) {
                onToast({ type: 'success', message: `Paired with ${pairIp}` })
                setPairedIp(pairIp.trim())
                setPairCode('')
            } else {
                onToast({ type: 'error', message: result.message || 'Pairing failed' })
            }
        } catch {
            onToast({ type: 'error', message: 'Pairing failed' })
        } finally {
            setIsPairing(false)
        }
    }

    const handleConnect = async () => {
        const ip = connectIp.trim() || pairedIp
        if (!ip) {
            onToast({ type: 'warning', message: 'Please enter an IP address' })
            return
        }
        const port = parseInt(connectPort) || 5555
        const address = `${ip}:${port}`
        setIsConnecting(true)
        try {
            const result = await window.adb.connectWireless(ip, port)
            if (result.success) {
                onToast({ type: 'success', message: `Connected to ${address}` })
                if (!connectedDevices.includes(address)) {
                    setConnectedDevices(prev => [...prev, address])
                }
                if (!connectIp) setConnectIp(ip)
            } else {
                onToast({ type: 'error', message: result.message || 'Connection failed' })
            }
        } catch {
            onToast({ type: 'error', message: 'Connection failed' })
        } finally {
            setIsConnecting(false)
        }
    }

    const handleDisconnect = async (address: string) => {
        const [ip, portStr] = address.split(':')
        try {
            await window.adb.disconnectWireless(ip, parseInt(portStr))
            setConnectedDevices(prev => prev.filter(d => d !== address))
            onToast({ type: 'info', message: `Disconnected from ${address}` })
        } catch {
            onToast({ type: 'error', message: 'Disconnect failed' })
        }
    }

    return (
        <div className="wireless-connect">
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon"><Wifi /></div>
                    <div className="header-text">
                        <h1>Wireless ADB</h1>
                        <p>Connect to Android devices over Wi-Fi</p>
                    </div>
                </div>
            </header>

            <div className="wireless-content">
                <div className="wireless-tabs">
                    <button
                        className={`wireless-tab ${tab === 'pair' ? 'active' : ''}`}
                        onClick={() => setTab('pair')}
                    >
                        <KeyRound size={16} />
                        Pair &amp; Connect
                        <span className="tab-badge">Android 11+</span>
                    </button>
                    <button
                        className={`wireless-tab ${tab === 'connect' ? 'active' : ''}`}
                        onClick={() => setTab('connect')}
                    >
                        <Link size={16} />
                        Simple Connect
                    </button>
                </div>

                {tab === 'pair' ? (
                    <div className="tab-content">
                        <section className="connect-section">
                            <div className="step-header">
                                <span className="step-num">1</span>
                                <h2>Pair Device</h2>
                            </div>
                            <p className="step-desc">
                                On your device: <strong>Settings → Developer Options → Wireless Debugging → Pair device with pairing code</strong>
                            </p>
                            <div className="connect-form">
                                <div className="input-group" style={{ flex: 2 }}>
                                    <label>IP Address</label>
                                    <input
                                        type="text"
                                        value={pairIp}
                                        onChange={e => setPairIp(e.target.value)}
                                        placeholder="192.168.1.100"
                                        disabled={isPairing}
                                    />
                                </div>
                                <div className="input-group port-input">
                                    <label>Pairing Port</label>
                                    <input
                                        type="text"
                                        value={pairPort}
                                        onChange={e => setPairPort(e.target.value)}
                                        placeholder="37000"
                                        disabled={isPairing}
                                    />
                                </div>
                                <div className="input-group port-input" style={{ flex: '0 0 120px', minWidth: '120px' }}>
                                    <label>Pairing Code</label>
                                    <input
                                        type="text"
                                        value={pairCode}
                                        onChange={e => setPairCode(e.target.value)}
                                        placeholder="123456"
                                        maxLength={6}
                                        disabled={isPairing}
                                        onKeyDown={e => e.key === 'Enter' && handlePair()}
                                    />
                                </div>
                                <button className="connect-btn" onClick={handlePair} disabled={isPairing}>
                                    {isPairing ? <><Loader2 size={18} className="spin" />Pairing...</> : <><KeyRound size={18} />Pair</>}
                                </button>
                            </div>
                        </section>

                        <div className="step-divider">
                            <ChevronRight size={20} />
                        </div>

                        <section className="connect-section">
                            <div className="step-header">
                                <span className="step-num">2</span>
                                <h2>Connect</h2>
                            </div>
                            <p className="step-desc">
                                Use the <strong>IP address &amp; Port</strong> shown on the main Wireless Debugging screen (different from the pairing port).
                            </p>
                            <div className="connect-form">
                                <div className="input-group" style={{ flex: 2 }}>
                                    <label>IP Address</label>
                                    <input
                                        type="text"
                                        value={connectIp || pairedIp}
                                        onChange={e => setConnectIp(e.target.value)}
                                        placeholder={pairedIp || '192.168.1.100'}
                                        disabled={isConnecting}
                                    />
                                </div>
                                <div className="input-group port-input">
                                    <label>Connection Port</label>
                                    <input
                                        type="text"
                                        value={connectPort}
                                        onChange={e => setConnectPort(e.target.value)}
                                        placeholder="38000"
                                        disabled={isConnecting}
                                        onKeyDown={e => e.key === 'Enter' && handleConnect()}
                                    />
                                </div>
                                <button className="connect-btn" onClick={handleConnect} disabled={isConnecting}>
                                    {isConnecting ? <><Loader2 size={18} className="spin" />Connecting...</> : <><Link size={18} />Connect</>}
                                </button>
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="tab-content">
                        <section className="connect-section">
                            <h2>Connect to Device</h2>
                            <div className="connect-form">
                                <div className="input-group">
                                    <label>IP Address</label>
                                    <input
                                        type="text"
                                        value={connectIp}
                                        onChange={e => setConnectIp(e.target.value)}
                                        placeholder="192.168.1.100"
                                        disabled={isConnecting}
                                        onKeyDown={e => e.key === 'Enter' && handleConnect()}
                                    />
                                </div>
                                <div className="input-group port-input">
                                    <label>Port</label>
                                    <input
                                        type="text"
                                        value={connectPort}
                                        onChange={e => setConnectPort(e.target.value)}
                                        placeholder="5555"
                                        disabled={isConnecting}
                                        onKeyDown={e => e.key === 'Enter' && handleConnect()}
                                    />
                                </div>
                                <button className="connect-btn" onClick={handleConnect} disabled={isConnecting}>
                                    {isConnecting ? <><Loader2 size={18} className="spin" />Connecting...</> : <><Link size={18} />Connect</>}
                                </button>
                            </div>

                            <div className="help-text">
                                <h3>Setup (requires USB first):</h3>
                                <ol>
                                    <li>Connect device via USB with USB Debugging enabled</li>
                                    <li>Run <code>adb tcpip 5555</code> in a terminal</li>
                                    <li>Disconnect USB and enter the device IP above</li>
                                </ol>
                                <p><strong>Tip:</strong> Find device IP in Settings → About Phone → Status → IP Address</p>
                            </div>
                        </section>
                    </div>
                )}

                {connectedDevices.length > 0 && (
                    <section className="connected-section">
                        <h2>Connected Wireless Devices</h2>
                        <div className="connected-list">
                            {connectedDevices.map(address => (
                                <div key={address} className="connected-item">
                                    <Wifi size={18} className="wifi-icon" />
                                    <span className="address">{address}</span>
                                    <button className="disconnect-btn" onClick={() => handleDisconnect(address)}>
                                        <Unlink size={16} />
                                        Disconnect
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}
