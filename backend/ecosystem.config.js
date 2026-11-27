// PM2 definition of the production backend.
//
// Apply at deploy time (once, outside calling hours; PM2 keeps the old settings
// until the process is deleted):
//   pm2 delete humancareconnect-backend && pm2 start ecosystem.config.js && pm2 save
//
// node runs server.js directly (not through npm) so SIGINT/SIGTERM reach it and
// the graceful shutdown (utils/gracefulShutdown.js) runs. server.js picks its env
// file from NODE_ENV; keep every other value and all secrets out of this file.
module.exports = {
  apps: [
    {
      name: "humancareconnect-backend",
      script: "server.js",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      // Longer than the 10s after which graceful shutdown forces its own exit.
      kill_timeout: 12000,
      env: { NODE_ENV: "production" },
    },
  ],
};
