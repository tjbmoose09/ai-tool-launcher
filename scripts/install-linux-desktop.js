#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

if (process.platform !== "linux") {
  console.log("Desktop entry installation is only supported on Linux.");
  process.exit(0);
}

const home = os.homedir();
const appDir = path.resolve(__dirname, "..");
const applicationsDir = path.join(home, ".local", "share", "applications");
const desktopFile = path.join(applicationsDir, "ai-tool-launcher.desktop");

fs.mkdirSync(applicationsDir, { recursive: true });
fs.writeFileSync(desktopFile, [
  "[Desktop Entry]",
  "Type=Application",
  "Name=AI Tool Launcher",
  "Comment=Discover and launch AI CLI and desktop tools",
  `Exec=${path.join(appDir, "bin", "ai-tool-launcher")}`,
  `Icon=${path.join(appDir, "assets", "ai-tool-launcher.svg")}`,
  "Terminal=false",
  "Categories=Development;Utility;",
  "StartupWMClass=ai-tool-launcher",
  "",
].join("\n"));

fs.chmodSync(desktopFile, 0o644);
console.log(`Installed ${desktopFile}`);
