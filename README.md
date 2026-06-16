# AI Tool Launcher

AI Tool Launcher is a local, cross-platform web GUI for discovering and launching AI CLI tools and desktop apps from one place.

It is designed for Windows, macOS, and Linux. On first run, the user selects the OS display, scans for installed AI tools, optionally adds tools manually, and then launches the selected tools from a terminal or app launcher.

## Features

- First-run setup for Windows, macOS, or Linux
- Scans for common AI tools such as Codex, Claude, Gemini, OpenRouter, LM Studio, Cursor, Aider, OpenCode, Ollama, Qwen Code, and ChatGPT
- Manual tool entry for custom CLIs or apps
- OS-specific command display and launch behavior
- Terminal-style status board with rotating version, environment, state, and last-launch details
- Launcher cards with running indicators and uptime
- Settings gear for rescanning, checking repo updates, editing the launcher title, and changing the accent color
- Local-only config storage in the user's OS config directory
- Localhost API protected by a per-session mutation token
- No bundled API keys or personal machine configuration

## Requirements

- Node.js 18 or newer
- A terminal app for CLI launches:
  - Linux: Konsole, GNOME Terminal, Kitty, Alacritty, or xterm
  - macOS: Terminal
  - Windows: Windows Terminal preferred, `cmd.exe` fallback

## Quick Start

```bash
git clone https://github.com/tjbmoose09/ai-tool-launcher.git
cd ai-tool-launcher
npm start
```

Then open:

```text
http://127.0.0.1:47623
```

On Linux/macOS you can also run:

```bash
./bin/ai-tool-launcher
```

On Windows:

```bat
bin\ai-tool-launcher.cmd
```

## Linux Desktop Entry

```bash
npm run desktop:linux
```

This writes `~/.local/share/applications/ai-tool-launcher.desktop`.

## Local Config

The app stores user choices locally and does not write them into the repository.

- Linux: `~/.config/ai-tool-launcher/config.json`
- macOS: `~/Library/Application Support/AI Tool Launcher/config.json`
- Windows: `%APPDATA%\AI Tool Launcher\config.json`

The file can contain user-selected tools and custom commands. Do not commit local config files.

## Security Model

- The server binds only to `127.0.0.1`
- API write actions require a random per-session token
- Known tools are launched from the registry or from user-created local config
- The repo includes a static security scan for common key/token patterns and local personal paths
- No API keys, user configs, or machine-specific paths are included

Run checks:

```bash
npm run ci
```

## Development

```bash
npm run check
npm run security:scan
npm start
```

## Packaging

This repository currently ships as a dependency-free Node/web application. Native packaging can be added later with Electron or Tauri while keeping the same frontend and backend contracts.
