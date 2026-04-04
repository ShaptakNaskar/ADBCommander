import { Heart, Github, Globe, Linkedin, Youtube, ExternalLink } from 'lucide-react'
import './Settings.css'

export function Settings() {
    return (
        <div className="settings">
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon">
                        <Heart />
                    </div>
                    <div className="header-text">
                        <h1>About</h1>
                        <p>ADB Commander - The Ultimate Android Debug Bridge GUI</p>
                    </div>
                </div>
            </header>

            <div className="settings-content">
                <div className="about-card hero">
                    <div className="app-logo">⚡</div>
                    <h2>ADB Commander</h2>
                    <p className="version">v1.2.0</p>
                    <p className="tagline">Cross-platform GUI for Android Debug Bridge</p>
                </div>

                <div className="about-card developer">
                    <div className="made-with">
                        Made with <Heart className="heart-icon" fill="currentColor" size={16} /> by
                    </div>
                    <h2 className="dev-name">Sappy</h2>

                    <div className="social-links">
                        <a
                            href="https://sappy-dir.vercel.app"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-link website"
                        >
                            <Globe size={20} />
                            <span>Website</span>
                            <ExternalLink size={14} />
                        </a>

                        <a
                            href="https://github.com/ShaptakNaskar"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-link github"
                        >
                            <Github size={20} />
                            <span>GitHub</span>
                            <ExternalLink size={14} />
                        </a>

                        <a
                            href="https://linkedin.com/in/ShaptakNaskar"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-link linkedin"
                        >
                            <Linkedin size={20} />
                            <span>LinkedIn</span>
                            <ExternalLink size={14} />
                        </a>

                        <a
                            href="https://youtube.com/@ShaptakNaskar"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-link youtube"
                        >
                            <Youtube size={20} />
                            <span>YouTube</span>
                            <ExternalLink size={14} />
                        </a>
                    </div>
                </div>

                <div className="about-card contribute">
                    <h3>🤝 Contribute</h3>
                    <p>All contributions are welcome! Found a bug? Have a feature idea? PRs are always appreciated.</p>
                    <a
                        href="https://github.com/ShaptakNaskar/Adb-Cmd-Scripts"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contribute-btn"
                    >
                        <Github size={18} />
                        <span>View on GitHub</span>
                    </a>
                </div>

                <div className="about-card features">
                    <h3>✨ Features</h3>
                    <ul>
                        <li>🔌 Live device detection & monitoring</li>
                        <li>📁 Smart backup/restore with selective file picker</li>
                        <li>📦 One-click APK installation</li>
                        <li>📸 Screenshot & screen recording</li>
                        <li>📡 Wireless ADB support</li>
                        <li>🖥️ Cross-platform (Windows, macOS, Linux)</li>
                        <li>🎨 Modern dark UI with glass effects</li>
                    </ul>
                </div>

                <div className="about-card tech">
                    <h3>🛠️ Built With</h3>
                    <div className="tech-stack">
                        <span className="tech-badge">Electron</span>
                        <span className="tech-badge">React</span>
                        <span className="tech-badge">TypeScript</span>
                        <span className="tech-badge">Vite</span>
                    </div>
                </div>

                <footer className="about-footer">
                    <p>Licensed under GPL-3.0 • © 2026 Sappy</p>
                </footer>
            </div>
        </div>
    )
}
