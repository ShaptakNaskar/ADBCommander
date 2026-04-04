# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ADB Commander is a cross-platform Electron + React desktop app that provides a GUI for Android Debug Bridge (ADB). It auto-downloads ADB platform-tools on first launch.

## Commands

```bash
npm run dev          # Start dev server (Vite + Electron, sandbox disabled)
npm run dev:win      # Windows dev (without sandbox)
npm run build        # Production build
npm run typecheck    # TypeScript type check (tsc --noEmit)
npm run lint         # ESLint for .ts/.tsx files
npm run build:linux  # Build Linux installers
npm run build:mac    # Build macOS DMG (Intel + Apple Silicon)
npm run build:win    # Build Windows NSIS + portable
npm run build:all    # Build all platforms
```

There is no test framework configured.

## Architecture

The app follows the standard Electron three-layer architecture:

### Main Process (`src/main/`)
Runs in Node.js, owns all ADB logic and IPC handlers.

- **`index.ts`** — App entry: creates window, registers all IPC handlers, calls `initializeAdb()` on ready
- **`adb/AdbService.ts`** — Wraps the ADB binary via `execSync`/`execFile` (50MB buffer, timeout handling). Every ADB feature (screenshot, screen record, APK install, file pull/push with cancellation) lives here.
- **`adb/DeviceMonitor.ts`** — Polls `adb devices` every 2 seconds, diffs the result, and pushes device-change events to the renderer via IPC.
- **`adb/FileBrowser.ts`** — Parses `adb shell ls -la` output to browse device filesystem; has hardcoded shortcuts for common Android folders.
- **`binaries/BinaryManager.ts`** — Downloads Google platform-tools ZIP on first run, extracts it, and makes binaries executable on Unix.
- **`utils/LogService.ts`** — Singleton that forwards command-level log entries to the renderer via IPC.
- **`utils/FilenameSanitizer.ts`** — Cross-platform filename sanitization (Windows reserved names, control characters, Unicode normalization for macOS).

### Preload (`src/preload/index.ts`)
The only safe bridge between main and renderer. Exposes `window.adb` via `contextBridge`. All IPC channel names are defined here; if you add a new IPC handler in main, expose it here too.

### Renderer (`src/renderer/`)
React 18 + TypeScript, bundled by Vite via electron-vite. No state-management library — state lives in `App.tsx` props/hooks and is passed down.

- **`App.tsx`** — Owns global state (selected device, current view, ADB status, command log, backup progress). Subscribes to IPC events from main on mount.
- **`types.ts`** — Mirrors the `AdbApi` interface from preload; keep these in sync when adding IPC channels.
- **`components/`** — Functional components, one per feature area (Sidebar, Dashboard, BackupRestore, QuickActions, PowerTools, Console, etc.). No component library — styles are custom CSS.
- **`styles/index.css`** — Design system via CSS variables. Dark theme: `#0a0a0f` background, `#8b5cf6` primary (purple), `#06b6d4` secondary (cyan).

## IPC Flow

```
Renderer (window.adb.someMethod())
  → preload contextBridge (ipcRenderer.invoke)
    → main ipcMain.handle (AdbService / FileBrowser)
      → adb binary (child_process)
```

Device monitoring uses `ipcMain.on` + `event.sender.send` (push model, not request/response).

## Key Implementation Notes

- **Adding a new feature**: Add an `ipcMain.handle` in `src/main/index.ts`, add the method to `AdbService` or a new file, expose it in `src/preload/index.ts`, update `types.ts`, and consume it in the relevant renderer component.
- **Large file transfers**: Streamed with progress events over IPC; cancellation is supported via a shared flag in `AdbService`.
- **Platform differences**: Binary paths, sandbox settings, and filename sanitization all branch on `process.platform`. Check `BinaryManager.ts` and `FilenameSanitizer.ts` before touching path or binary logic.
- **Electron version**: 28.1.0 — context isolation is enabled; `nodeIntegration` is false.
