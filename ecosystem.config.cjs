const { dirname } = require("node:path");

module.exports = {
  apps: [
    {
      name: "evrima-rcon",
      cwd: dirname(__filename),
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      merge_logs: true,
      min_uptime: "10s",
      restart_delay: 4000,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
