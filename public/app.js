const state = {
  user: null,
  view: "dashboard",
  events: null,
};

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const toastEl = document.getElementById("toast");
const modalEl = document.getElementById("modal");

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  setTimeout(() => {
    toastEl.hidden = true;
  }, 2800);
}

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  toast(reason instanceof Error ? reason.message : String(reason ?? "Request failed"));
});

function setView(name) {
  state.view = name;
  document.querySelectorAll(".view").forEach((el) => {
    el.hidden = el.id !== `view-${name}`;
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.view === name);
  });
  const titles = {
    dashboard: ["Dashboard", "Server status and quick actions"],
    players: ["Players", "Kick, ban, and direct message"],
    world: ["World", "AI, growth, playables, corpses"],
    whitelist: ["Whitelist", "Add / remove / toggle"],
    console: ["Console", "Live journalctl stream"],
    audit: ["Audit", "Admin actions in this process"],
  };
  const pair = titles[name];
  document.getElementById("view-title").textContent = pair[0];
  document.getElementById("view-subtitle").textContent = pair[1];
  if (name === "players") {
    void loadPlayers();
  }
  if (name === "world") {
    void loadPlayables();
  }
  if (name === "audit") {
    void loadAudit();
  }
}

async function boot() {
  try {
    const me = await api("/api/auth/me");
    enterApp(me.user);
  } catch {
    loginView.hidden = false;
    appView.hidden = true;
  }
}

function enterApp(user) {
  state.user = user;
  loginView.hidden = true;
  appView.hidden = false;
  document.getElementById("pill-user").textContent = `${user.username} · ${user.role}`;
  connectEvents();
  void refreshStatus();
  void loadLogs();
  setInterval(() => {
    void refreshStatus();
  }, 8000);
}

async function refreshStatus() {
  try {
    const { status } = await api("/api/server/status");
    const health = status.health ?? {};
    const details = status.details ?? {};
    const metrics = status.metrics ?? {};
    const connected = Boolean(health.connected && health.authenticated);
    const conn = document.getElementById("pill-conn");
    conn.textContent = connected ? "RCON online" : "RCON offline";
    conn.className = `pill ${connected ? "is-on" : "is-off"}`;
    document.getElementById("pill-players").textContent = `${details.currentPlayers ?? metrics.playerCount ?? 0} players`;
    document.getElementById("pill-latency").textContent =
      health.latency == null ? "latency —" : `latency ${health.latency}ms`;
    document.getElementById("stat-cards").innerHTML = [
      card("Map", details.map ?? "—"),
      card("Players", `${details.currentPlayers ?? 0} / ${details.maxPlayers ?? "—"}`),
      card("Commands", String(metrics.totalCommands ?? 0)),
      card("Reconnects", String(metrics.reconnectCount ?? 0)),
    ].join("");
    const publicDetails = { ...details };
    delete publicDetails.extra;
    document.getElementById("server-details").textContent = JSON.stringify(publicDetails, null, 2);
  } catch (error) {
    document.getElementById("pill-conn").textContent = "RCON error";
    document.getElementById("pill-conn").className = "pill is-off";
    if (String(error.message).includes("Authentication")) {
      location.reload();
    }
  }
}

function card(label, value) {
  return `<div class="stat"><span>${label}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

async function loadPlayers() {
  const { players } = await api("/api/players");
  const body = document.getElementById("players-body");
  if (!players.length) {
    body.innerHTML = `<tr><td colspan="4">No players online</td></tr>`;
    return;
  }
  body.innerHTML = players
    .map((player) => {
      const id = player.id || player.steamId || "";
      return `<tr>
        <td>${escapeHtml(player.name || "—")}</td>
        <td><code>${escapeHtml(id)}</code></td>
        <td>${escapeHtml(player.playable || "—")}</td>
        <td>
          <button data-act="kick" data-id="${escapeAttr(id)}" data-name="${escapeAttr(player.name || "")}" type="button" class="secondary">Kick</button>
          <button data-act="ban" data-id="${escapeAttr(id)}" data-name="${escapeAttr(player.name || "")}" type="button" class="danger">Ban</button>
          <button data-act="message" data-id="${escapeAttr(id)}" type="button">DM</button>
        </td>
      </tr>`;
    })
    .join("");
}

async function loadPlayables() {
  try {
    const { playables } = await api("/api/playables");
    document.getElementById("playables-text").value = playables.map((item) => item.name).join(", ");
  } catch (error) {
    toast(error.message);
  }
}

async function loadAudit() {
  const { entries } = await api("/api/audit");
  document.getElementById("audit-body").innerHTML = entries
    .map(
      (entry) => `<tr>
        <td>${new Date(entry.timestamp).toLocaleString()}</td>
        <td>${escapeHtml(entry.actor)}</td>
        <td>${escapeHtml(entry.action)}</td>
        <td>${escapeHtml(entry.target || "—")}</td>
        <td>${entry.success ? "yes" : "no"}</td>
      </tr>`,
    )
    .join("");
}

async function loadLogs() {
  try {
    const { lines } = await api("/api/server/logs");
    const consoleEl = document.getElementById("console-log");
    consoleEl.textContent = lines.map((item) => item.line).join("\n");
    consoleEl.scrollTop = consoleEl.scrollHeight;
  } catch {
    /* journalctl may be unavailable off-box */
  }
}

function connectEvents() {
  if (state.events) {
    state.events.close();
  }
  const source = new EventSource("/api/events");
  state.events = source;
  source.addEventListener("logLine", (event) => {
    const payload = JSON.parse(event.data);
    const consoleEl = document.getElementById("console-log");
    consoleEl.textContent += `${consoleEl.textContent ? "\n" : ""}${payload.line}`;
    consoleEl.scrollTop = consoleEl.scrollHeight;
  });
  source.addEventListener("playerJoined", () => {
    void refreshStatus();
    if (state.view === "players") {
      void loadPlayers();
    }
  });
  source.addEventListener("playerLeft", () => {
    void refreshStatus();
    if (state.view === "players") {
      void loadPlayers();
    }
  });
}

function openModal(action, playerId, playerName = "") {
  document.getElementById("modal-action").value = action;
  document.getElementById("modal-player").value = playerId;
  document.getElementById("modal-name").value = playerName;
  document.getElementById("modal-field").value = "";
  document.getElementById("modal-name-wrap").hidden = action !== "ban";
  const labels = { kick: "Reason", ban: "Reason", message: "Message" };
  document.getElementById("modal-field-label").textContent = labels[action] ?? "Value";
  document.getElementById("modal-title").textContent = `${action} ${playerName || playerId}`;
  modalEl.hidden = false;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = document.getElementById("login-error");
  errorEl.hidden = true;
  try {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: {
        username: document.getElementById("login-username").value,
        password: document.getElementById("login-password").value,
      },
    });
    enterApp(result.user);
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  location.reload();
});

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

document.getElementById("announce-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("announce-text").value.trim();
  await api("/api/server/announce", { method: "POST", body: { message } });
  document.getElementById("announce-text").value = "";
  toast("Announcement sent");
});

document.getElementById("btn-save").addEventListener("click", async () => {
  await api("/api/server/save", { method: "POST", body: {} });
  toast("Save sent");
});
document.getElementById("btn-pause").addEventListener("click", async () => {
  await api("/api/server/pause", { method: "POST", body: {} });
  toast("Pause sent");
});
document.getElementById("btn-unpause").addEventListener("click", async () => {
  await api("/api/server/unpause", { method: "POST", body: {} });
  toast("Unpause sent");
});
document.getElementById("btn-restart").addEventListener("click", async () => {
  if (!confirm("Restart theisle systemd unit?")) {
    return;
  }
  await api("/api/server/restart", { method: "POST", body: { confirm: true } });
  toast("Restart requested");
});
document.getElementById("btn-refresh-players").addEventListener("click", () => {
  void loadPlayers();
});

document.getElementById("players-body").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-act]");
  if (!button) {
    return;
  }
  openModal(button.dataset.act, button.dataset.id, button.dataset.name || "");
});

document.getElementById("modal-cancel").addEventListener("click", () => {
  modalEl.hidden = true;
});

document.getElementById("modal-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const action = document.getElementById("modal-action").value;
  const id = encodeURIComponent(document.getElementById("modal-player").value);
  const field = document.getElementById("modal-field").value;
  if (action === "kick") {
    await api(`/api/players/${id}/kick`, { method: "POST", body: { reason: field } });
  } else if (action === "ban") {
    await api(`/api/players/${id}/ban`, {
      method: "POST",
      body: { reason: field, name: document.getElementById("modal-name").value },
    });
  } else {
    await api(`/api/players/${id}/message`, { method: "POST", body: { message: field } });
  }
  modalEl.hidden = true;
  toast(`${action} sent`);
  void loadPlayers();
});

document.querySelectorAll("[data-world]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const map = {
      ai: "/api/world/ai",
      chat: "/api/world/chat",
      humans: "/api/world/humans",
      migrations: "/api/world/migrations",
      "growth-toggle": "/api/world/growth-toggle",
    };
    await api(map[btn.dataset.world], { method: "POST", body: {} });
    toast(`${btn.dataset.world} sent`);
  });
});

document.getElementById("btn-wipe").addEventListener("click", async () => {
  if (!confirm("Wipe all corpses?")) {
    return;
  }
  await api("/api/world/corpses", { method: "POST", body: { confirm: true } });
  toast("wipecorpses sent");
});

document.getElementById("growth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/world/growth", {
    method: "POST",
    body: { value: Number(document.getElementById("growth-value").value) },
  });
  toast("Growth multiplier set");
});

document.getElementById("density-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/world/ai-density", {
    method: "POST",
    body: { density: Number(document.getElementById("ai-density").value) },
  });
  toast("AI density set");
});

document.getElementById("playables-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const playables = document
    .getElementById("playables-text")
    .value.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  await api("/api/playables", { method: "POST", body: { playables } });
  toast("Playables updated");
});

document.getElementById("btn-wl-on").addEventListener("click", async () => {
  await api("/api/whitelist/toggle", { method: "POST", body: { enabled: true } });
  toast("Whitelist enable sent");
});
document.getElementById("btn-wl-off").addEventListener("click", async () => {
  await api("/api/whitelist/toggle", { method: "POST", body: { enabled: false } });
  toast("Whitelist disable sent");
});
document.getElementById("btn-wl-toggle").addEventListener("click", async () => {
  await api("/api/whitelist/toggle", { method: "POST", body: {} });
  toast("Whitelist toggle sent");
});
document.getElementById("wl-add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/whitelist/add", { method: "POST", body: { playerId: document.getElementById("wl-add-id").value } });
  toast("Whitelist add sent");
});
document.getElementById("wl-remove-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/whitelist/remove", {
    method: "POST",
    body: { playerId: document.getElementById("wl-remove-id").value },
  });
  toast("Whitelist remove sent");
});

void boot();
