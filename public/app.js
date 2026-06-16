"use strict";

const app = document.getElementById("app");

const state = {
  token: "",
  data: null,
  scan: null,
  now: Date.now(),
  phase: 0,
  settingsOpen: false,
  setupSelections: new Set(),
  busy: new Set(),
  updateMessage: "",
};

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(state.token ? { "X-AI-Launcher-Token": state.token } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "style") node.setAttribute("style", value);
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

function fmtTime(ts = state.now) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDuration(startedAt) {
  if (!startedAt) return "external";
  const seconds = Math.max(0, Math.floor((state.now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function fmtAgo(ts) {
  if (!ts) return "never launched";
  const seconds = Math.max(0, Math.floor((state.now - ts) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function terminalName(osName) {
  return { linux: "konsole", macos: "Terminal", windows: "Windows Terminal" }[osName] || "terminal";
}

function osLabel(osName) {
  return { linux: "Linux", macos: "macOS", windows: "Windows" }[osName] || osName;
}

function shownTools() {
  return state.data ? state.data.tools : [];
}

function registryTools() {
  return state.scan || (state.data ? state.data.registry : []);
}

function selectedIds() {
  const prefs = state.data.preferences;
  if (!prefs.firstRunComplete && state.setupSelections.size) return state.setupSelections;
  return new Set((state.data.registry || []).filter((tool) => tool.selected).map((tool) => tool.id));
}

function statusForPhase(tool) {
  const phase = state.phase % 4;
  if (phase === 0) {
    if (!tool.installed) return { label: "VER", text: "not installed", color: "var(--danger)" };
    return { label: "VER", text: tool.version ? `v${tool.version}` : "installed", color: "var(--ok)" };
  }
  if (phase === 1) {
    const path = tool.detectedPath || "no path detected";
    return { label: "ENV", text: tool.configured ? path : "missing required environment", color: tool.configured ? "var(--term-fg)" : "var(--warn)" };
  }
  if (phase === 2) {
    return { label: "STATE", text: tool.running ? `running · ${fmtDuration(tool.startedAt)}` : tool.statusText, color: tool.running ? "var(--ok)" : "var(--muted)" };
  }
  return { label: "LAST", text: fmtAgo(tool.lastLaunched), color: "var(--term-fg)" };
}

function renderTopbar(data) {
  const prefs = data.preferences;
  const running = shownTools().filter((tool) => tool.running).length;
  const missing = shownTools().filter((tool) => !tool.installed || !tool.configured).length;
  const osTabs = ["linux", "macos", "windows"].map((id) =>
    h("button", {
      class: prefs.selectedOs === id ? "active" : "",
      text: osLabel(id),
      onclick: () => savePreferences({ selectedOs: id }),
    }),
  );

  return h("div", { class: "topbar" }, [
    h("div", { class: "mark" }, [h("span"), h("span")]),
    h("div", { class: "titleblock" }, [
      h("h1", { class: "apptitle", text: prefs.title || "AI Launcher" }),
      h("div", { class: "subtitle", text: `MISSION CONTROL · ${shownTools().length} TOOLS` }),
    ]),
    h("div", { class: "top-actions" }, [
      h("div", { class: "pill" }, [
        h("span", { class: running ? "dot live" : "dot off" }),
        h("span", { text: `${running} running` }),
      ]),
      h("div", { class: "pill" }, [
        h("span", { class: missing ? "dot warn" : "dot live" }),
        h("span", { text: missing ? `${missing} needs setup` : "ready" }),
      ]),
      h("div", { class: "os-tabs" }, osTabs),
      h("button", { class: "icon-btn", title: "Toggle theme", text: prefs.theme === "dark" ? "☾" : "☀", onclick: toggleTheme }),
      h("button", { class: "icon-btn", title: "Settings", text: "⚙", onclick: () => { state.settingsOpen = true; render(); } }),
    ]),
  ]);
}

function renderTerminal(data) {
  const osName = data.preferences.selectedOs;
  const rows = shownTools().filter((tool) => tool.kind.includes("cli") || tool.selected).map((tool) => {
    const status = statusForPhase(tool);
    return h("div", { class: "status-row" }, [
      h("div", { class: "status-line" }, [
        h("span", { class: "prompt", text: "$" }),
        h("span", { class: "bin", text: tool.bin || tool.name.toLowerCase().replace(/\s+/g, "-") }),
        h("span", { class: "vendor", text: tool.vendor }),
        h("span", { class: "status-label", text: status.label }),
      ]),
      h("div", { class: "status-text", style: `color:${status.color}`, text: status.text }),
    ]);
  });
  const log = (data.log || []).slice(-8).map((item) => h("div", { class: `log-line ${item.kind || ""}`, text: item.line }));

  return h("section", { class: "terminal-panel" }, [
    h("div", { class: "terminal-head" }, [
      h("span", { class: "traffic red" }),
      h("span", { class: "traffic yellow" }),
      h("span", { class: "traffic green" }),
      h("span", { class: "terminal-name", text: `status - ${terminalName(osName)}` }),
      h("span", { class: "clock", text: fmtTime() }),
    ]),
    h("div", { class: "status-list" }, [
      h("div", { class: "status-kicker", text: "CLI STATUS · rotating" }),
      ...rows,
    ]),
    h("div", { class: "log" }, [
      ...log,
      h("div", { class: "log-line cmd" }, [document.createTextNode("$ "), h("span", { class: "cursor" })]),
    ]),
  ]);
}

function renderToolCard(tool) {
  const command = tool.modes[0] ? tool.modes[0].command : "";
  const actions = [];
  for (const mode of tool.modes) {
    actions.push(h("button", {
      class: `action ${mode.mode === "app" ? "" : "primary"}`,
      text: mode.label,
      disabled: !mode.enabled || state.busy.has(`${tool.id}:${mode.mode}`),
      onclick: () => launch(tool.id, mode.mode),
    }));
  }
  if (tool.running) {
    actions.push(h("button", {
      class: "action",
      text: "STOP",
      onclick: () => stop(tool.id),
    }));
  }

  return h("div", { class: "tool-card", style: `--tool-color:${tool.color}` }, [
    h("div", { class: "avatar", text: tool.glyph || tool.name.slice(0, 2).toUpperCase() }),
    h("div", { class: "tool-body" }, [
      h("div", { class: "tool-title" }, [
        h("span", { class: "tool-name", text: tool.name }),
        h("span", { class: "vendor", text: tool.vendor }),
        ...tool.kind.map((kind) => h("span", { class: "badge", text: kind.toUpperCase() })),
      ]),
      h("div", { class: "command", title: command, text: command }),
      h("div", { class: "state" }, [
        h("span", { class: tool.running ? "dot live" : tool.installed ? "dot off" : "dot warn" }),
        h("span", { text: tool.running ? `running · ${fmtDuration(tool.startedAt)}` : tool.statusText }),
      ]),
    ]),
    h("div", { class: "tool-actions" }, actions),
  ]);
}

function renderLauncher() {
  const tools = shownTools();
  const running = tools.filter((tool) => tool.running).length;
  return h("section", { class: "launcher" }, [
    h("div", { class: "section-head" }, [
      h("span", { class: "section-title", text: "LAUNCHER" }),
      h("span", { class: "section-meta", text: `click to open · ${running} active` }),
    ]),
    h("div", { class: "tool-list" }, tools.map(renderToolCard)),
  ]);
}

function renderTaskbar(data) {
  const running = shownTools().filter((tool) => tool.running);
  return h("div", { class: "taskbar" }, [
    h("div", { class: "taskbar-brand" }, [
      h("div", { class: "task-icon", text: "A" }),
      h("span", { class: "taskbar-title", text: data.preferences.title || "AI Launcher" }),
      h("span", { class: "muted", text: "pinned" }),
    ]),
    h("div", { class: "divider" }),
    h("div", { class: "running-strip" }, running.length
      ? running.map((tool) => h("div", { class: "running-chip", title: tool.name, text: tool.glyph || tool.name[0] }))
      : [h("span", { class: "muted", text: "no apps running" })]),
    h("span", { class: "muted", text: osLabel(data.preferences.selectedOs) }),
    h("strong", { text: fmtTime() }),
  ]);
}

function renderSetup(data) {
  const tools = registryTools();
  const ids = selectedIds();
  if (!state.setupSelections.size) {
    for (const tool of tools.filter((tool) => tool.installed)) state.setupSelections.add(tool.id);
  }

  const rows = tools.map((tool) => {
    const checkbox = h("input", {
      type: "checkbox",
      checked: ids.has(tool.id),
      onchange: (event) => {
        if (event.target.checked) state.setupSelections.add(tool.id);
        else state.setupSelections.delete(tool.id);
      },
    });
    return h("label", { class: "picker-row" }, [
      checkbox,
      h("div", {}, [
        h("div", { class: "picker-name", text: tool.name }),
        h("div", { class: "picker-meta", text: `${tool.vendor} · ${tool.kind.join("+")} · ${tool.installed ? tool.detectedPath || "installed" : "not found"}` }),
      ]),
      h("span", { class: "badge", text: tool.installed ? "FOUND" : "OPTIONAL" }),
    ]);
  });

  return h("div", { class: "modal-backdrop" }, [
    h("div", { class: "modal" }, [
      h("div", { class: "modal-head" }, [
        h("h2", { text: "Set Up AI Launcher" }),
        h("p", { text: "Choose your OS display, scan this machine, then select the AI tools you want in the launcher." }),
      ]),
      h("div", { class: "modal-body setup-grid" }, [
        h("div", { class: "panel" }, [
          h("div", { class: "field" }, [
            h("span", { text: "Operating system" }),
            h("div", { class: "segmented" }, ["linux", "macos", "windows"].map((id) => h("button", {
              class: data.preferences.selectedOs === id ? "active" : "",
              text: osLabel(id),
              onclick: () => savePreferences({ selectedOs: id }),
            }))),
          ]),
          h("div", { class: "field" }, [
            h("span", { text: "Launcher title" }),
            h("input", { id: "setupTitle", value: data.preferences.title || "AI Launcher" }),
          ]),
          h("button", { class: "small-btn primary", text: "Scan For Tools", onclick: runScan }),
          h("p", { class: "muted", style: "margin-top:12px", text: `Host detected as ${osLabel(data.app.hostOs)}. Scan results are stored only in your local config.` }),
        ]),
        h("div", { class: "panel" }, [
          h("div", { class: "section-head" }, [
            h("span", { class: "section-title", text: "TOOLS" }),
            h("button", { class: "small-btn", text: "Add Manual", onclick: () => showManualPrompt() }),
          ]),
          h("div", { class: "tool-picker" }, rows),
        ]),
      ]),
      h("div", { class: "modal-foot" }, [
        h("button", { text: "Refresh", onclick: refresh }),
        h("button", { class: "primary", text: "Start Launcher", onclick: finishSetup }),
      ]),
    ]),
  ]);
}

function renderSettings(data) {
  if (!state.settingsOpen) return null;
  return h("aside", { class: "drawer" }, [
    h("div", { class: "drawer-head" }, [
      h("h2", { text: "Settings" }),
      h("button", { class: "icon-btn", text: "×", onclick: () => { state.settingsOpen = false; render(); } }),
    ]),
    h("div", { class: "drawer-body settings-grid" }, [
      h("div", { class: "panel" }, [
        h("div", { class: "field" }, [
          h("span", { text: "Launcher title" }),
          h("input", { id: "titleInput", value: data.preferences.title || "AI Launcher" }),
        ]),
        h("div", { class: "field" }, [
          h("span", { text: "Accent color" }),
          h("input", { id: "accentInput", type: "color", value: data.preferences.accent || "#f5c211" }),
        ]),
        h("button", { class: "small-btn primary", text: "Save Appearance", onclick: saveAppearance }),
      ]),
      h("div", { class: "panel" }, [
        h("div", { class: "section-head" }, [
          h("span", { class: "section-title", text: "TOOLS" }),
          h("span", { class: "section-meta", text: `${shownTools().length} selected` }),
        ]),
        h("button", { class: "small-btn primary", text: "Scan For New Tools", onclick: runScan }),
        h("button", { class: "small-btn", style: "margin-left:8px", text: "Edit Selection", onclick: () => { state.data.preferences.firstRunComplete = false; render(); } }),
        h("button", { class: "small-btn", style: "margin-left:8px", text: "Add Manual", onclick: () => showManualPrompt() }),
      ]),
      h("div", { class: "panel" }, [
        h("div", { class: "section-head" }, [
          h("span", { class: "section-title", text: "UPDATES" }),
        ]),
        h("button", { class: "small-btn primary", text: state.busy.has("updates") ? "Checking..." : "Check Repo Updates", onclick: checkUpdates }),
        h("p", { class: "muted", style: "margin-top:10px", text: state.updateMessage || "Checks whether this launcher git checkout has upstream updates." }),
      ]),
      h("div", { class: "panel" }, [
        h("div", { class: "section-title", text: "SECURITY" }),
        h("p", { class: "muted", style: "margin-top:8px", text: "The control API is bound to 127.0.0.1 and write actions require a per-session token. Tool config stays in your local user config directory." }),
      ]),
    ]),
  ]);
}

function render() {
  if (!state.data) return;
  const prefs = state.data.preferences;
  document.documentElement.style.setProperty("--accent", prefs.accent || "#f5c211");
  app.className = `app theme-${prefs.theme || "dark"}`;
  app.replaceChildren(h("div", { class: "shell" }, [
    renderTopbar(state.data),
    h("main", { class: "main" }, [renderTerminal(state.data), renderLauncher()]),
    renderTaskbar(state.data),
    ...(prefs.firstRunComplete ? [] : [renderSetup(state.data)]),
    ...(state.settingsOpen ? [renderSettings(state.data)] : []),
  ]));
}

async function refresh() {
  state.data = await api("/api/status");
  render();
}

async function savePreferences(next) {
  const prefs = { ...state.data.preferences, ...next };
  await api("/api/preferences", { method: "POST", body: JSON.stringify(prefs) });
  await refresh();
}

async function toggleTheme() {
  await savePreferences({ theme: state.data.preferences.theme === "dark" ? "light" : "dark" });
}

async function saveAppearance() {
  const title = document.getElementById("titleInput").value.trim() || "AI Launcher";
  const accent = document.getElementById("accentInput").value || "#f5c211";
  await savePreferences({ title, accent });
}

async function runScan() {
  const key = "scan";
  state.busy.add(key);
  render();
  try {
    const result = await api("/api/scan", { method: "POST", body: "{}" });
    state.scan = result.tools;
    state.setupSelections = new Set(result.tools.filter((tool) => tool.installed).map((tool) => tool.id));
    await refresh();
  } catch (error) {
    alert(error.message || String(error));
  } finally {
    state.busy.delete(key);
    render();
  }
}

async function finishSetup() {
  const titleInput = document.getElementById("setupTitle");
  await api("/api/setup", {
    method: "POST",
    body: JSON.stringify({
      selectedOs: state.data.preferences.selectedOs,
      selectedToolIds: [...state.setupSelections],
      title: titleInput ? titleInput.value.trim() || "AI Launcher" : "AI Launcher",
    }),
  });
  state.scan = null;
  await refresh();
}

async function showManualPrompt() {
  const name = prompt("Tool name");
  if (!name) return;
  const bin = prompt("CLI command or app executable", name.toLowerCase().replace(/\s+/g, "-"));
  if (!bin) return;
  const kind = confirm("Is this a CLI tool? Press Cancel for app.") ? ["cli"] : ["app"];
  await api("/api/tool", {
    method: "POST",
    body: JSON.stringify({ tool: { name, bin, kind } }),
  });
  await refresh();
}

async function launch(id, mode) {
  const key = `${id}:${mode}`;
  state.busy.add(key);
  render();
  try {
    await api("/api/launch", { method: "POST", body: JSON.stringify({ id, mode }) });
    window.setTimeout(refresh, 800);
  } catch (error) {
    alert(error.message || String(error));
  } finally {
    state.busy.delete(key);
    render();
  }
}

async function stop(id) {
  await api("/api/stop", { method: "POST", body: JSON.stringify({ id }) });
  await refresh();
}

async function checkUpdates() {
  state.busy.add("updates");
  render();
  try {
    const result = await api("/api/check-updates", { method: "POST", body: "{}" });
    state.updateMessage = result.self.message;
    await refresh();
  } catch (error) {
    state.updateMessage = error.message || String(error);
  } finally {
    state.busy.delete("updates");
    render();
  }
}

async function boot() {
  const session = await api("/api/session");
  state.token = session.token;
  await refresh();
}

window.setInterval(() => {
  state.now = Date.now();
  render();
}, 1000);

window.setInterval(() => {
  state.phase += 1;
  render();
}, 2600);

window.setInterval(() => {
  if (state.token && state.data && state.data.preferences.firstRunComplete) {
    refresh().catch(() => {});
  }
}, 6000);

boot().catch((error) => {
  app.replaceChildren(h("div", { class: "boot", text: error.message || String(error) }));
});
