// Test harness for the Phase 2 wiring: a local Express app with the REAL search
// and settle controllers, the real search-events glue, the real recorder and
// background runner, a stub catalog, a fake AI layer and an in-memory store.
// No database connection is opened and no AI provider is contacted.
const express = require("express");
const { buildFixtureCatalog } = require("../search/fixtures");
const { createSearchController, createSettleController } = require("../../controllers/searchController");
const searchRouter = require("../../routes/search");
const { createSearchEvents, isSearchAnalyticsEnabled } = require("../../services/searchAnalytics/searchEvents");
const { createBackgroundRunner } = require("../../services/searchAnalytics/backgroundRunner");
const { createSearchInteractionRecorder } = require("../../services/searchAnalytics/recorder");

const duplicateKeyError = () => Object.assign(new Error("E11000 duplicate key"), { name: "MongoServerError", code: 11000 });

// In-memory stand-in for the model's updateOne (guarded upsert + unique id).
function createFakeStore({ onCall } = {}) {
  const docs = new Map();
  const calls = [];
  return {
    docs,
    calls,
    async updateOne(filter, update, options) {
      calls.push({ filter, update, options });
      if (onCall) await onCall(calls.length);
      const existing = docs.get(filter.interactionId);
      if (existing && existing.settledBy !== "submit") {
        Object.assign(existing, update.$set);
        return { matchedCount: 1, upsertedCount: 0 };
      }
      if (!options.upsert) return { matchedCount: 0, upsertedCount: 0 };
      if (docs.has(filter.interactionId)) throw duplicateKeyError();
      docs.set(filter.interactionId, { interactionId: filter.interactionId, ...update.$set, ...update.$setOnInsert });
      return { matchedCount: 0, upsertedCount: 1 };
    },
  };
}

// A fake AI layer: counts calls, never touches the network.
function createFakeAi(outcome = { status: "skipped", reason: "disabled" }) {
  const ai = { calls: 0, outcome, async understand() { ai.calls += 1; return typeof ai.outcome === "function" ? ai.outcome() : ai.outcome; } };
  return ai;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startHarness({
  flag = "true", store = createFakeStore(), ai = createFakeAi(), maxInFlight, record, analytics, getCatalogError, limiter,
} = {}) {
  const { catalog } = await buildFixtureCatalog();
  const env = { SEARCH_ANALYTICS_ENABLED: flag };
  const logs = [];
  const runner = createBackgroundRunner({ logger: (m) => logs.push(m), ...(maxInFlight ? { maxInFlight } : {}) });
  const recorder = createSearchInteractionRecorder({ store, logger: (m) => logs.push(m) });
  const dtos = [];
  const events = createSearchEvents({
    isEnabled: () => isSearchAnalyticsEnabled(env),
    run: runner.run,
    record: record || ((dto) => { dtos.push(dto); return recorder(dto); }),
  });

  const counters = { catalog: 0 };
  const getCatalog = async () => {
    counters.catalog += 1;
    if (getCatalogError) throw getCatalogError;
    return catalog;
  };
  const wiring = { getCatalog, analytics: analytics || events };

  const app = express();
  app.use(express.json());
  app.post("/api/search", createSearchController({ ...wiring, ai }));
  app.post("/api/search/settle", ...(limiter ? [limiter] : []), createSettleController(wiring));
  app.use("/api/search", searchRouter.handleSearchErrors);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const post = async (path, body, raw = false) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: raw ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* 204 / non-JSON */ }
    return { status: res.status, text, json };
  };

  // Waits until background analytics work has finished (or a safe cap).
  const drain = async () => {
    let quiet = 0;
    for (let i = 0; i < 200 && quiet < 4; i += 1) {
      await sleep(5);
      quiet = runner.stats().inFlight === 0 ? quiet + 1 : 0;
    }
  };

  return {
    env, store, logs, runner, dtos, ai, counters, catalog, baseUrl, post, drain,
    search: (body) => post("/api/search", body),
    settle: (body) => post("/api/search/settle", body),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

module.exports = { startHarness, createFakeStore, createFakeAi, sleep, duplicateKeyError };
