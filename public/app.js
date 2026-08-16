const state = {
  user: null,
  view: "dashboard",
  events: null,
  details: {},
  switches: {
    ai: null,
    chat: null,
    humans: null,
    migrations: null,
    growth: null,
    whitelist: null,
    learning: null,
    net: null,
  },
};

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const toastEl = document.getElementById("toast");
const modalEl = document.getElementById("modal");

async function api(path, options = {}) {
  const hasBody = options.body !== undefined;
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
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
    dashboard: ["Dashboard", "Start / Stop / Restart + đèn trạng thái process"],
    settings: ["Server Settings", "Sửa Game.ini / Engine.ini — Save All mới ghi file"],
    performance: ["Performance", "Streaming, nice, CPU affinity"],
    automation: ["Automation", "Crash, lịch restart, backup, Discord"],
    players: ["Administrator", "Kick, ban, DM, broadcast, RCON output"],
    world: ["Thế giới live", "Công tắc RCON khi server đang chạy"],
    chat: ["Chat Monitor", "Đọc log chat, không gửi chat"],
    console: ["Console", "Log live của process theisle"],
    audit: ["Nhật ký", "Lệnh admin gửi từ panel này"],
  };
  const pair = titles[name];
  document.getElementById("view-title").textContent = pair[0];
  document.getElementById("view-subtitle").textContent = pair[1];
  if (name === "players") {
    void loadPlayers();
  }
  if (name === "world") {
    void loadPlayables();
    void loadAIClasses();
  }
  if (name === "audit") {
    void loadAudit();
  }
  if (typeof window.onAdminView === "function") {
    window.onAdminView(name);
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
      card("Người chơi", `${details.currentPlayers ?? 0} / ${details.maxPlayers ?? "—"}`),
      card("Lệnh RCON", String(metrics.totalCommands ?? 0)),
      card("Reconnect", String(metrics.reconnectCount ?? 0)),
    ].join("");
    const publicDetails = { ...details };
    delete publicDetails.extra;
    document.getElementById("server-details").textContent = JSON.stringify(publicDetails, null, 2);
    state.details = details;
    applySwitchStates(details);
    if (typeof details.growthMultiplier === "number" && Number.isFinite(details.growthMultiplier)) {
      document.getElementById("growth-value").value = String(details.growthMultiplier);
    }
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
    body.innerHTML = `<tr><td colspan="6">Không có người chơi online</td></tr>`;
    return;
  }
  body.innerHTML = players
    .map((player) => {
      const id = player.id || player.steamId || "";
      const growth = player.growth == null ? "—" : Number(player.growth).toFixed(2);
      const health = player.health == null ? "—" : Number(player.health).toFixed(2);
      return `<tr>
        <td>${escapeHtml(player.name || "—")}</td>
        <td><code>${escapeHtml(id)}</code></td>
        <td>${escapeHtml(player.playable || "—")}</td>
        <td>${escapeHtml(growth)}</td>
        <td>${escapeHtml(health)}</td>
        <td class="actions">
          <button data-act="kick" data-id="${escapeAttr(id)}" data-name="${escapeAttr(player.name || "")}" type="button" class="secondary">Kick</button>
          <button data-act="slay" data-id="${escapeAttr(id)}" data-name="${escapeAttr(player.name || "")}" type="button" class="danger">Slay</button>
          <button data-act="ban" data-id="${escapeAttr(id)}" data-name="${escapeAttr(player.name || "")}" type="button" class="danger">Ban</button>
          <button data-act="message" data-id="${escapeAttr(id)}" type="button">Nhắn</button>
        </td>
      </tr>`;
    })
    .join("");
}

async function loadAIClasses() {
  try {
    const { classes } = await api("/api/world/ai-classes");
    const list = document.getElementById("ai-class-list");
    const kindVi = {
      "small carnivore": "ăn thịt nhỏ",
      flying: "bay",
      prey: "mồi",
      aquatic: "dưới nước",
    };
    list.innerHTML = classes
      .map(
        (item) => `<label class="switch-row">
          <div class="switch-copy">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(kindVi[item.kind] || item.kind)}</span>
          </div>
          <input type="checkbox" data-ai-class="${escapeAttr(item.name)}" checked />
        </label>`,
      )
      .join("");
  } catch (error) {
    toast(error.message);
  }
}

async function loadPlayables() {
  try {
    const { playables } = await api("/api/playables");
    const grid = document.getElementById("playables-grid");
    grid.innerHTML = playables
      .map(
        (item) => `<label>
          <input type="checkbox" data-playable="${escapeAttr(item.name)}" ${item.enabled === false ? "" : "checked"} />
          ${escapeHtml(item.name)}
        </label>`,
      )
      .join("");
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
  document.getElementById("modal-duration-wrap").hidden = action !== "ban";
  document.getElementById("modal-duration").value = "0";
  const labels = { kick: "Lý do kick", ban: "Lý do ban", message: "Nội dung tin" };
  const titles = { kick: "Kick", ban: "Ban", message: "Nhắn tin" };
  document.getElementById("modal-field-label").textContent = labels[action] ?? "Giá trị";
  document.getElementById("modal-title").textContent = `${titles[action] ?? action} · ${playerName || playerId}`;
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
  await api("/api/auth/logout", { method: "POST", body: {} });
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
  toast("Đã gửi thông báo");
});

document.getElementById("save-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const backupName = document.getElementById("save-name").value.trim();
  await api("/api/server/save", { method: "POST", body: backupName ? { backupName } : {} });
  toast("Đã save thế giới");
});
document.getElementById("btn-pause").addEventListener("click", async () => {
  await api("/api/server/pause", { method: "POST", body: {} });
  toast("Đã pause");
});
document.getElementById("btn-unpause").addEventListener("click", async () => {
  await api("/api/server/unpause", { method: "POST", body: {} });
  toast("Đã unpause");
});
document.getElementById("btn-queue").addEventListener("click", async () => {
  const { queue } = await api("/api/server/queue");
  document.getElementById("queue-status").textContent = JSON.stringify(queue, null, 2);
  toast("Đã đọc queue");
});
document.getElementById("btn-refresh-players").addEventListener("click", () => {
  void loadPlayers();
});

document.getElementById("players-body").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-act]");
  if (!button) {
    return;
  }
  if (button.dataset.act === "slay") {
    const id = button.dataset.id;
    if (!confirm(`Gửi slay ${id}?\nKhông phải lệnh dev — server có thể bỏ qua.`)) {
      return;
    }
    await api(`/api/players/${encodeURIComponent(id)}/slay`, { method: "POST", body: {} });
    toast(`Đã gửi slay ${id} (0x70, có thể bị bỏ qua)`);
    void loadPlayers();
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
      body: {
        reason: field,
        name: document.getElementById("modal-name").value,
        durationSeconds: Number(document.getElementById("modal-duration").value || 0),
      },
    });
  } else {
    await api(`/api/players/${id}/message`, { method: "POST", body: { message: field } });
  }
  modalEl.hidden = true;
  toast(`${action} sent`);
  void loadPlayers();
});

function applySwitchStates(details) {
  setSwitch("ai", details.spawnAI ?? state.switches.ai);
  setSwitch("chat", details.enableGlobalChat ?? state.switches.chat);
  setSwitch("humans", details.enableHumans ?? state.switches.humans);
  setSwitch("migrations", details.enableMigration ?? state.switches.migrations);
  setSwitch("whitelist", details.whitelist ?? state.switches.whitelist);
  setSwitch("growth", details.enableGrowthMultiplier ?? state.switches.growth);
  if (state.switches.learning !== null) {
    setSwitch("learning", state.switches.learning);
  }
  if (state.switches.net !== null) {
    setSwitch("net", state.switches.net);
  }
}

function setSwitch(name, value) {
  const button = document.querySelector(`[data-switch="${name}"]`);
  if (!button) {
    return;
  }
  if (value === true || value === false) {
    state.switches[name] = value;
    button.setAttribute("aria-pressed", value ? "true" : "false");
    button.querySelector("span").textContent = value ? "On" : "Off";
    return;
  }
  button.setAttribute("aria-pressed", "mixed");
  button.querySelector("span").textContent = "—";
}

const switchEndpoints = {
  ai: "/api/world/ai",
  chat: "/api/world/chat",
  humans: "/api/world/humans",
  migrations: "/api/world/migrations",
  growth: "/api/world/growth-toggle",
  whitelist: "/api/whitelist/toggle",
  learning: "/api/world/ai-learning",
  net: "/api/world/net-distance",
};

document.querySelectorAll("[data-switch]").forEach((button) => {
  button.addEventListener("click", async () => {
    const name = button.dataset.switch;
    const current = state.switches[name];
    const enabled = current === true ? false : true;
    button.disabled = true;
    try {
      await api(switchEndpoints[name], { method: "POST", body: { enabled } });
      setSwitch(name, enabled);
      const labels = {
        ai: "AI hoang dã",
        chat: "Global chat",
        humans: "Humans",
        migrations: "Migration",
        growth: "Hệ số grow",
        whitelist: "Whitelist",
        learning: "AI learning",
        net: "Net distance",
      };
      toast(`${labels[name] ?? name}: ${enabled ? "On" : "Off"}`);
      await refreshStatus();
    } finally {
      button.disabled = false;
    }
  });
});

document.getElementById("btn-wipe").addEventListener("click", async () => {
  if (!confirm("Dọn toàn bộ xác trên map?")) {
    return;
  }
  await api("/api/world/corpses", { method: "POST", body: { confirm: true } });
  toast("Đã dọn xác");
});

document.getElementById("growth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/world/growth", {
    method: "POST",
    body: { value: Number(document.getElementById("growth-value").value) },
  });
  toast("Đã đặt hệ số grow");
});

document.getElementById("density-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/world/ai-density", {
    method: "POST",
    body: { density: Number(document.getElementById("ai-density").value) },
  });
  toast("Đã đặt mật độ AI");
});

document.getElementById("btn-ai-classes").addEventListener("click", async () => {
  const disabled = [...document.querySelectorAll("[data-ai-class]")]
    .filter((input) => !input.checked)
    .map((input) => input.dataset.aiClass);
  await api("/api/world/ai-classes", { method: "POST", body: { classes: disabled } });
  toast(disabled.length ? `Đã tắt AI: ${disabled.join(", ")}` : "Tất cả loài AI đã cho spawn");
});

document.getElementById("playables-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const playables = [...document.querySelectorAll("[data-playable]")]
    .filter((input) => input.checked)
    .map((input) => input.dataset.playable);
  await api("/api/playables", { method: "POST", body: { playables } });
  toast("Đã cập nhật playables");
});

document.getElementById("wl-add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/whitelist/add", { method: "POST", body: { playerId: document.getElementById("wl-add-id").value } });
  toast("Đã thêm whitelist");
});
document.getElementById("wl-remove-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/whitelist/remove", {
    method: "POST",
    body: { playerId: document.getElementById("wl-remove-id").value },
  });
  toast("Đã xóa whitelist");
});

void boot();
