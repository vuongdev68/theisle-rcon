const { dirname } = require("node:path");

/** PM2: web + RCON client. Secrets stay in `.env` (dotenv loads from cwd). */
module.exports = {
  apps: [
    {
      name: "evrima-rcon",
      cwd: dirname(__filename),
      script: "dist/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "400M",
      kill_timeout: 8000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
