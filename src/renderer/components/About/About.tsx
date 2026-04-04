import { Heart, Github, Globe, Youtube, Mail, ExternalLink } from 'lucide-react'
import './About.css'

interface AboutProps {
    onOpenExternal: (url: string) => void
}

export function About({ onOpenExternal }: AboutProps) {
    const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
        e.preventDefault()
        onOpenExternal(url)
    }

    return (
        <div className="about-page">
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon">
                        <Heart />
                    </div>
                    <div className="header-text">
                        <h1>About</h1>
                        <p>ADB Commander — The Ultimate Android Debug Bridge GUI</p>
                    </div>
                </div>
            </header>

            <div className="about-content">
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
                            href="https://sappy-dir.vercel.app/"
                            onClick={(e) => handleLink(e, 'https://sappy-dir.vercel.app/')}
                            className="social-link website"
                        >
                            <Globe size={20} />
                            <span>Website</span>
                            <ExternalLink size={14} />
                        </a>

                        <a
                            href="https://github.com/ShaptakNaskar"
                            onClick={(e) => handleLink(e, 'https://github.com/ShaptakNaskar')}
                            className="social-link github"
                        >
                            <Github size={20} />
                            <span>GitHub</span>
                            <ExternalLink size={14} />
                        </a>

                        <a
                            href="mailto:ddtectiv.ddip2017@gmail.com"
                            onClick={(e) => handleLink(e, 'mailto:ddtectiv.ddip2017@gmail.com')}
                            className="social-link email"
                        >
                            <Mail size={20} />
                            <span>Email</span>
                            <ExternalLink size={14} />
                        </a>

                        <a
                            href="https://youtube.com/@BigSmokeYT"
                            onClick={(e) => handleLink(e, 'https://youtube.com/@BigSmokeYT')}
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
                        onClick={(e) => handleLink(e, 'https://github.com/ShaptakNaskar/Adb-Cmd-Scripts')}
                        className="contribute-btn"
                    >
                        <Github size={18} />
                        <span>View on GitHub</span>
                    </a>
                </div>

                <div className="about-card features">
                    <h3>✨ Features</h3>
                    <ul>
                        <li>🔌 Live device detection &amp; monitoring</li>
                        <li>📁 Smart backup/restore with selective file picker</li>
                        <li>📤 Push files to any directory on the device</li>
                        <li>📦 One-click APK installation</li>
                        <li>📸 Screenshot &amp; screen recording</li>
                        <li>🛠️ Power tools — packages, logcat, input events</li>
                        <li>🖥️ Cross-platform (Windows, macOS, Linux)</li>
                        <li>🎨 Modern dark UI with smooth animations</li>
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
