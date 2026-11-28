// Network route (relay protocol / TURN server), app version and client-reported
// recovery events on the admin call report.
const test = require("node:test");
const assert = require("node:assert/strict");
const { hostOfIceUrl, configuredTurnHosts, sanitizeTurnHost } = require("../utils/turnHost");
const { createAppClientMemory } = require("../utils/appClientMemory");
const { sanitizeStatsSample, createPendingStats, summarizeStats } = require("../utils/callStatsAggregator");
const { createCallReportRecorder, CLIENT_EVENT_MAX_PER_ROLE } = require("../utils/callReportRecorder");

const HOSTS = configuredTurnHosts([{ urls: ["turn:turn.example.com:3478?transport=udp", "turns:turn2.example.com:443"] }]);

test("only a configured TURN hostname is ever kept", () => {
  assert.equal(hostOfIceUrl("turns:Turn.Example.com:443?transport=tcp"), "turn.example.com");
  assert.equal(sanitizeTurnHost("turn2.example.com", HOSTS), "turn2.example.com");
  assert.equal(sanitizeTurnHost("turn:turn.example.com:3478?transport=udp", HOSTS), "turn.example.com");
  for (const forged of ["203.0.113.9", "evil.example", "<script>", "turn.example.com.evil.net"]) {
    assert.equal(sanitizeTurnHost(forged, HOSTS), "other", forged);
  }
  for (const missing of [undefined, null, "", 5, {}]) assert.equal(sanitizeTurnHost(missing, HOSTS), "");
});

test("relay protocol and TURN host are optional, validated and aggregated", () => {
  const old = sanitizeStatsSample({ rtt: 40, iceType: "relay" });
  assert.equal(old.relayProtocol, "");
  assert.equal(old.turnHost, "", "an older client sends neither");
  assert.equal(sanitizeStatsSample({ rtt: 40, relayProtocol: "sctp" }).relayProtocol, "");

  const pending = createPendingStats();
  pending.add(sanitizeStatsSample({ rtt: 40, iceType: "relay", relayProtocol: "tls", turnHost: "nowhere.invalid" }), 1);
  const update = {};
  pending.drainInto(update, "s");
  assert.equal(update.$inc["s.protocol.tls"], 1);
  assert.equal(update.$set["s.lastTurnHost"], "other");

  const summary = summarizeStats({ samples: 3, protocol: { udp: 1, tls: 2 }, lastTurnHost: "turn.example.com" });
  assert.equal(summary.relayProtocol, "tls");
  assert.equal(summary.turnHost, "turn.example.com");
  const none = summarizeStats({ samples: 1 });
  assert.equal(none.relayProtocol, "");
  assert.equal(none.turnHost, "");
});

test("app version headers are remembered per user, validated and expiring", () => {
  let clock = 1000;
  const memory = createAppClientMemory({ now: () => clock, ttlMs: 100, maxEntries: 2 });
  memory.remember("u1", { "x-client-platform": "android", "x-app-version": "1.2.0+24" });
  assert.deepEqual(memory.recall("u1"), { platform: "android", appVersion: "1.2.0+24" });
  memory.remember("u2", { "x-client-platform": "web", "x-app-version": "1" });
  memory.remember("u3", { "x-client-platform": "android", "x-app-version": "<b>" });
  assert.equal(memory.recall("u2"), null);
  assert.equal(memory.recall("u3"), null);
  memory.remember("u4", { "x-client-platform": "ios", "x-app-version": "2" });
  memory.remember("u5", { "x-client-platform": "ios", "x-app-version": "3" });
  assert.equal(memory.recall("u1"), null, "the oldest entry is dropped at the size cap");
  clock += 101;
  assert.equal(memory.recall("u5"), null, "expired");
});

test("client recovery events are recorded, filtered, spaced and capped", async () => {
  const writes = [];
  let clock = 1_000_000;
  const recorder = createCallReportRecorder({
    CallReport: { updateOne: async (filter, update) => writes.push(update) },
    now: () => clock,
  });
  const base = { appointmentId: "a1", role: "patient" };
  assert.equal(recorder.onClientEvent({ ...base, type: "manual_retry" }), undefined, "no report yet: nothing is created");

  await recorder.onJoin({ ...base, kind: "appointment", userId: "u" });
  writes.length = 0;
  await recorder.onClientEvent({ ...base, type: "pc_rebuild", reason: "media_stall<script>" });
  recorder.onClientEvent({ ...base, type: "pc_rebuild" }); // too soon
  recorder.onClientEvent({ ...base, type: "anything_else" });
  assert.equal(writes.length, 1);
  const [event] = writes[0].$push.events.$each;
  assert.equal(event.type, "pc_rebuild");
  assert.deepEqual(event.detail, { reason: "media_stallscript" });

  for (let i = 0; i < CLIENT_EVENT_MAX_PER_ROLE + 10; i += 1) {
    clock += 6000;
    await recorder.onClientEvent({ ...base, type: "ice_restart" });
  }
  assert.equal(writes.length, CLIENT_EVENT_MAX_PER_ROLE, "capped per participant");
});
