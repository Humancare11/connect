const test = require("node:test");
const assert = require("node:assert/strict");
const { createCallReportRecorder, STATS_FLUSH_MS, STATS_FOLD_MIN_GAP_MS } = require("../utils/callReportRecorder");
const { sanitizeStatsSample, createPendingStats, summarizeStats, connectionTypeLabel } = require("../utils/callStatsAggregator");
const { buildCallReportView, buildCallSummary } = require("../utils/callReportView");

const APPT = "64b64b64b64b64b64b64b64b";
const web = { platform: "web", platformSource: "ua-inferred", browser: "Chrome", browserVersion: "130", osName: "Windows", osVersion: "11", label: "Web (Chrome 130 on Windows 11)" };

function setup() {
  const ops = [];
  const timers = [];
  let t = Date.parse("2026-01-01T10:00:00Z");
  const CallReport = { updateOne: async (filter, update, options) => { ops.push({ filter, update, options }); } };
  const recorder = createCallReportRecorder({
    CallReport,
    logger: { warn() {} },
    now: () => t,
    setTimer: (fn, ms) => { const h = { fn, ms, cleared: false }; timers.push(h); return h; },
    clearTimer: (h) => { h.cleared = true; },
  });
  return { ops, timers, recorder, advance: (ms) => { t += ms; } };
}
const statOps = (ops) => ops.filter((o) => o.update.$inc && o.update.$inc["participants.patient.stats.samples"] !== undefined);
const good = { rtt: 40, packetLoss: 0.01, jitter: 5, bitrateKbps: 900, iceType: "srflx", quality: "good" };

test("sanitizeStatsSample drops forged, out-of-range and wrong-typed fields", () => {
  const s = sanitizeStatsSample({
    rtt: -5, packetLoss: 7, jitter: "5", bitrateKbps: NaN, iceType: "evil", quality: "<script>",
    connectionState: "con<b>nected</b>".repeat(10), resolution: "1280x720", reconnects: 1e9, extra: { $where: "1" },
  });
  assert.equal(s, null, "nothing usable -> dropped");
  const t = sanitizeStatsSample({ rtt: 30, packetLoss: 2, iceType: "relay", quality: "nope", resolution: "javascript:1", reconnects: 3 });
  assert.equal(t.rtt, 30);
  assert.equal(t.packetLoss, null, "loss is a 0..1 ratio; 2 is rejected, not clamped");
  assert.equal(t.iceType, "relay");
  assert.equal(t.quality, "unknown");
  assert.equal(t.resolution, "");
  assert.equal(t.reconnects, 3);
  assert.equal("extra" in t, false, "unknown fields are never carried through");
  assert.equal(sanitizeStatsSample("x"), null);
  assert.equal(sanitizeStatsSample([1]), null);
  assert.equal(sanitizeStatsSample(null), null);
});

test("aggregation keeps min/avg/max, ICE and quality counts", () => {
  const p = createPendingStats();
  p.add(sanitizeStatsSample({ rtt: 100, packetLoss: 0.1, jitter: 10, bitrateKbps: 500, iceType: "relay", quality: "poor" }), 1000);
  p.add(sanitizeStatsSample({ rtt: 300, packetLoss: 0.3, jitter: 30, bitrateKbps: 700, iceType: "relay", quality: "weak" }), 2000);
  p.add(sanitizeStatsSample({ rtt: 200, iceType: "host", quality: "good" }), 3000);
  const update = {};
  assert.equal(p.drainInto(update, "x"), true);
  assert.equal(p.size, 0);
  assert.equal(update.$inc["x.samples"], 3);
  assert.equal(update.$inc["x.rttSum"], 600);
  assert.equal(update.$inc["x.rttN"], 3);
  assert.equal(update.$min["x.rttMin"], 100);
  assert.equal(update.$max["x.rttMax"], 300);
  assert.equal(update.$inc["x.ice.relay"], 2);
  assert.equal(update.$inc["x.quality.poor"], 1);
  assert.equal(update.$set["x.lastIceType"], "host");
  assert.equal(p.drainInto({}, "x"), false, "nothing left to write");

  const summary = summarizeStats({ samples: 3, rttSum: 600, rttN: 3, rttMin: 100, rttMax: 300, lossSum: 0.4, lossN: 2, lossMax: 0.3, ice: { relay: 2, host: 1 }, quality: { good: 1 } });
  assert.equal(summary.rttMs.avg, 200);
  assert.equal(summary.packetLossPct.avg, 20);
  assert.equal(summary.packetLossPct.max, 30);
  assert.equal(summary.iceType, "relay");
  assert.equal(connectionTypeLabel("relay"), "Relay (TURN)");
  assert.equal(connectionTypeLabel("srflx"), "Direct (peer-to-peer)");
  assert.equal(summarizeStats(undefined), null);
});

test("stats before a join, or from a non-participant, are ignored", () => {
  const { recorder, ops } = setup();
  assert.equal(recorder.onStats({ appointmentId: APPT, role: "patient", sample: good }), null);
  assert.equal(recorder.onStats({ appointmentId: APPT, role: "admin", sample: good }), null);
  assert.equal(ops.length, 0);
});

test("writes are throttled to one per participant per minute however chatty the client is", async () => {
  const { recorder, ops, timers, advance } = setup();
  await recorder.onJoin({ appointmentId: APPT, role: "patient", userId: "p", client: web });
  const baseline = ops.length;
  for (let i = 0; i < 60; i += 1) {
    assert.ok(recorder.onStats({ appointmentId: APPT, role: "patient", sample: good }), "always returns the sample for the live view");
    advance(1000);
  }
  assert.equal(ops.length, baseline, "no database write while the flush timer is pending");
  assert.equal(timers.filter((x) => !x.cleared).length >= 1, true);
  assert.equal(timers[0].ms, STATS_FLUSH_MS);
  timers[0].fn();
  await recorder.flush();
  const written = statOps(ops);
  assert.equal(written.length, 1);
  const folded = written[0].update.$inc["participants.patient.stats.samples"];
  assert.ok(folded >= 2 && folded <= 3, `~1 folded sample per ${STATS_FOLD_MIN_GAP_MS / 1000}s, got ${folded}`);
  assert.equal(written[0].options.upsert, false);
});

test("pending stats are flushed on drop, leave and call end", async () => {
  for (const finish of [
    (r) => r.onDrop({ appointmentId: APPT, role: "patient", reason: "transport close" }),
    (r) => r.onLeft({ appointmentId: APPT, role: "patient", how: "explicit" }),
    (r) => r.onCallEnded({ appointmentId: APPT, reason: "ended" }),
  ]) {
    const { recorder, ops } = setup();
    await recorder.onJoin({ appointmentId: APPT, role: "patient", userId: "p", client: web });
    recorder.onStats({ appointmentId: APPT, role: "patient", sample: good });
    await finish(recorder);
    await recorder.flush();
    assert.equal(statOps(ops).length, 1);
  }
});

test("a final sample on leave is always folded, even right after another", async () => {
  const { recorder, ops } = setup();
  await recorder.onJoin({ appointmentId: APPT, role: "patient", userId: "p", client: web });
  recorder.onStats({ appointmentId: APPT, role: "patient", sample: good });
  recorder.onStats({ appointmentId: APPT, role: "patient", sample: good });
  recorder.onStats({ appointmentId: APPT, role: "patient", sample: { ...good, rtt: 80 }, final: true });
  await recorder.flush();
  assert.equal(statOps(ops)[0].update.$inc["participants.patient.stats.samples"], 2);
});

test("no stats at all: the report still renders and summaries do not break", () => {
  const report = {
    appointmentId: APPT, kind: "appointment", firstActivityAt: new Date(), lastActivityAt: new Date(),
    participants: { doctor: { joins: 1 }, patient: { joins: 1 } }, events: [],
  };
  const view = buildCallReportView(report, {});
  assert.equal(view.participants[0].stats, null);
  assert.equal(view.participants[0].connectionType, "");
  assert.equal(buildCallSummary(null), null);
  assert.equal(buildCallSummary(report).connected, false);
});

test("poor quality produces a problem and a summary badge", () => {
  const stats = { samples: 4, lossSum: 0.4, lossN: 4, lossMax: 0.2, rttSum: 2000, rttN: 4, rttMax: 700, quality: { poor: 3, good: 1 }, lastQuality: "poor" };
  const report = {
    appointmentId: APPT, kind: "appointment", firstActivityAt: new Date(), lastActivityAt: new Date(), durationSec: 120, connectedAt: new Date(),
    participants: { doctor: { joins: 1 }, patient: { joins: 1, stats } }, events: [],
  };
  const view = buildCallReportView(report, {});
  const labels = view.problems.map((p) => p.label).join(" | ");
  assert.match(labels, /packet loss/i);
  assert.match(labels, /delay/i);
  assert.match(labels, /Poor connection quality/);
  const s = buildCallSummary(report);
  assert.equal(s.hasProblem, true);
  assert.equal(s.connected, true);
});
