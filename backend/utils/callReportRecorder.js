// utils/callReportRecorder.js
//
// Builds the appointment call report (models/CallReport.js) from the signaling
// server's own events - join / socket drop / leave / appointment completed -
// so the report is correct even if a client crashes and never sends anything.
//
// Writes are low-frequency by construction (one small upsert per join / drop /
// leave / completion, never per stats tick) and fire-and-forget: a failed or
// slow write can never affect a call. Updates for one appointment are chained
// so their order is preserved.
//
// Per-appointment state is held in memory (like the rest of the call state in
// server.js): after a backend restart an in-flight both-present period is not
// closed, so that one period is not added to durationSec.

const EVENT_CAP = 200;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
// A call with no client "connected" report still counts as connected if both
// sides stayed together at least this long.
const INFERRED_CONNECTED_MIN_SEC = 15;
const DENIED_EVENT_MIN_GAP_MS = 30_000;

// Stats: samples closer together than this are used for the live view only;
// aggregates fold roughly one sample per 30s however often a client sends.
const STATS_FOLD_MIN_GAP_MS = 25_000;
// A participant's pending aggregate is written at most this often (and on any
// drop / leave / end).
const STATS_FLUSH_MS = 60_000;

const { sanitizeStatsSample, createPendingStats } = require("./callStatsAggregator");

const ROLES = ["doctor", "patient"];
const other = (role) => (role === "doctor" ? "patient" : "doctor");

function createCallReportRecorder({ CallReport, logger = console, now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  const states = new Map(); // appointmentId -> in-memory state
  const chains = new Map(); // appointmentId -> promise (write order)

  function stateFor(appointmentId, kind) {
    let st = states.get(appointmentId);
    if (!st) {
      st = {
        kind: kind || "appointment",
        roles: {
          doctor: { state: null, droppedAt: 0, label: "", pending: createPendingStats(), lastFoldedAt: 0, flushTimer: null },
          patient: { state: null, droppedAt: 0, label: "", pending: createPendingStats(), lastFoldedAt: 0, flushTimer: null },
        },
        bothSince: 0,
        connectedReported: false,
        connectedInferred: false,
        deniedAt: {},
      };
      states.set(appointmentId, st);
    }
    return st;
  }

  function newUpdate(t, kind) {
    return {
      $setOnInsert: { kind: kind || "appointment", firstActivityAt: new Date(t) },
      $set: { lastActivityAt: new Date(t), expiresAt: new Date(t + RETENTION_MS) },
      $inc: {},
      $min: {},
      $max: {},
      $unset: {},
      _events: [],
    };
  }

  function finalize(update) {
    const out = { $setOnInsert: update.$setOnInsert, $set: update.$set };
    if (Object.keys(update.$inc).length) out.$inc = update.$inc;
    if (Object.keys(update.$min).length) out.$min = update.$min;
    if (Object.keys(update.$max).length) out.$max = update.$max;
    if (Object.keys(update.$unset).length) out.$unset = update.$unset;
    if (update._events.length) out.$push = { events: { $each: update._events, $slice: -EVENT_CAP } };
    return out;
  }

  function write(appointmentId, update, { upsert = true } = {}) {
    const payload = finalize(update);
    if (!upsert) delete payload.$setOnInsert;
    const previous = chains.get(appointmentId) || Promise.resolve();
    const next = previous
      .then(() => CallReport.updateOne({ appointmentId }, payload, { upsert }))
      .catch((err) => logger.warn("[call-report] write failed:", err && err.message));
    chains.set(appointmentId, next);
    next.finally(() => {
      if (chains.get(appointmentId) === next) chains.delete(appointmentId);
    });
    return next;
  }

  const addEvent = (update, t, type, role, detail) =>
    update._events.push({ at: new Date(t), type, role: role || "", ...(detail ? { detail } : {}) });

  function bothIn(st) {
    return ROLES.every((r) => st.roles[r].state === "in" || st.roles[r].state === "dropped");
  }

  // Closes the open both-present period at `endMs` (adds its length to durationSec).
  function closeSegment(st, update, endMs) {
    if (!st.bothSince) return;
    const sec = Math.max(0, Math.round((endMs - st.bothSince) / 1000));
    if (sec > 0) update.$inc.durationSec = (update.$inc.durationSec || 0) + sec;
    if (!st.connectedReported && !st.connectedInferred && sec >= INFERRED_CONNECTED_MIN_SEC) {
      st.connectedInferred = true;
      update.$min.connectedAt = new Date(st.bothSince);
      update.$set.connectedSource = "server-inferred";
    }
    update.$set.callEndedAt = new Date(endMs);
    st.bothSince = 0;
  }

  // ---------------------------------------------------------------- stats
  function flushStats(appointmentId, role) {
    const st = states.get(appointmentId);
    if (!st) return undefined;
    const rr = st.roles[role];
    if (rr.flushTimer) {
      clearTimer(rr.flushTimer);
      rr.flushTimer = null;
    }
    const update = newUpdate(now(), st.kind);
    if (!rr.pending.drainInto(update, `participants.${role}.stats`)) return undefined;
    return write(appointmentId, update, { upsert: false });
  }

  // A stats sample from a participant. Returns the sanitised sample (so the
  // server can forward it to a watching admin) or null if it was unusable.
  function onStats({ appointmentId, role, sample: raw, final = false }) {
    const id = String(appointmentId || "");
    const st = states.get(id);
    if (!st || !ROLES.includes(role)) return null;
    const rr = st.roles[role];
    if (rr.state !== "in" && rr.state !== "dropped") return null;
    const sample = sanitizeStatsSample(raw);
    if (!sample) return null;
    const t = now();
    if (final || t - rr.lastFoldedAt >= STATS_FOLD_MIN_GAP_MS) {
      rr.lastFoldedAt = t;
      rr.pending.add(sample, t);
      if (!rr.flushTimer) {
        rr.flushTimer = setTimer(() => {
          rr.flushTimer = null;
          flushStats(id, role);
        }, STATS_FLUSH_MS);
        if (rr.flushTimer && typeof rr.flushTimer.unref === "function") rr.flushTimer.unref();
      }
    }
    return sample;
  }

  // ---------------------------------------------------------------- events
  // A participant's socket joined the room (fresh or recovered).
  function onJoin({ appointmentId, kind, role, userId, client, maskedIp }) {
    if (!appointmentId || !ROLES.includes(role)) return;
    const t = now();
    const st = stateFor(String(appointmentId), kind);
    const r = st.roles[role];
    const update = newUpdate(t, st.kind);
    const p = `participants.${role}`;
    const label = client?.label || "";

    let type = null;
    if (r.state === "in") {
      // A recovered socket / duplicate emit: nothing happened worth an event.
    } else if (r.state === "dropped") {
      type = "reconnected";
      update.$inc[`${p}.reconnects`] = 1;
    } else if (r.state === "left") {
      type = "rejoined";
      update.$inc[`${p}.joins`] = 1;
    } else {
      type = "joined";
      update.$inc[`${p}.joins`] = 1;
    }

    const droppedForSec = r.droppedAt ? Math.round((t - r.droppedAt) / 1000) : 0;
    r.state = "in";
    r.droppedAt = 0;

    update.$set[`${p}.role`] = role;
    if (userId) update.$set[`${p}.userId`] = String(userId);
    update.$set[`${p}.lastSeenAt`] = new Date(t);
    update.$set[`${p}.connectionState`] = "connected";
    update.$unset[`${p}.leftAt`] = "";
    update.$min[`${p}.firstJoinedAt`] = new Date(t);
    if (maskedIp) update.$set[`${p}.maskedIp`] = String(maskedIp).slice(0, 60);
    if (client) {
      for (const k of ["platform", "platformSource", "appVersion", "osName", "osVersion", "browser", "browserVersion", "deviceModel"]) {
        update.$set[`${p}.${k}`] = client[k] || (k === "platform" ? "unknown" : "");
      }
    }

    if (type) {
      addEvent(update, t, type, role, {
        ...(label ? { client: label } : {}),
        ...(type === "reconnected" ? { afterSec: droppedForSec } : {}),
        ...(client?.platformSource === "ua-overrode-declared" ? { note: "client info disagreed with what the server observed" } : {}),
      });
    }
    if (label && r.label && label !== r.label && type !== "joined") {
      addEvent(update, t, "client_changed", role, { from: r.label, to: label });
    }
    if (label) r.label = label;

    if (!st.bothSince && bothIn(st) && ROLES.every((x) => st.roles[x].state === "in")) {
      st.bothSince = t;
      update.$min.bothPresentAt = new Date(t);
      addEvent(update, t, "both_present", "");
    }
    return write(String(appointmentId), update);
  }

  // The socket dropped (before the leave grace period decides anything).
  function onDrop({ appointmentId, role, reason }) {
    const id = String(appointmentId || "");
    const st = states.get(id);
    if (!st || !ROLES.includes(role)) return;
    const r = st.roles[role];
    if (r.state !== "in") return;
    const t = now();
    flushStats(id, role);
    r.state = "dropped";
    r.droppedAt = t;
    const update = newUpdate(t, st.kind);
    const p = `participants.${role}`;
    update.$inc[`${p}.disconnects`] = 1;
    update.$set[`${p}.connectionState`] = "disconnected";
    update.$set[`${p}.lastSeenAt`] = new Date(t);
    addEvent(update, t, "disconnected", role, { reason: String(reason || "").slice(0, 40) });
    return write(id, update, { upsert: false });
  }

  // The participant is gone for good: left on purpose, or did not come back
  // within the grace period.
  function onLeft({ appointmentId, role, how }) {
    const id = String(appointmentId || "");
    const st = states.get(id);
    if (!st || !ROLES.includes(role)) return;
    const r = st.roles[role];
    if (r.state === "left" || r.state === null) return;
    const t = now();
    const leftMs = how === "grace_expired" && r.droppedAt ? r.droppedAt : t;
    flushStats(id, role);
    r.state = "left";
    r.droppedAt = 0;
    const update = newUpdate(t, st.kind);
    const p = `participants.${role}`;
    update.$set[`${p}.leftAt`] = new Date(leftMs);
    update.$set[`${p}.connectionState`] = "left";
    update.$set[`${p}.lastSeenAt`] = new Date(leftMs);
    closeSegment(st, update, leftMs);
    addEvent(update, leftMs, "left", role, { how: how || "explicit" });
    if (st.roles[other(role)].state === "left" || st.roles[other(role)].state === null) {
      update.$set.endReason = "participants_left";
    }
    return write(id, update, { upsert: false });
  }

  // A client reported its peer connection as connected.
  function onConnected({ appointmentId, role }) {
    const id = String(appointmentId || "");
    const st = states.get(id);
    if (!st || !ROLES.includes(role) || st.connectedReported) return;
    const t = now();
    st.connectedReported = true;
    const update = newUpdate(t, st.kind);
    update.$min.connectedAt = new Date(t);
    update.$set.connectedSource = "client";
    addEvent(update, t, "call_connected", role);
    return write(id, update, { upsert: false });
  }

  // A join that was refused for a reason worth noting (only for a report that
  // already exists; never creates one, so strangers cannot create documents).
  function onJoinDenied({ appointmentId, role, reason }) {
    const id = String(appointmentId || "");
    const st = states.get(id);
    if (!st || !ROLES.includes(role)) return;
    const t = now();
    if (t - (st.deniedAt[role] || 0) < DENIED_EVENT_MIN_GAP_MS) return;
    st.deniedAt[role] = t;
    const update = newUpdate(t, st.kind);
    addEvent(update, t, "join_denied", role, { reason: String(reason || "").slice(0, 30) });
    return write(id, update, { upsert: false });
  }

  // The appointment was completed / cancelled by the system.
  function onCallEnded({ appointmentId, reason }) {
    const id = String(appointmentId || "");
    const t = now();
    const st = states.get(id);
    const update = newUpdate(t, st?.kind);
    if (st) {
      for (const role of ROLES) flushStats(id, role);
      closeSegment(st, update, t);
      for (const r of ROLES) {
        if (st.roles[r].state === "in" || st.roles[r].state === "dropped") {
          st.roles[r].state = "left";
          update.$set[`participants.${r}.leftAt`] = new Date(t);
          update.$set[`participants.${r}.connectionState`] = "left";
        }
      }
    }
    update.$set.endReason = reason === "completed" ? "completed" : reason === "cancelled" ? "cancelled" : "participants_left";
    update.$set.callEndedAt = update.$set.callEndedAt || new Date(t);
    addEvent(update, t, "call_ended", "", { reason: String(reason || "unavailable").slice(0, 30) });
    return write(id, update, { upsert: false });
  }

  // Seconds of the currently open both-present period (for a live read).
  function openSegmentSec(appointmentId) {
    const st = states.get(String(appointmentId));
    return st && st.bothSince ? Math.max(0, Math.round((now() - st.bothSince) / 1000)) : 0;
  }

  // Writes every pending stats aggregate, then waits for all queued writes.
  async function flush() {
    for (const id of Array.from(states.keys())) for (const role of ROLES) flushStats(id, role);
    await Promise.allSettled(Array.from(chains.values()));
  }

  return { onJoin, onDrop, onLeft, onConnected, onJoinDenied, onCallEnded, onStats, flushStats, openSegmentSec, flush, _states: states };
}

module.exports = { createCallReportRecorder, EVENT_CAP, RETENTION_MS, INFERRED_CONNECTED_MIN_SEC, STATS_FOLD_MIN_GAP_MS, STATS_FLUSH_MS };
