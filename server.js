#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { execFile, spawn } = require("child_process");

const APP_NAME = "AI Tool Launcher";
const APP_SLUG = "ai-tool-launcher";
const APP_DIR = __dirname;
const PUBLIC_DIR = path.join(APP_DIR, "public");
const HOST = "127.0.0.1";
const PORT = Number(process.env.AI_TOOL_LAUNCHER_PORT || 47623);
const SESSION_TOKEN = crypto.randomBytes(32).toString("hex");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

function hostOs() {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return "linux";
}

function configRoot() {
  if (process.env.AI_TOOL_LAUNCHER_CONFIG_DIR) {
    return process.env.AI_TOOL_LAUNCHER_CONFIG_DIR;
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), APP_NAME);
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_NAME);
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), APP_SLUG);
}

const CONFIG_DIR = configRoot();
const STATE_DIR = process.platform === "win32"
  ? path.join(process.env.LOCALAPPDATA || CONFIG_DIR, APP_NAME, "State")
  : path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state"), APP_SLUG);
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DETECT_TTL_MS = 10000;
const VERSION_TTL_MS = 60000;

fs.mkdirSync(CONFIG_DIR, { recursive: true });
fs.mkdirSync(STATE_DIR, { recursive: true });

function sh(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function winQuote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function shellCommand(script, timeout = 4000) {
  return new Promise((resolve) => {
    const shell = process.platform === "win32" ? "cmd.exe" : "/usr/bin/env";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", script]
      : ["bash", "-lc", script];
    execFile(shell, args, {
      timeout,
      maxBuffer: 1024 * 1024,
      env: runtimeEnv(),
      windowsHide: true,
    }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error && typeof error.code === "number" ? error.code : 0,
        signal: error ? error.signal : null,
        timedOut: Boolean(error && (error.killed || error.signal === "SIGTERM")),
        stdout: String(stdout || "").trim(),
        stderr: String(stderr || "").trim(),
      });
    });
  });
}

function candidatePathDirs() {
  const home = os.homedir();
  const dirs = [
    path.join(home, ".local", "bin"),
    path.dirname(process.execPath),
  ];
  if (process.platform !== "win32") {
    const nvmRoot = path.join(home, ".nvm", "versions", "node");
    try {
      for (const version of fs.readdirSync(nvmRoot).sort().reverse()) {
        dirs.push(path.join(nvmRoot, version, "bin"));
      }
    } catch {
      // NVM is optional.
    }
    dirs.push("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin");
  } else {
    dirs.push(
      path.join(home, "AppData", "Local", "Programs", "Microsoft VS Code", "bin"),
      path.join(home, "AppData", "Local", "Programs", "Cursor", "resources", "app", "bin"),
    );
  }
  return [...new Set(dirs.filter(Boolean).filter((dir) => fs.existsSync(dir)))];
}

function runtimeEnv(extra = {}) {
  const pathValue = [
    ...candidatePathDirs(),
    process.env.PATH || "",
  ].filter(Boolean).join(path.delimiter);
  return { ...process.env, PATH: pathValue, ...extra };
}

const KNOWN_TOOLS = [
  {
    id: "codex",
    name: "Codex",
    vendor: "OpenAI",
    kind: ["cli"],
    bin: "codex",
    glyph: ">_",
    color: "#2F8F73",
    tags: ["coding", "agent"],
    versionArgs: ["--version"],
    updateHint: "npm update -g @openai/codex",
  },
  {
    id: "claude",
    name: "Claude",
    vendor: "Anthropic",
    kind: ["cli"],
    bin: "claude",
    glyph: "*",
    color: "#C15F3C",
    tags: ["coding", "agent"],
    versionArgs: ["--version"],
    updateHint: "Run the vendor installer or package manager used to install Claude.",
  },
  {
    id: "gemini",
    name: "Gemini",
    vendor: "Google",
    kind: ["cli"],
    bin: "gemini",
    glyph: "+",
    color: "#3D6FC9",
    tags: ["coding", "agent"],
    versionArgs: ["--version"],
    updateHint: "npm update -g @google/gemini-cli",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    vendor: "Router",
    kind: ["cli"],
    bin: "openrouter",
    glyph: "<>",
    color: "#C2447E",
    tags: ["models", "router"],
    versionArgs: ["--version"],
    requiredEnv: ["OPENROUTER_API_KEY"],
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    vendor: "Local",
    kind: ["app"],
    bin: "lmstudio",
    appName: "LM Studio",
    linuxFlatpak: "ai.lmstudio.lm-studio",
    glyph: "LM",
    color: "#7C5CC4",
    tags: ["local", "models"],
  },
  {
    id: "cursor",
    name: "Cursor",
    vendor: "Anysphere",
    kind: ["app", "cli"],
    bin: "cursor",
    appName: "Cursor",
    glyph: ">",
    color: "#54707F",
    tags: ["editor", "coding"],
    versionArgs: ["--version"],
  },
  {
    id: "aider",
    name: "Aider",
    vendor: "Open Source",
    kind: ["cli"],
    bin: "aider",
    glyph: "AI",
    color: "#0E7795",
    tags: ["coding", "agent"],
    versionArgs: ["--version"],
  },
  {
    id: "opencode",
    name: "OpenCode",
    vendor: "Open Source",
    kind: ["cli"],
    bin: "opencode",
    glyph: "OC",
    color: "#277C56",
    tags: ["coding", "agent"],
    versionArgs: ["--version"],
  },
  {
    id: "ollama",
    name: "Ollama",
    vendor: "Local",
    kind: ["app", "cli"],
    bin: "ollama",
    appName: "Ollama",
    glyph: "OL",
    color: "#222222",
    tags: ["local", "models"],
    versionArgs: ["--version"],
  },
  {
    id: "qwen",
    name: "Qwen Code",
    vendor: "Alibaba",
    kind: ["cli"],
    bin: "qwen",
    glyph: "Q",
    color: "#8E5CC4",
    tags: ["coding", "agent"],
    versionArgs: ["--version"],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    vendor: "OpenAI",
    kind: ["app"],
    bin: "chatgpt",
    appName: "ChatGPT",
    glyph: "G",
    color: "#10A37F",
    tags: ["chat", "assistant"],
  },
];

function defaultConfig() {
  return {
    version: 1,
    firstRunComplete: false,
    selectedOs: hostOs(),
    title: "AI Launcher",
    theme: "dark",
    accent: "#f5c211",
    selectedToolIds: [],
    customTools: [],
    toolOverrides: {},
    lastLaunched: {},
    launchLog: [
      { line: "$ ai-launcher --status", kind: "cmd", at: Date.now() },
      { line: "[ok] ready for setup", kind: "ok", at: Date.now() },
    ],
  };
}

function loadConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return { ...defaultConfig(), ...parsed };
  } catch {
    return defaultConfig();
  }
}

function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  if (process.platform !== "win32") {
    fs.chmodSync(CONFIG_FILE, 0o600);
  }
}

let config = loadConfig();
const launched = new Map();
const detectCache = new Map();
const versionCache = new Map();

function allToolDefs() {
  const custom = Array.isArray(config.customTools) ? config.customTools : [];
  const merged = [...KNOWN_TOOLS, ...custom].map((tool) => ({
    ...tool,
    ...(config.toolOverrides && config.toolOverrides[tool.id] ? config.toolOverrides[tool.id] : {}),
  }));
  return merged;
}

function normalizeTool(input) {
  const id = String(input.id || input.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!id) throw new Error("Tool needs a name or id");
  const name = String(input.name || id).trim().slice(0, 80);
  const kind = Array.isArray(input.kind) && input.kind.length ? input.kind : ["cli"];
  const safeKind = kind.filter((item) => ["cli", "app"].includes(item));
  return {
    id,
    name,
    vendor: String(input.vendor || "Custom").trim().slice(0, 80),
    kind: safeKind.length ? safeKind : ["cli"],
    bin: String(input.bin || "").trim(),
    appName: String(input.appName || input.name || "").trim(),
    glyph: String(input.glyph || name.slice(0, 2).toUpperCase()).slice(0, 4),
    color: /^#[0-9a-f]{6}$/i.test(input.color || "") ? input.color : "#6f6c62",
    custom: true,
    commands: input.commands && typeof input.commands === "object" ? input.commands : {},
  };
}

function appendLog(line, kind = "cmd") {
  config.launchLog = [
    ...(Array.isArray(config.launchLog) ? config.launchLog : []),
    { line, kind, at: Date.now() },
  ].slice(-24);
  saveConfig(config);
}

async function commandPath(command) {
  if (!command) return "";
  const script = process.platform === "win32"
    ? `where ${winQuote(command)}`
    : `command -v ${sh(command)}`;
  const result = await shellCommand(script, 2500);
  return result.ok && result.stdout ? result.stdout.split(/\r?\n/)[0].trim() : "";
}

async function flatpakInstalled(appId) {
  if (!appId || process.platform !== "linux") return false;
  const flatpak = await commandPath("flatpak");
  if (!flatpak) return false;
  const result = await shellCommand(`flatpak info ${sh(appId)}`, 2500);
  return result.ok;
}

function macAppPath(appName) {
  if (!appName || process.platform !== "darwin") return "";
  const candidates = [
    path.join("/Applications", `${appName}.app`),
    path.join(os.homedir(), "Applications", `${appName}.app`),
  ];
  return candidates.find((file) => fs.existsSync(file)) || "";
}

function winAppCandidates(tool) {
  if (process.platform !== "win32") return [];
  const local = process.env.LOCALAPPDATA || "";
  const programFiles = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean);
  const names = [tool.appName, tool.name, tool.bin].filter(Boolean);
  const files = [];
  for (const name of names) {
    for (const base of [local, ...programFiles]) {
      files.push(path.join(base, name, `${name}.exe`));
      files.push(path.join(base, "Programs", name, `${name}.exe`));
    }
  }
  return files.filter((file) => {
    try {
      return fs.existsSync(file);
    } catch {
      return false;
    }
  });
}

function cacheKeyForTool(tool) {
  return [tool.id, tool.bin, tool.appName, tool.linuxFlatpak].filter(Boolean).join("|");
}

async function detectTool(tool, options = {}) {
  const cacheKey = cacheKeyForTool(tool);
  const cached = detectCache.get(cacheKey);
  if (!options.force && cached && Date.now() - cached.at < DETECT_TTL_MS) {
    return { ...tool, ...cached.value };
  }
  const [binPath, flatpak] = await Promise.all([
    commandPath(tool.bin),
    flatpakInstalled(tool.linuxFlatpak),
  ]);
  const macApp = macAppPath(tool.appName || tool.name);
  const winApps = winAppCandidates(tool);
  const installed = Boolean(binPath || flatpak || macApp || winApps.length);
  const value = {
    installed,
    detectedPath: binPath || (flatpak ? tool.linuxFlatpak : "") || macApp || winApps[0] || "",
    detectedBy: binPath ? "path" : flatpak ? "flatpak" : macApp ? "app-bundle" : winApps.length ? "program-files" : "",
    configured: Array.isArray(tool.requiredEnv)
      ? tool.requiredEnv.every((key) => Boolean(process.env[key]))
      : true,
  };
  detectCache.set(cacheKey, { at: Date.now(), value });
  return { ...tool, ...value };
}

function parseVersion(output) {
  const match = String(output || "").match(/\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9_.-]+)?/);
  return match ? match[0] : "";
}

function maskPath(value) {
  const text = String(value || "");
  const home = os.homedir();
  return home && text.startsWith(home) ? `~${text.slice(home.length)}` : text;
}

async function getVersion(tool, detected) {
  const cliOnly = Array.isArray(tool.kind) && tool.kind.includes("cli") && !tool.kind.includes("app");
  if (!cliOnly || !detected.installed || !tool.versionArgs || !tool.versionArgs.length || !tool.bin) return "";
  const cacheKey = [tool.id, detected.detectedPath, tool.versionArgs.join(" ")].join("|");
  const cached = versionCache.get(cacheKey);
  if (cached && Date.now() - cached.at < VERSION_TTL_MS) return cached.value;
  const command = detected.detectedBy === "path" && detected.detectedPath ? detected.detectedPath : tool.bin;
  const result = await shellCommand(`${sh(command)} ${tool.versionArgs.map(sh).join(" ")}`, 6500);
  if (!result.ok) return "";
  const value = parseVersion(result.stdout || result.stderr) || (result.stdout || result.stderr).split(/\r?\n/)[0] || "";
  versionCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

async function processLines() {
  if (process.platform === "win32") {
    const result = await shellCommand("tasklist /fo csv /nh", 3000);
    return result.ok ? result.stdout.split(/\r?\n/) : [];
  }
  const result = await shellCommand("ps -axo pid=,command=", 3000);
  return result.ok ? result.stdout.split(/\r?\n/) : [];
}

function toolPatterns(tool) {
  return [tool.bin, tool.appName, tool.name, tool.linuxFlatpak]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
}

async function isRunning(tool, lines = null) {
  const launch = launched.get(tool.id);
  if (launch && launch.running) {
    return { running: true, startedAt: launch.startedAt, mode: launch.mode, source: "launcher" };
  }
  const patterns = toolPatterns(tool);
  if (!patterns.length) return { running: false };
  const ownPid = String(process.pid);
  const snapshot = lines || await processLines();
  const hit = snapshot.find((line) => {
    const lower = line.toLowerCase();
    if (lower.includes(ownPid) || lower.includes("ai-tool-launcher/server.js")) return false;
    if (lower.includes("--version")) return false;
    return patterns.some((pattern) => pattern && lower.includes(pattern));
  });
  return hit ? { running: true, startedAt: null, mode: "external", source: "process" } : { running: false };
}

function displayCommand(tool, mode, selectedOs = config.selectedOs) {
  const custom = tool.commands && tool.commands[selectedOs] && tool.commands[selectedOs][mode];
  if (custom) return custom;
  if (mode === "cli") {
    const bin = tool.bin || tool.name;
    if (selectedOs === "windows") return `wt ${bin}`;
    if (selectedOs === "macos") return `Terminal: ${bin}`;
    return `konsole -e ${bin}`;
  }
  const app = tool.appName || tool.bin || tool.name;
  if (selectedOs === "windows") return `Start-Process "${app}"`;
  if (selectedOs === "macos") return `open -a "${app}"`;
  if (tool.linuxFlatpak) return `flatpak run ${tool.linuxFlatpak}`;
  return app;
}

function terminalHold(command) {
  if (process.platform === "win32") return command;
  return [
    `cd ${sh(os.homedir())}`,
    command,
    "status=$?",
    "printf '\\nProcess exited with status %s. Press Enter to close. ' \"$status\"",
    "read -r _",
  ].join("; ");
}

async function spawnDetached(command, args, extra = {}) {
  const child = spawn(command, args, {
    cwd: extra.cwd || os.homedir(),
    env: runtimeEnv(extra.env || {}),
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  return child;
}

async function openTerminal(tool, command) {
  if (process.platform === "win32") {
    const wt = await commandPath("wt.exe");
    if (wt) return spawnDetached(wt, ["new-tab", "--title", `${tool.name} CLI`, "cmd.exe", "/k", command]);
    return spawnDetached("cmd.exe", ["/c", "start", `"${tool.name} CLI"`, "cmd.exe", "/k", command]);
  }
  if (process.platform === "darwin") {
    const script = `tell application "Terminal" to do script ${JSON.stringify(command)}`;
    await spawnDetached("osascript", ["-e", script, "-e", 'tell application "Terminal" to activate']);
    return null;
  }

  const held = terminalHold(command);
  const candidates = [
    { bin: "konsole", args: ["--title", `${tool.name} CLI`, "-e", "bash", "-lc", held] },
    { bin: "gnome-terminal", args: ["--", "bash", "-lc", held] },
    { bin: "kitty", args: ["--title", `${tool.name} CLI`, "bash", "-lc", held] },
    { bin: "alacritty", args: ["-t", `${tool.name} CLI`, "-e", "bash", "-lc", held] },
    { bin: "xterm", args: ["-T", `${tool.name} CLI`, "-e", "bash", "-lc", held] },
  ];
  for (const candidate of candidates) {
    const resolved = await commandPath(candidate.bin);
    if (resolved) return spawnDetached(resolved, candidate.args);
  }
  throw new Error("No supported terminal found");
}

async function openApp(tool, detected) {
  if (process.platform === "win32") {
    const target = detected.detectedPath || tool.bin || tool.appName || tool.name;
    return spawnDetached("powershell.exe", ["-NoProfile", "-Command", "Start-Process", target]);
  }
  if (process.platform === "darwin") {
    return spawnDetached("open", ["-a", tool.appName || tool.name]);
  }
  if (tool.linuxFlatpak && await flatpakInstalled(tool.linuxFlatpak)) {
    return spawnDetached("flatpak", ["run", tool.linuxFlatpak]);
  }
  const target = detected.detectedPath || await commandPath(tool.bin) || tool.bin;
  if (!target) throw new Error(`${tool.name} is not installed`);
  return spawnDetached(target, []);
}

function selectedToolSet() {
  return new Set(Array.isArray(config.selectedToolIds) ? config.selectedToolIds.map(String) : []);
}

function normalizeSelectedToolIds(value) {
  const known = new Set(allToolDefs().map((tool) => tool.id));
  const seen = new Set();
  const selected = [];
  for (const id of Array.isArray(value) ? value.map(String) : []) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    selected.push(id);
  }
  return selected;
}

function stopDeselectedLaunches(nextSelectedIds) {
  const next = new Set(nextSelectedIds);
  const removed = [...selectedToolSet()].filter((id) => !next.has(id));
  for (const id of removed) {
    const launch = launched.get(id);
    if (launch && launch.pid) {
      try {
        process.kill(-launch.pid);
      } catch {
        try {
          process.kill(launch.pid);
        } catch {
          // The process may have already exited.
        }
      }
    }
    launched.delete(id);
  }
  return removed;
}

function toolModes(tool, detected) {
  return tool.kind.map((mode) => ({
    mode,
    label: mode === "cli" ? "CLI" : "APP",
    command: displayCommand(tool, mode),
    enabled: detected.installed && detected.configured,
  }));
}

async function buildRegistryStatus(tool, selectedSet) {
  const detected = await detectTool(tool);
  return {
    id: tool.id,
    name: tool.name,
    vendor: tool.vendor,
    kind: tool.kind,
    bin: tool.bin,
    appName: tool.appName,
    glyph: tool.glyph,
    color: tool.color,
    tags: tool.tags || [],
    custom: Boolean(tool.custom),
    selected: selectedSet.has(tool.id),
    installed: detected.installed,
    configured: detected.configured,
    detectedPath: maskPath(detected.detectedPath),
    detectedBy: detected.detectedBy,
    version: "",
    updateHint: tool.updateHint || "",
    running: false,
    runningSource: "",
    startedAt: null,
    lastLaunched: config.lastLaunched[tool.id] || null,
    modes: toolModes(tool, detected),
    statusText: !detected.installed
      ? "not installed"
      : !detected.configured
        ? "needs environment"
        : "ready",
  };
}

async function buildToolStatus(tool, processSnapshot = null) {
  const detected = await detectTool(tool);
  const running = await isRunning(tool, processSnapshot);
  const version = await getVersion(tool, detected);
  const selected = selectedToolSet().has(tool.id);
  const modes = toolModes(tool, detected);
  return {
    id: tool.id,
    name: tool.name,
    vendor: tool.vendor,
    kind: tool.kind,
    bin: tool.bin,
    appName: tool.appName,
    glyph: tool.glyph,
    color: tool.color,
    tags: tool.tags || [],
    custom: Boolean(tool.custom),
    selected,
    installed: detected.installed,
    configured: detected.configured,
    detectedPath: maskPath(detected.detectedPath),
    detectedBy: detected.detectedBy,
    version,
    updateHint: tool.updateHint || "",
    running: running.running,
    runningSource: running.source || "",
    startedAt: running.startedAt,
    lastLaunched: config.lastLaunched[tool.id] || null,
    modes,
    statusText: !detected.installed
      ? "not installed"
      : !detected.configured
        ? "needs environment"
        : running.running
          ? "running"
          : "ready",
  };
}

async function statusPayload() {
  const defs = allToolDefs();
  const selectedSet = selectedToolSet();
  const selectedDefs = defs.filter((tool) => selectedSet.has(tool.id));
  const registry = await Promise.all(defs.map((tool) => buildRegistryStatus(tool, selectedSet)));
  const processSnapshot = config.firstRunComplete && selectedDefs.length ? await processLines() : [];
  const tools = config.firstRunComplete
    ? await Promise.all(selectedDefs.map((tool) => buildToolStatus(tool, processSnapshot)))
    : registry;
  return {
    app: {
      name: APP_NAME,
      version: readPackageVersion(),
      hostOs: hostOs(),
      configDir: CONFIG_DIR,
      repository: packageRepository(),
    },
    preferences: {
      firstRunComplete: config.firstRunComplete,
      selectedOs: config.selectedOs,
      title: config.title,
      theme: config.theme,
      accent: config.accent,
    },
    tools,
    registry,
    log: config.launchLog || [],
    now: Date.now(),
  };
}

function readPackageVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(APP_DIR, "package.json"), "utf8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function versionLabel(version = readPackageVersion()) {
  const parts = String(version || "0.0.0").split(".");
  return `V${parts[0] || "0"}.${parts[1] || "0"}`;
}

function packageRepository() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_DIR, "package.json"), "utf8"));
    return typeof pkg.repository === "string" ? pkg.repository : (pkg.repository && pkg.repository.url) || "";
  } catch {
    return "";
  }
}

async function scanTools() {
  const results = (await Promise.all(allToolDefs().map((tool) => detectTool(tool, { force: true })))).map((tool) => ({
    ...tool,
    detectedPath: maskPath(tool.detectedPath),
  }));
  appendLog(`[ok] scan complete · ${results.filter((tool) => tool.installed).length} tools found`, "ok");
  return results;
}

async function selfUpdateStatus() {
  const git = await commandPath("git");
  if (!git || !fs.existsSync(path.join(APP_DIR, ".git"))) {
    return {
      available: false,
      canApply: false,
      message: "Repo update check unavailable outside a git checkout",
      currentVersion: readPackageVersion(),
      currentLabel: versionLabel(),
    };
  }
  const fetch = await shellCommand(`git -C ${sh(APP_DIR)} fetch --quiet`, 15000);
  const branch = await shellCommand(`git -C ${sh(APP_DIR)} branch --show-current`, 3000);
  const local = await shellCommand(`git -C ${sh(APP_DIR)} rev-parse HEAD`, 3000);
  const upstream = await shellCommand(`git -C ${sh(APP_DIR)} rev-parse @{u}`, 3000);
  if (!fetch.ok) {
    return {
      available: false,
      canApply: false,
      message: "Could not reach the upstream repo",
      currentVersion: readPackageVersion(),
      currentLabel: versionLabel(),
    };
  }
  if (!branch.ok || !local.ok || !upstream.ok) {
    return {
      available: false,
      canApply: false,
      message: "No upstream branch configured",
      currentVersion: readPackageVersion(),
      currentLabel: versionLabel(),
    };
  }
  const remotePackage = await shellCommand(`git -C ${sh(APP_DIR)} show ${sh("@{u}:package.json")}`, 3000);
  let latestVersion = "";
  if (remotePackage.ok && remotePackage.stdout) {
    try {
      latestVersion = JSON.parse(remotePackage.stdout).version || "";
    } catch {
      latestVersion = "";
    }
  }
  const available = local.stdout !== upstream.stdout;
  return {
    available,
    canApply: available,
    message: available
      ? `Update available: ${latestVersion ? versionLabel(latestVersion) : "new repo version"} on ${branch.stdout}`
      : `Up to date on ${branch.stdout}`,
    currentVersion: readPackageVersion(),
    currentLabel: versionLabel(),
    latestVersion,
    latestLabel: latestVersion ? versionLabel(latestVersion) : "",
    local: local.stdout,
    upstream: upstream.stdout,
  };
}

async function applySelfUpdate() {
  const git = await commandPath("git");
  if (!git || !fs.existsSync(path.join(APP_DIR, ".git"))) {
    throw new Error("Launcher updates require a git checkout");
  }
  const before = await selfUpdateStatus();
  if (!before.available) {
    return {
      ok: true,
      applied: false,
      restartRequired: false,
      message: before.message,
      self: before,
    };
  }
  const trackedStatus = await shellCommand(`git -C ${sh(APP_DIR)} status --porcelain --untracked-files=no`, 3000);
  if (trackedStatus.stdout) {
    throw new Error("Cannot update while tracked local changes are present");
  }
  const pull = await shellCommand(`git -C ${sh(APP_DIR)} pull --ff-only`, 30000);
  if (!pull.ok) {
    throw new Error(pull.stderr || pull.stdout || "Update failed");
  }
  detectCache.clear();
  versionCache.clear();
  const status = await selfUpdateStatus();
  appendLog(`[ok] launcher updated to ${versionLabel()}; restart to run it`, "ok");
  return {
    ok: true,
    applied: true,
    restartRequired: true,
    message: `Updated to ${versionLabel()}. Restart AI Tool Launcher to run the new version.`,
    output: pull.stdout,
    previous: before,
    self: status,
  };
}

function restartSession() {
  const serverFile = path.join(APP_DIR, "server.js");
  if (process.platform === "win32") {
    const script = `timeout /t 1 /nobreak > nul & ${winQuote(process.execPath)} ${winQuote(serverFile)}`;
    spawnDetached("cmd.exe", ["/d", "/s", "/c", script]);
  } else {
    spawnDetached("/usr/bin/env", ["bash", "-lc", `sleep 1; exec ${sh(process.execPath)} ${sh(serverFile)}`]);
  }
  setTimeout(() => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 750).unref();
  }, 150).unref();
}

async function launchTool(id, mode) {
  const tool = allToolDefs().find((item) => item.id === id);
  if (!tool) throw new Error("Unknown tool");
  if (config.firstRunComplete && !selectedToolSet().has(tool.id)) {
    throw new Error(`${tool.name} is not selected in this launcher`);
  }
  if (!tool.kind.includes(mode)) throw new Error("Unsupported launch mode");
  const detected = await detectTool(tool);
  if (!detected.installed) throw new Error(`${tool.name} is not installed`);
  if (!detected.configured) throw new Error(`${tool.name} is missing required environment`);

  const command = displayCommand(tool, mode, hostOs());
  let child = null;
  if (mode === "cli") {
    const manual = tool.commands && tool.commands[hostOs()] && tool.commands[hostOs()].cli;
    child = await openTerminal(tool, manual || tool.bin);
  } else {
    child = await openApp(tool, detected);
  }

  launched.set(tool.id, {
    running: true,
    pid: child && child.pid ? child.pid : null,
    startedAt: Date.now(),
    mode,
  });
  config.lastLaunched[tool.id] = Date.now();
  appendLog(`$ ${command}`, "cmd");
  appendLog(`[ok] ${tool.name} launched`, "ok");
  saveConfig(config);
  return { ok: true };
}

async function stopTool(id) {
  const launch = launched.get(id);
  const tool = allToolDefs().find((item) => item.id === id);
  if (launch && launch.pid) {
    try {
      process.kill(-launch.pid);
    } catch {
      try {
        process.kill(launch.pid);
      } catch {
        // The target may already be gone.
      }
    }
  }
  launched.delete(id);
  appendLog(`[--] ${(tool && tool.name) || id} stop requested`, "dim");
  return { ok: true };
}

function requireToken(req) {
  return req.headers["x-ai-launcher-token"] === SESSION_TOKEN;
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function serveStatic(pathname, res) {
  const target = pathname === "/" ? "/index.html" : pathname;
  const file = path.resolve(PUBLIC_DIR, `.${target}`);
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(file, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method === "GET" && pathname === "/api/session") {
    sendJson(res, 200, { ok: true, token: SESSION_TOKEN });
    return;
  }
  if (!requireToken(req)) {
    sendJson(res, 403, { ok: false, error: "Invalid session token" });
    return;
  }
  if (req.method === "GET" && pathname === "/api/status") {
    sendJson(res, 200, await statusPayload());
    return;
  }
  if (req.method === "POST" && pathname === "/api/preferences") {
    const body = await readBody(req);
    config = {
      ...config,
      selectedOs: ["linux", "macos", "windows"].includes(body.selectedOs) ? body.selectedOs : config.selectedOs,
      title: body.title !== undefined ? (String(body.title).slice(0, 80) || "AI Launcher") : config.title,
      theme: ["light", "dark"].includes(body.theme) ? body.theme : config.theme,
      accent: /^#[0-9a-f]{6}$/i.test(body.accent || "") ? body.accent : config.accent,
    };
    saveConfig(config);
    sendJson(res, 200, { ok: true, preferences: config });
    return;
  }
  if (req.method === "POST" && pathname === "/api/setup") {
    const body = await readBody(req);
    const selectedToolIds = normalizeSelectedToolIds(body.selectedToolIds);
    const removed = stopDeselectedLaunches(selectedToolIds);
    config.selectedOs = ["linux", "macos", "windows"].includes(body.selectedOs) ? body.selectedOs : hostOs();
    config.selectedToolIds = selectedToolIds;
    config.title = body.title !== undefined ? (String(body.title).slice(0, 80) || "AI Launcher") : (config.title || "AI Launcher");
    config.firstRunComplete = true;
    appendLog(`[ok] setup complete · ${config.selectedToolIds.length} tools selected`, "ok");
    if (removed.length) appendLog(`[--] ${removed.length} deselected tools stopped`, "dim");
    saveConfig(config);
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && pathname === "/api/scan") {
    sendJson(res, 200, { ok: true, tools: await scanTools() });
    return;
  }
  if (req.method === "POST" && pathname === "/api/tool") {
    const body = await readBody(req);
    const tool = normalizeTool(body.tool || body);
    const existing = config.customTools.filter((item) => item.id !== tool.id);
    config.customTools = [...existing, tool];
    if (!config.selectedToolIds.includes(tool.id)) config.selectedToolIds.push(tool.id);
    appendLog(`[ok] custom tool saved · ${tool.name}`, "ok");
    saveConfig(config);
    sendJson(res, 200, { ok: true, tool });
    return;
  }
  if (req.method === "POST" && pathname === "/api/tool-selection") {
    const body = await readBody(req);
    const selectedToolIds = normalizeSelectedToolIds(body.selectedToolIds);
    const removed = stopDeselectedLaunches(selectedToolIds);
    config.selectedToolIds = selectedToolIds;
    if (removed.length) appendLog(`[--] ${removed.length} deselected tools stopped`, "dim");
    saveConfig(config);
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && pathname === "/api/launch") {
    const body = await readBody(req);
    sendJson(res, 200, await launchTool(String(body.id || ""), String(body.mode || "")));
    return;
  }
  if (req.method === "POST" && pathname === "/api/stop") {
    const body = await readBody(req);
    sendJson(res, 200, await stopTool(String(body.id || "")));
    return;
  }
  if (req.method === "POST" && pathname === "/api/check-updates") {
    const self = await selfUpdateStatus();
    appendLog(self.message, self.available ? "warn" : "ok");
    sendJson(res, 200, { ok: true, self });
    return;
  }
  if (req.method === "POST" && pathname === "/api/apply-update") {
    sendJson(res, 200, await applySelfUpdate());
    return;
  }
  if (req.method === "POST" && pathname === "/api/reset-session") {
    sendJson(res, 200, { ok: true, message: "Resetting launcher session" });
    restartSession();
    return;
  }
  sendJson(res, 404, { ok: false, error: "Unknown API route" });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    const pathname = decodeURIComponent(parsed.pathname);
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }
    if (req.method === "GET") {
      serveStatic(pathname, res);
      return;
    }
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || String(error) });
  }
});

server.listen(PORT, HOST, () => {
  fs.writeFileSync(path.join(STATE_DIR, "server.pid"), `${process.pid}\n${HOST}\n${PORT}\n`);
  console.log(`${APP_NAME} running at http://${HOST}:${PORT}`);
});
