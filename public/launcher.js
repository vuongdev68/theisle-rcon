const DEBUG_KEYS = [
  "LogRedpointEOS",
  "LogOnline",
  "LogOnlineGame",
  "LogNet",
  "LogNetTraffic",
  "LogReplicationGraph",
  "LogTheIsle",
  "LogTheIsleAdmin",
  "LogTheIsleAI",
  "LogTheIsleAnimInstance",
  "LogTheIsleAudio",
  "LogTheIsleAuth",
  "LogTheIsleCharacter",
  "LogTheIsleCharacterMovement",
  "LogTheIsleDatabase",
  "LogTheIsleEnvironment",
  "LogTheIsleGame",
  "LogTheIsleNetwork",
  "LogTheIsleServer",
  "LogTheIslePlayerController",
  "LogTheIsleUI",
  "LogTheIsleWorld",
  "LogTheIsleJoinData",
  "LogTheIsleChatData",
  "LogTheIsleKillData",
  "LogTheIsleCommandData",
  "LogTheIsleAntiCheat",
];

const launcher = {
  settings: null,
  chatPaused: false,
  chatTimer: 0,
};

function setFields(obj) {
  document.querySelectorAll("[data-set]").forEach((el) => {
    const key = el.dataset.set;
    const value = obj[key];
    if (el.type === "checkbox") {
      el.checked = Boolean(value);
      return;
    }
    if (Array.isArray(value)) {
      el.value = value.join("\n");
      return;
    }
    if (value === undefined || value === null) {
      return;
    }
    el.value = String(value);
  });
}

function collectFields() {
  const body = {};
  document.querySelectorAll("[data-set]").forEach((el) => {
    const key = el.dataset.set;
    if (el.type === "checkbox") {
      body[key] = el.checked;
      return;
    }
    if (el.tagName === "TEXTAREA" && ["adminSteamIds", "whitelistIds", "vipIds"].includes(key)) {
      body[key] = el.value.split(/\n/).map((item) => item.trim()).filter(Boolean);
      return;
    }
    body[key] = el.type === "number" ? Number(el.value) : el.value;
  });
  const dinoInputs = [...document.querySelectorAll("[data-dino]")];
  if (dinoInputs.length > 0) {
    body.dinosaurs = dinoInputs.map((input) => ({
      name: input.dataset.dino,
      enabled: input.checked,
    }));
  }
  const aiInputs = [...document.querySelectorAll("[data-disai]")];
  if (aiInputs.length > 0) {
    body.disallowedAIClasses = aiInputs.map((input) => ({
      name: input.dataset.disai,
      enabled: input.checked,
    }));
  }
  if (document.querySelector("[data-debug]")) {
    body.debugLogs = {};
    DEBUG_KEYS.forEach((key) => {
      const input = document.querySelector(`[data-debug="${key}"]`);
      body.debugLogs[key] = Boolean(input?.checked);
    });
  }
  const cores = [...document.querySelectorAll("[data-core]:checked")].map((input) => input.dataset.core);
  if (document.querySelector("[data-core]")) {
    body.cpuAffinity = cores.join(",");
  }
  const validate = document.getElementById("chk-validate");
  if (validate) {
    body.validateFiles = validate.checked;
  }
  return body;
}

function renderLists(settings) {
  document.getElementById("set-dinos").innerHTML = (settings.dinosaurs ?? [])
    .map(
      (item) =>
        `<label><input type="checkbox" data-dino="${escapeHtml(item.name)}" ${item.enabled ? "checked" : ""} /> ${escapeHtml(item.name)}</label>`,
    )
    .join("");
  document.getElementById("set-ai").innerHTML = (settings.disallowedAIClasses ?? [])
    .map(
      (item) =>
        `<label><input type="checkbox" data-disai="${escapeHtml(item.name)}" ${item.enabled ? "checked" : ""} /> ${escapeHtml(item.name)}</label>`,
    )
    .join("");
  document.getElementById("set-debug").innerHTML = DEBUG_KEYS.map(
    (key) =>
      `<label><input type="checkbox" data-debug="${key}" ${settings.debugLogs?.[key] ? "checked" : ""} /> ${key}</label>`,
  ).join("");
}

async function loadSettings() {
  const data = await api("/api/settings");
  launcher.settings = data.settings;
  setFields(data.settings);
  renderLists(data.settings);
  const cores = document.getElementById("cpu-cores");
  const selected = new Set((data.settings.cpuAffinity || "").split(",").filter(Boolean));
  cores.innerHTML = Array.from({ length: data.cpuCount || 0 }, (_, i) => {
    return `<label><input type="checkbox" data-core="${i}" ${selected.has(String(i)) ? "checked" : ""} /> Core ${i}</label>`;
  }).join("");
  document.getElementById("chk-validate").checked = Boolean(data.settings.validateFiles);
}

async function saveSettings(extra = {}) {
  const body = { ...collectFields(), ...extra };
  await api("/api/settings", { method: "POST", body });
  toast("Đã ghi Game.ini / Engine.ini / launcher_settings.ini");
  await loadSettings();
}

async function refreshLauncher() {
  try {
    const data = await api("/api/launcher/status");
  const stateName = data.process?.state ?? "stopped";
  const light = document.getElementById("status-light");
  const text = document.getElementById("status-text");
  const action = document.getElementById("btn-server-action");
  light.className = `status-light ${stateName === "running" ? "is-on" : "is-off"}`;
  text.textContent = `Status: ${stateName === "running" ? "Running" : stateName === "not_installed" ? "Not Installed" : stateName === "failed" ? "Crashed" : "Stopped"}`;
  if (stateName === "not_installed") {
    action.textContent = "Install Server";
    action.dataset.mode = "install";
  } else if (stateName === "running" || stateName === "starting") {
    action.textContent = data.busy ? "Working…" : "Stop Server";
    action.dataset.mode = "stop";
  } else {
    action.textContent = data.busy ? "Working…" : "Start Server";
    action.dataset.mode = "start";
  }
  action.disabled = Boolean(data.busy);
  document.getElementById("steam-log").textContent = (data.steam?.lastOutput ?? []).slice(-8).join("\n") || "SteamCMD: —";
  if (data.automation?.nextRestartAt) {
    document.getElementById("next-restart").textContent = `Next restart: ${new Date(data.automation.nextRestartAt).toLocaleString()}`;
  }
  } catch {
    // not logged in yet
  }
}

async function loadBackups() {
  const data = await api("/api/backups");
  document.getElementById("backup-folder").textContent = `Folder: ${data.folder}`;
  document.getElementById("backup-body").innerHTML = (data.backups ?? [])
    .map((item) => {
      const mb = (item.size / 1024 / 1024).toFixed(1);
      return `<tr><td>${escapeHtml(item.name)}</td><td>${mb} MB</td><td><button type="button" class="secondary" data-restore="${escapeHtml(item.name)}">Restore</button></td></tr>`;
    })
    .join("") || `<tr><td colspan="3">Chưa có backup</td></tr>`;
}

async function loadChat() {
  if (launcher.chatPaused) {
    return;
  }
  const channels = [
    document.getElementById("chat-global").checked ? "Global" : "",
    document.getElementById("chat-local").checked ? "Local" : "",
    document.getElementById("chat-admin").checked ? "Admin" : "",
  ].filter(Boolean);
  const data = await api(`/api/chat?channels=${channels.join(",")}`);
  document.getElementById("chat-log").textContent = (data.messages ?? [])
    .map((item) => `[${new Date(item.timestamp).toLocaleTimeString()}] [${item.channel}] ${item.player}: ${item.message}`)
    .join("\n");
}

async function loadRconOut() {
  const data = await api("/api/rcon/output");
  document.getElementById("rcon-output").textContent = (data.lines ?? [])
    .map((item) => `[${new Date(item.timestamp).toLocaleTimeString()}] ${item.action}\n${item.body}`)
    .join("\n\n");
}

window.onAdminView = (name) => {
  if (name === "settings" || name === "performance" || name === "automation" || name === "players" || name === "chat") {
    void loadSettings();
  }
  if (name === "automation") {
    void loadBackups();
  }
  if (name === "chat") {
    void loadChat();
  }
  if (name === "players") {
    void loadRconOut();
  }
};

document.querySelectorAll("[data-tabs]").forEach((nav) => {
  nav.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-pane]");
    if (!btn) {
      return;
    }
    nav.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab === btn));
    const prefix = nav.dataset.tabs === "auto" ? "pane-" : "pane-";
    const panes = nav.parentElement.querySelectorAll(".tab-pane");
    panes.forEach((pane) => {
      pane.hidden = pane.id !== `${prefix}${btn.dataset.pane}`;
    });
  });
});

document.getElementById("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettings();
});
document.getElementById("btn-save-perf").addEventListener("click", () => saveSettings());
document.getElementById("btn-save-auto").addEventListener("click", () => saveSettings());
document.getElementById("btn-save-broadcast").addEventListener("click", () => saveSettings());
document.querySelector('[data-set="autoBroadcastEnabled"]')?.addEventListener("change", () => {
  void saveSettings();
});
document.getElementById("btn-save-chat").addEventListener("click", () => saveSettings());

document.getElementById("chk-validate").addEventListener("change", async () => {
  await saveSettings({ validateFiles: document.getElementById("chk-validate").checked });
});

document.getElementById("btn-server-action").addEventListener("click", async () => {
  const mode = document.getElementById("btn-server-action").dataset.mode;
  await api(`/api/launcher/${mode}`, { method: "POST", body: {} });
  toast(mode === "install" ? "SteamCMD đang cài/validate…" : mode === "stop" ? "Đang stop…" : "Đang start…");
  void refreshLauncher();
});

document.getElementById("btn-restart").addEventListener("click", async () => {
  if (!confirm("Restart server?")) {
    return;
  }
  await api("/api/launcher/restart", { method: "POST", body: { confirm: true } });
  toast("Đang restart…");
});

document.getElementById("btn-backup-now").addEventListener("click", async () => {
  await api("/api/backups", { method: "POST", body: {} });
  toast("Đã tạo backup");
  void loadBackups();
});

document.getElementById("backup-body").addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-restore]");
  if (!btn) {
    return;
  }
  if (!confirm(`Restore ${btn.dataset.restore}? Server nên đang Stopped.`)) {
    return;
  }
  await api("/api/backups/restore", { method: "POST", body: { name: btn.dataset.restore } });
  toast("Đã restore backup");
});

document.getElementById("btn-discord-test").addEventListener("click", async () => {
  await api("/api/discord/test", { method: "POST", body: { url: document.querySelector('[data-set="discordWebhookUrl"]').value } });
  toast("Đã gửi test Discord");
});

document.getElementById("btn-rcon-test").addEventListener("click", async () => {
  const data = await api("/api/rcon/test", { method: "POST", body: {} });
  toast(data.health?.authenticated ? "RCON OK" : "RCON chưa auth");
  void loadRconOut();
});
document.getElementById("btn-rcon-clear").addEventListener("click", async () => {
  await api("/api/rcon/output/clear", { method: "POST", body: {} });
  void loadRconOut();
});

document.getElementById("btn-chat-pause").addEventListener("click", () => {
  launcher.chatPaused = !launcher.chatPaused;
  document.getElementById("btn-chat-pause").textContent = launcher.chatPaused ? "Resume" : "Pause";
});
document.getElementById("btn-chat-clear").addEventListener("click", async () => {
  await api("/api/chat/clear", { method: "POST", body: {} });
  document.getElementById("chat-log").textContent = "";
});

setInterval(() => {
  if (!document.getElementById("app-view").hidden) {
    void refreshLauncher();
  }
}, 4000);
setInterval(() => {
  if (!document.getElementById("view-chat").hidden) {
    void loadChat();
  }
}, 2000);

void refreshLauncher();
