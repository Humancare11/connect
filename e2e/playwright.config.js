import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";
import {
  LOCAL_MONGO_URI,
  LOCAL_PORTS,
  resolveEnv,
} from "./helpers/env.js";

const { staging, baseURL } = resolveEnv();

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

let webServer;
// This file is evaluated again inside every worker process (TEST_WORKER_INDEX
// is set there) — the stack is already up by then, so only the main process
// checks ports and creates the temp DB dir.
const isMainProcess = process.env.TEST_WORKER_INDEX === undefined;
if (!staging && isMainProcess) {
  // Fail fast instead of silently reusing a dev server that is wired to a
  // shared/real database — the local stack must be the one WE start.
  for (const [name, port] of Object.entries(LOCAL_PORTS)) {
    if (await portInUse(port)) {
      throw new Error(
        `Port ${port} (${name}) is already in use. Stop whatever is using it, ` +
          `or point the tests at an existing environment with E2E_BASE_URL.`,
      );
    }
  }

  const mongod = process.env.MONGOD_BIN || "mongod";
  const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), "hcc-e2e-mongo-"));

  webServer = [
    {
      // Throwaway MongoDB (fresh temp dir every run, not the app's real DB).
      command: `"${mongod}" --dbpath "${dbPath}" --port ${LOCAL_PORTS.mongo} --bind_ip 127.0.0.1 --wiredTigerCacheSizeGB 0.25`,
      port: LOCAL_PORTS.mongo,
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: "node server.js",
      cwd: "../backend",
      url: `http://127.0.0.1:${LOCAL_PORTS.backend}/api/rtc/ice-servers`, // 401 == up
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: "development",
        PORT: String(LOCAL_PORTS.backend),
        // dotenv never overrides variables that are already set, so these win
        // over backend/.env — the backend talks to the throwaway DB only, and
        // outbound mail is pointed at a dead local port.
        MONGO_URI: LOCAL_MONGO_URI,
        FRONTEND_URL: baseURL,
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "1",
      },
    },
    {
      command: `npm run dev -- --port ${LOCAL_PORTS.frontend} --strictPort`,
      cwd: "../frontend",
      url: baseURL,
      timeout: 120_000,
      reuseExistingServer: false,
      // Frontend .env leaves VITE_API_URL empty, so Vite proxies /api and
      // /socket.io to http://localhost:5000 — the backend started above.
      // The tests read the app's "[RETRY-DEBUG]" console lines, which are off
      // unless this is set.
      env: { VITE_RETRY_DEBUG: "true" },
    },
  ];
}

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/.pw",
  globalSetup: "./global-setup.js",
  // One appointment / one doctor / one patient are shared, so tests must not
  // overlap.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["./reporters/summary-reporter.js"],
    ["html", { outputFolder: "test-results/html-report", open: "never" }],
  ],
  use: {
    baseURL,
    headless: true,
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        // Expose real host ICE candidates (no mDNS obfuscation) so two
        // browsers on one machine connect directly without needing TURN.
        "--disable-features=WebRtcHideLocalIpsWithMdns",
      ],
    },
  },
  webServer,
});
