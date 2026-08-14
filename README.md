# The Isle: Evrima RCON Client / Manager

RCON client viết bằng Node.js + TypeScript để quản lý **The Isle: Evrima Dedicated Server**.

Chương trình này là **RCON CLIENT**. Nó kết nối tới RCON server có sẵn trong The Isle. Không sửa binary game, không cài lại dedicated server, không dùng thư viện RCON có sẵn làm core.

Protocol được tự implement trên `node:net`.

## 1. Giới thiệu

The Isle: Evrima **không dùng Source RCON**. Generic client như `mcrcon` / `rcon-cli` sẽ không kết nối được.

Evrima dùng protocol binary riêng:

- Auth: `0x01 + password + NUL`
- Command: `0x02 + opcode + arguments + NUL`
- Response: text, đôi khi có `0x03`, thường kết thúc bằng `NUL`
- Không có length prefix
- **Không có request ID trên wire**

Request ID trong client này là **client-side**, dùng để theo dõi `PendingRequest`, log latency, và ghép `Promise`. Vì server trả lời tuần tự (một request / một response), client serialize lệnh trên TCP (FIFO) nên `Promise.all([playerList(), getServerDetails()])` vẫn an toàn.

Nguồn đã đối chiếu trước khi implement:

1. [Theislemanager/evrima-rcon](https://github.com/Theislemanager/evrima-rcon) — bảng opcode kèm tài liệu Game.ini từ dev
2. [menix1337/isle-evrima-rcon](https://github.com/menix1337/isle-evrima-rcon) — client TypeScript đang maintain
3. [Butt4cak3/theislercon](https://github.com/Butt4cak3/theislercon) — reverse-engineering Go
4. [aerond7/TheIsleEvrimaRconClient](https://github.com/aerond7/TheIsleEvrimaRconClient) — client C#
5. [Game Host Bros — How To Use RCON On The Isle Evrima](https://www.gamehostbros.com/guides/games/the-isle-evrima/rcon)

Command nào không verify được thì **không bịa**. `getWhitelist()` bị đánh dấu unsupported. `execute("raw...")` vẫn gửi được qua opcode `custom` `0x70` và được log là unverified.

## 2. Kiến trúc

```
The Isle Evrima
        │
        │ TCP RCON :8888
        ▼
EvrimaRconClient
        │
        ├── Protocol
        ├── Parser
        ├── Authentication
        ├── Request Manager
        └── Reconnect
                │
                ▼
           Services
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
     Player   Server    Admin
     Service  Service   Service
        │       │        │
        └───────┼────────┘
                ▼
             CLI/API
                │
                ▼
           Web Panel

Song song:

systemd  →  The Isle Process
journalctl  →  ServerLogMonitor  →  Web Panel / Monitoring
```

RCON logic nằm trong `src/rcon/` và `src/services/`. Không nhúng protocol vào Express/Fastify route. systemd và journalctl là module độc lập trong `src/process/`.

## 3. Yêu cầu Ubuntu

- Ubuntu Linux (VPS chạy dedicated server)
- The Isle: Evrima Dedicated Server đã cài
- User không phải root, khuyến nghị `steam`
- RCON bind `127.0.0.1:8888` (không cần mở port ra Internet)
- `systemd` + `journalctl` nếu muốn quản lý process / live log

## 4. Cài Node.js

Node.js 20+:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

## 5. Cài project

```bash
cd /home/steam
git clone <repo-url> evrima-rcon
cd evrima-rcon
npm install
cp .env.example .env
nano .env
npm run build
```

## 6. Cấu hình .env

```env
RCON_HOST=127.0.0.1
RCON_PORT=8888
RCON_PASSWORD=your-strong-password
RCON_TIMEOUT=5000
RCON_RECONNECT=true
RCON_RECONNECT_DELAY=1000
RCON_RECONNECT_MAX_DELAY=30000
RCON_RECONNECT_MULTIPLIER=2
PLAYER_MONITOR_ENABLED=true
PLAYER_POLL_INTERVAL=5000
LOG_LEVEL=info
SYSTEMD_UNIT=theisle
```

Không hardcode password trong source. Không commit file `.env`.

## 7. Cấu hình Game.ini

File thường nằm tại:

`/home/steam/TheIsle/TheIsle/Saved/Config/LinuxServer/Game.ini`

```ini
[/Script/TheIsle.TIGameSession]
bRconEnabled=true
RconPassword="your-strong-password"
RconPort=8888
```

Khuyến nghị RCON chỉ listen local. Nếu log server ghi `RCON server listening at: 0.0.0.0:8888` thì vẫn **không mở firewall port 8888** ra Internet. Client này chạy trên cùng VPS và kết nối `127.0.0.1`.

## 8. Cách bật RCON

1. Set `bRconEnabled=true`
2. Set `RconPassword` và `RconPort`
3. Restart dedicated server: `sudo systemctl restart theisle`
4. Kiểm tra log:

```bash
journalctl -u theisle | grep -i rcon
```

Log thành công thường giống:

```
LogTemp: RCON server listening at: 0.0.0.0:8888
LogTemp: Warning: New RCON Connection Authenticated!
```

Sai password:

```
LogTemp: Warning: Unauthenticated RCON connection tried sending commands from: ...
```

## 9. Cách chạy CLI

Build rồi chạy:

```bash
npm run build
npm run cli
```

One-shot:

```bash
node dist/cli/cli.js playerlist
node dist/cli/cli.js serverdetails
node dist/cli/cli.js announce "Server restarting soon"
node dist/cli/cli.js getplayerdata 76561198000000000
node dist/cli/cli.js kick 76561198000000000 "AFK"
```

Interactive:

```
rcon> connect
rcon> playerlist
rcon> announce Server restart in 5 minutes
rcon> status
rcon> help
rcon> exit
```

## 10. Danh sách RCON command

Chỉ liệt kê command đã verify. Opcode là byte thứ hai sau `0x02`.

| Command | Opcode | Arguments | Response |
| --- | --- | --- | --- |
| `announce` | `0x10` | `message` | silent |
| `directmessage` | `0x11` | `playerId,message` | silent |
| `serverdetails` | `0x12` | | `ServerDetails` |
| `wipecorpses` | `0x13` | | silent |
| `getplayables` | `0x14` | | list |
| `updateplayables` | `0x15` | `ClassA,ClassB` hoặc `Class:enabled` | silent / text |
| `togglemigrations` | `0x19` | `0\|1` optional | silent |
| `ban` | `0x20` | `Name,SteamID64,Reason,Time` hoặc `playerId,reason` | silent |
| `togglegrowthmultiplier` | `0x21` | `0\|1` optional | silent |
| `setgrowthmultiplier` | `0x22` | `value` | silent |
| `togglenetupdatedistancechecks` | `0x23` | `0\|1` optional | silent |
| `kick` | `0x30` | `playerId,reason` | silent |
| `playerlist` | `0x40` | | `PlayerList` |
| `save` | `0x50` | `backupName` optional | silent |
| `pause` | `0x60` | `0\|1` optional (toggle) | silent |
| `custom` | `0x70` | unverified raw | unknown |
| `getplayerdata` | `0x77` | `playerId` optional | `PlayerData` |
| `togglewhitelist` | `0x81` | `0\|1` optional | silent |
| `addwhitelist` | `0x82` | `playerId` | silent |
| `removewhitelist` | `0x83` | `playerId` | silent |
| `toggleglobalchat` | `0x84` | `0\|1` optional | silent |
| `togglehumans` | `0x86` | `0\|1` optional | silent |
| `toggleai` | `0x90` | `0\|1` optional | silent |
| `disableaiclasses` | `0x91` | `Class1,Class2` | silent |
| `aidensity` | `0x92` | `0.0-1.0` | silent |
| `getqueuestatus` | `0x93` | | queue text |
| `toggleailearning` | `0x94` | `0\|1` optional (thường official) | silent |

Arguments nhiều field dùng **dấu phẩy**, không dùng space như Source RCON.

**Unsupported:** `getWhitelist` — không có opcode trong bảng hiện tại. Whitelist ID nằm trong `Game.ini` (`WhitelistIDs=`). Trạng thái on/off có trong `serverdetails` (`bServerWhitelist`).

Một số lệnh silent (save, announce, toggle*) có thể không trả body. Client đợi đến timeout rồi coi empty là success.

## 11. Player management

```ts
await rcon.playerList();
await rcon.getPlayerData(playerId);
await rcon.kickPlayer(playerId, "reason");
await rcon.banPlayer({ playerId, reason, name, durationSeconds: 0 });
await rcon.directMessage(playerId, "Please follow the rules");
```

`durationSeconds = 0` nghĩa là ban vĩnh viễn theo tài liệu hosting hiện tại.

`Player` chỉ chứa field server thực sự trả về. Field không có thì `undefined`. Field lạ được giữ trong `extra` và `raw`, không bị discard.

## 12. Server management

```ts
await rcon.getServerDetails();
await rcon.saveServer();
await rcon.pauseServer();
await rcon.unpauseServer();
await rcon.announce("Server restart in 5 minutes");
await rcon.getQueueStatus();
await rcon.getPlayables();
await rcon.updatePlayables(["Tyrannosaurus", "Triceratops", "Stegosaurus"]);
```

`pause` trên Evrima vốn là toggle. `pauseServer()` gửi `1`, `unpauseServer()` gửi `0`. Nếu build server của bạn bỏ qua argument thì cả hai đều toggle — kiểm tra bằng `getServerDetails()` / hành vi in-game.

## 13. Auto reconnect

Exponential backoff:

1. 1s
2. 2s
3. 4s
4. 8s
5. tối đa 30s

Giá trị lấy từ `RCON_RECONNECT_DELAY`, `RCON_RECONNECT_MULTIPLIER`, `RCON_RECONNECT_MAX_DELAY`. Counter reset khi authenticate thành công. Chỉ một reconnect loop tại một thời điểm.

## 14. Player monitor

Khi `PLAYER_MONITOR_ENABLED=true`, `PlayerMonitor` gọi `playerlist` mỗi `PLAYER_POLL_INTERVAL` (mặc định 5000ms). Không spam. So sánh snapshot cũ/mới rồi emit:

- `playerJoined`
- `playerLeft`
- `playerChanged`

```ts
rcon.on("playerJoined", (player) => { /* ... */ });
rcon.on("playerLeft", (player) => { /* ... */ });
```

## 15. Security

- RCON mặc định `127.0.0.1:8888`
- Password chỉ từ `.env` / environment
- Không log password, không log auth packet body
- `serverdetails.ServerPassword` được redact trong object parse
- `ServerProcessManager` chỉ cho `systemctl status|start|stop|restart <unit>`
- Dùng `child_process.execFile()`, không `exec("...")`
- Web API (sau này) không được trả password, không được chạy shell tùy ý
- Web Panel nên có authentication, authorization, admin role, rate limit, audit log

## 16. Troubleshooting

| Triệu chứng | Hướng xử lý |
| --- | --- |
| Timeout khi connect | RCON chưa bật, sai port, server chưa listen |
| `RconAuthenticationError` | Sai `RCON_PASSWORD` / `RconPassword` trong Game.ini |
| Không thấy log RCON | Xem `TheIsle.log` / `journalctl -u theisle` |
| Command silent không có output | Đúng behavior với save/toggle/announce |
| `getWhitelist` throw | Unsupported — đọc Game.ini |
| Generic RCON client fail | Evrima không phải Source RCON |
| Response parse thiếu field | Giữ `raw` / `extra`; format server có thể đổi theo patch |

## 17. Build

```bash
npm install
npm run build
node dist/index.js
```

TypeScript `strict: true`. Output: `dist/`.

## 18. Test

```bash
npm test
```

Unit test không cần live server: packet encode/decode, TCP partial/multi frame, request ID, auth, timeout, reconnect, parser.

Integration test:

```bash
RUN_RCON_INTEGRATION_TESTS=true RCON_PASSWORD=... npm run test:integration
```

Chỉ chạy khi biến trên = `true` và RCON đang listen `127.0.0.1:8888`.

## 19. Chạy bằng systemd

File mẫu: `deploy/evrima-rcon.service`

```bash
sudo cp deploy/evrima-rcon.service /etc/systemd/system/evrima-rcon.service
sudo systemctl daemon-reload
sudo systemctl enable --now evrima-rcon
sudo systemctl status evrima-rcon
```

Service:

```
User=steam
WorkingDirectory=/home/steam/evrima-rcon
ExecStart=/usr/bin/node /home/steam/evrima-rcon/dist/index.js
Restart=always
RestartSec=5
```

Không chạy bằng root nếu không cần.

The Isle process (`systemctl start theisle`) tách biệt với RCON manager.

## 20. Tích hợp Web Panel

Web Admin Panel chạy cùng process với RCON manager (Fastify). Route chỉ gọi **service layer**, không đụng protocol.

Mở trình duyệt (nên SSH tunnel / nginx, panel mặc định bind local):

```bash
cp .env.example .env
# Điền RCON_PASSWORD và WEB_PASSWORD
npm run build
npm start
```

Mặc định: `http://127.0.0.1:3000`

Từ máy bạn:

```bash
ssh -L 3000:127.0.0.1:3000 steam@your-vps
```

Rồi mở `http://127.0.0.1:3000`.

### Cấu hình web

```env
WEB_ENABLED=true
WEB_HOST=127.0.0.1
WEB_PORT=3000
WEB_USERNAME=admin
WEB_PASSWORD=change-me-too
```

Không để trống `WEB_PASSWORD`. Không trả `RCON_PASSWORD` qua API. Cookie session `HttpOnly` + `SameSite=Strict`. Có rate limit login và audit log in-memory.

### UI

- Dashboard: status, latency, announce, save / pause / restart
- Players: `playerlist`, kick, ban, directmessage
- World: AI, chat, humans, migrations, growth, wipecorpses, playables
- Whitelist: add / remove / toggle (`getWhitelist` unsupported)
- Console: `journalctl -u theisle -f` qua SSE
- Audit: lịch sử thao tác admin trong process hiện tại

### API

- `POST /api/auth/login`
- `GET /api/server/status`
- `GET /api/players`
- `GET /api/players/:id`
- `POST /api/players/:id/kick`
- `POST /api/players/:id/ban`
- `POST /api/server/announce`
- `POST /api/server/save`
- `POST /api/server/restart`
- `GET /api/server/logs`
- `GET /api/events` (SSE)

Phiên bản này **không có database**. Player realtime lấy từ RCON. Ban history lâu dài có thể thêm SQLite/PostgreSQL sau.

### Ví dụ library

```ts
import { EvrimaRconClient } from "evrima-rcon";

const rcon = new EvrimaRconClient({
  host: process.env.RCON_HOST!,
  port: Number(process.env.RCON_PORT),
  password: process.env.RCON_PASSWORD!,
});

await rcon.connect();
const players = await rcon.playerList();
const health = await rcon.healthCheck();
console.log(health);
```

Raw fallback:

```ts
await rcon.execute("playerlist");
await rcon.execute("announce Server restarting soon");
```
