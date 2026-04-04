import { useState, useEffect, useRef, useCallback } from 'react'
import { TerminalSquare, Send, Trash2, Loader2, ChevronRight } from 'lucide-react'
import type { DeviceInfo, Toast } from '../../types'
import './AdbTerminal.css'

interface AdbTerminalProps {
    device: DeviceInfo | null
    onToast: (toast: Omit<Toast, 'id'>) => void
}

interface HistoryEntry {
    cmd: string
    stdout: string
    stderr: string
    success: boolean
}

export function AdbTerminal({ device }: AdbTerminalProps) {
    const [input, setInput] = useState('')
    const [output, setOutput] = useState<HistoryEntry[]>([])
    const [cmdHistory, setCmdHistory] = useState<string[]>([])
    const [historyIdx, setHistoryIdx] = useState(-1)
    const [autoTarget, setAutoTarget] = useState(true)
    const [isRunning, setIsRunning] = useState(false)
    const outputRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight
        }
    }, [output])

    const runCommand = useCallback(async () => {
        const raw = input.trim()
        if (!raw || isRunning) return

        // Split on whitespace, respecting quoted strings
        const args = raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []

        // Prepend device selector if auto-targeting and device is selected
        const finalArgs = autoTarget && device ? ['-s', device.serial, ...args] : args
        const displayCmd = `adb ${finalArgs.join(' ')}`

        setIsRunning(true)
        setCmdHistory(prev => [raw, ...prev])
        setHistoryIdx(-1)
        setInput('')

        try {
            const result = await window.adb.execRawAdb(finalArgs)
            setOutput(prev => [...prev, {
                cmd: displayCmd,
                stdout: result.stdout,
                stderr: result.stderr,
                success: result.success
            }])
        } catch {
            setOutput(prev => [...prev, {
                cmd: displayCmd,
                stdout: '',
                stderr: 'IPC error: failed to run command',
                success: false
            }])
        } finally {
            setIsRunning(false)
            setTimeout(() => inputRef.current?.focus(), 0)
        }
    }, [input, isRunning, autoTarget, device])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            runCommand()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            const next = historyIdx + 1
            if (next < cmdHistory.length) {
                setHistoryIdx(next)
                setInput(cmdHistory[next])
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            const next = historyIdx - 1
            if (next >= 0) {
                setHistoryIdx(next)
                setInput(cmdHistory[next])
            } else {
                setHistoryIdx(-1)
                setInput('')
            }
        }
    }

    const insertDeviceSerial = () => {
        if (device) setInput(prev => `-s ${device.serial} ${prev}`.trimEnd())
    }

    return (
        <div className="adb-terminal-view">
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon"><TerminalSquare /></div>
                    <div className="header-text">
                        <h1>ADB Terminal</h1>
                        <p>Run raw ADB commands directly</p>
                    </div>
                </div>
                <button className="clear-btn" onClick={() => setOutput([])}>
                    <Trash2 size={16} />
                    Clear
                </button>
            </header>

            <div className="terminal-toolbar">
                <label className="auto-target-toggle">
                    <input
                        type="checkbox"
                        checked={autoTarget}
                        onChange={e => setAutoTarget(e.target.checked)}
                    />
                    <span>Auto-target device</span>
                </label>
                {device ? (
                    <span className="device-chip" onClick={insertDeviceSerial} title="Click to insert -s flag">
                        <ChevronRight size={12} />
                        {device.model} <code>{device.serial}</code>
                    </span>
                ) : (
                    <span className="no-device-chip">No device selected</span>
                )}
            </div>

            <div className="terminal-body" ref={outputRef} onClick={() => inputRef.current?.focus()}>
                {output.length === 0 && (
                    <div className="terminal-welcome">
                        <p>Type ADB command arguments below. Examples:</p>
                        <div className="terminal-examples">
                            <code>devices</code>
                            <code>shell getprop ro.build.version.release</code>
                            <code>shell pm list packages -3</code>
                            <code>shell dumpsys battery</code>
                        </div>
                        <p className="terminal-note">Commands run against <strong>adb</strong>. Use <strong>shell &lt;cmd&gt;</strong> for on-device commands. Long-running / interactive commands (logcat, tcpdump) will time out.</p>
                    </div>
                )}
                {output.map((entry, i) => (
                    <div key={i} className="terminal-entry">
                        <div className="terminal-cmd-line">
                            <span className="terminal-prompt">$</span>
                            <span className="terminal-cmd-text">{entry.cmd}</span>
                        </div>
                        {entry.stdout && (
                            <pre className="terminal-stdout">{entry.stdout}</pre>
                        )}
                        {entry.stderr && (
                            <pre className={`terminal-stderr ${entry.success ? 'stderr-info' : ''}`}>{entry.stderr}</pre>
                        )}
                    </div>
                ))}
                {isRunning && (
                    <div className="terminal-running">
                        <Loader2 size={14} className="spin" />
                        <span>Running...</span>
                    </div>
                )}
            </div>

            <div className="terminal-input-bar">
                <span className="terminal-prompt-label">adb&gt;</span>
                <input
                    ref={inputRef}
                    className="terminal-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="shell getprop ro.product.model"
                    disabled={isRunning}
                    spellCheck={false}
                    autoComplete="off"
                    autoFocus
                />
                <button
                    className="run-btn"
                    onClick={runCommand}
                    disabled={isRunning || !input.trim()}
                >
                    {isRunning ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                </button>
            </div>
        </div>
    )
}
