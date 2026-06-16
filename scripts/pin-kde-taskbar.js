#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = os.homedir();
const plasmaConfig = path.join(HOME, ".config", "plasma-org.kde.plasma.desktop-appletsrc");
const launcher = "applications:ai-tool-launcher.desktop";

if (!fs.existsSync(plasmaConfig)) {
  console.log("KDE Plasma config not found; skipped taskbar pin.");
  process.exit(0);
}

let text = fs.readFileSync(plasmaConfig, "utf8");
if (text.includes(launcher)) {
  console.log("AI Tool Launcher is already pinned.");
  process.exit(0);
}

const backup = `${plasmaConfig}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
fs.copyFileSync(plasmaConfig, backup);

const lines = text.split(/\r?\n/);
let inIconTasks = false;
let changed = false;

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  if (/^\[.*\]$/.test(line)) {
    inIconTasks = line.includes("[Containments]") && line.includes("[Configuration][General]");
  }
  if (inIconTasks && line.startsWith("launchers=")) {
    const value = line.slice("launchers=".length);
    lines[i] = `launchers=${value},${launcher}`;
    changed = true;
    break;
  }
}

if (!changed) {
  console.log("No KDE icon task launcher list found; skipped taskbar pin.");
  process.exit(0);
}

fs.writeFileSync(plasmaConfig, lines.join("\n"));
console.log(`Pinned AI Tool Launcher. Backup: ${backup}`);
