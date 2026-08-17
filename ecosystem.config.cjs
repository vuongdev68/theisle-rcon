const { dirname } = require("node:path");

/**
 * Run `node dist/index.js` without PM2's ProcessContainer wrapper.
 * The wrapper makes argv[1] != index.js so the daemon never starts.
 */
module.exports = {
  apps: [
    {
      name: "evrima-rcon",
      cwd: dirname(__filename),
      script: "node",
      args: "dist/index.js",
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      merge_logs: true,
      max_memory_restart: "400M",
      kill_timeout: 8000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
