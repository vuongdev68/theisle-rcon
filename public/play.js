const STORAGE_KEY = "evrima_play_steamid";
const POLL_MS = 8000;
const MAP = { minX: -400000, maxX: 400000, minY: -400000, maxY: 400000 };

const STATS = [
  { key: "health", label: "Máu", cls: "blood" },
  { key: "stamina", label: "Stamina", cls: "stamina" },
  { key: "hunger", label: "Dạ dày", cls: "" },
  { key: "thirst", label: "Nước", cls: "water" },
  { key: "growth", label: "Growth", cls: "stamina" },
];

const state = {
  steamId: localStorage.getItem(STORAGE_KEY) ?? "",
  tab: "stats",
  timer: 0,
};

const steamInput = document.getElementById("steam-id");
const toastEl = document.getElementById("toast");
steamInput.value = state.steamId;

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  setTimeout(() => {
    toastEl.hidden = true;
  }, 2800);
}

function pct(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const n = value <= 1.5 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function fmtPct(value) {
  const n = pct(value);
  return n === null ? "—" : `${n}%`;
}

function worldToPoint(x, y) {
  const left = ((x - MAP.minX) / (MAP.maxX - MAP.minX)) * 100;
  const top = ((MAP.maxY - y) / (MAP.maxY - MAP.minY)) * 100;
  return {
    left: Math.max(2, Math.min(98, left)),
    top: Math.max(2, Math.min(98, top)),
  };
}

async function loadSnapshot() {
  const params = new URLSearchParams();
  if (state.steamId) {
    params.set("id", state.steamId);
  }
  const response = await fetch(`/api/play/snapshot?${params}`, { credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function renderServer(snapshot) {
  const server = snapshot.server ?? {};
  const name = server.name || "Server Evrima";
  const map = server.map ? ` · ${server.map}` : "";
  const count = `${server.players ?? 0}${server.maxPlayers ? `/${server.maxPlayers}` : ""}`;
  const status = server.connected ? "online" : "RCON chưa sẵn sàng";
  document.getElementById("server-line").textContent = `${name}${map} · ${count} người · ${status}`;
}

function renderStats(me) {
  const empty = document.getElementById("stats-empty");
  const card = document.getElementById("stats-card");
  if (!me) {
    empty.hidden = false;
    card.hidden = true;
    empty.textContent = state.steamId
      ? "SteamID này không online, hoặc RCON chưa có getplayerdata."
      : "Nhập SteamID và vào server để xem thông số dino.";
    return;
  }
  empty.hidden = true;
  card.hidden = false;
  document.getElementById("dino-class").textContent = me.playable || "Chưa chọn loài";
  document.getElementById("dino-name").textContent = me.name;
  const flags = [];
  if (me.isPrime) flags.push("Prime");
  if (me.isAlive === false) flags.push("Chết");
  if (me.gender) flags.push(me.gender);
  if (me.mutations?.length) flags.push(me.mutations.join(", "));
  document.getElementById("dino-flags").textContent = flags.join(" · ");
  document.getElementById("stat-bars").innerHTML = STATS.map((stat) => {
    const n = pct(me[stat.key]);
    return `<div class="stat"><span>${stat.label}</span><div class="bar ${stat.cls}"><span style="width:${n ?? 0}%"></span></div><strong>${fmtPct(me[stat.key])}</strong></div>`;
  }).join("");
}

function renderMap(snapshot) {
  const pins = document.getElementById("map-pins");
  const list = document.getElementById("map-list");
  const markers = snapshot.markers ?? [];
  pins.innerHTML = markers
    .map((marker) => {
      if (typeof marker.x !== "number" || typeof marker.y !== "number") {
        return "";
      }
      const point = worldToPoint(marker.x, marker.y);
      const title = `${marker.name}${marker.playable ? ` · ${marker.playable}` : ""}`;
      return `<div class="pin${marker.me ? " me" : ""}" style="left:${point.left}%;top:${point.top}%" title="${escapeHtml(title)}"></div>`;
    })
    .join("");
  const rows = markers
    .map((marker) => {
      const gps =
        typeof marker.x === "number" && typeof marker.y === "number"
          ? `${Math.round(marker.x / 1000)}, ${Math.round(marker.y / 1000)}`
          : "chưa có GPS";
      return `<li${marker.me ? ' class="me-label"' : ""}>${escapeHtml(marker.name)} · ${escapeHtml(marker.playable || "—")} · ${gps}</li>`;
    })
    .join("");
  list.innerHTML = `<p>${markers.length} trên map</p><ul>${rows || "<li>Chưa có ai online.</li>"}</ul>`;
}

function renderStash(snapshot) {
  const empty = document.getElementById("stash-empty");
  const card = document.getElementById("stash-card");
  const inv = snapshot.inventory ?? {};
  if (typeof inv.stomach !== "number" && typeof inv.water !== "number") {
    empty.hidden = false;
    card.hidden = true;
    return;
  }
  empty.hidden = true;
  card.hidden = false;
  document.getElementById("stash-stomach").style.width = `${pct(inv.stomach) ?? 0}%`;
  document.getElementById("stash-water").style.width = `${pct(inv.water) ?? 0}%`;
  document.getElementById("stash-stomach-label").textContent = `Đầy ${fmtPct(inv.stomach)}`;
  document.getElementById("stash-water-label").textContent = `Đầy ${fmtPct(inv.water)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function refresh() {
  try {
    const snapshot = await loadSnapshot();
    renderServer(snapshot);
    renderStats(snapshot.me);
    renderMap(snapshot);
    renderStash(snapshot);
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error));
  }
}

function setTab(name) {
  state.tab = name;
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== `tab-${name}`;
  });
}

document.getElementById("id-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.steamId = steamInput.value.trim();
  localStorage.setItem(STORAGE_KEY, state.steamId);
  void refresh();
});

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => setTab(btn.dataset.tab));
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInterval(state.timer);
    state.timer = 0;
    return;
  }
  startPolling();
});

function startPolling() {
  clearInterval(state.timer);
  void refresh();
  state.timer = setInterval(() => {
    if (!document.hidden) {
      void refresh();
    }
  }, POLL_MS);
}

startPolling();
