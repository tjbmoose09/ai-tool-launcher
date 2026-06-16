# AI Tool Launcher

AI Tool Launcher V1.12 is a local, cross-platform web GUI for discovering and launching AI CLI tools and desktop apps from one place.

[![AI Tool Launcher interactive demo](https://tjbmoose09.github.io/ai-tool-launcher/assets/social-card.png)](https://tjbmoose09.github.io/ai-tool-launcher/#demo)

**Live interactive demo:** https://tjbmoose09.github.io/ai-tool-launcher/#demo

It is designed for Windows, macOS, and Linux. On first run, the user selects the OS display, scans for installed AI tools, optionally adds tools manually, and then launches the selected tools from a terminal or app launcher.

Project homepage: https://tjbmoose09.github.io/ai-tool-launcher/

## What It Feels Like

The launcher is built around a terminal-first status board and a right-side command deck:

- Live running indicators for selected tools
- A status terminal that rotates version, environment, state, and last-launch details
- One-click launches for CLI tools and desktop apps
- Local settings for title, accent color, tool selection, repo updates, and reset-session flow

The GitHub Pages homepage includes the looping interactive asset used for the project marketing preview.

## Features

- First-run setup for Windows, macOS, or Linux
- Scans for common AI tools such as Codex, Claude, Gemini, OpenRouter, LM Studio, Cursor, Aider, OpenCode, Ollama, Qwen Code, and ChatGPT
- Manual tool entry for custom CLIs or apps
- OS-specific command display and launch behavior
- Terminal-style status board with rotating version, environment, state, and last-launch details
- Launcher cards with running indicators and uptime
- Settings gear for rescanning, editing the launcher title, changing the accent color, and applying repo updates
- Update notification badge when the upstream repo has a newer launcher version
- One-click repo update with a reset-session prompt after the fast-forward pull completes
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

Choose a browser explicitly:

```bash
./bin/ai-tool-launcher --browser firefox
./bin/ai-tool-launcher --browser edge
./bin/ai-tool-launcher --browser safari
```

Or set a default for your shell:

```bash
AI_TOOL_LAUNCHER_BROWSER=firefox ./bin/ai-tool-launcher
```

Supported browser values are `auto`, `brave`, `chrome`, `chromium`, `edge`, `firefox`, `safari`, and `default`.

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

## Versioning

Larger launcher updates use `Vmajor.minor` labels such as `V1.10`. Smaller patch updates should advance the minor label the same way, for example `V1.11`, while the package metadata uses semver-compatible values such as `1.10.0`.

## Packaging

This repository currently ships as a dependency-free Node/web application. Native packaging can be added later with Electron or Tauri while keeping the same frontend and backend contracts.
