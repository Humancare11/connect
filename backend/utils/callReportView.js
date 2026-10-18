// utils/callReportView.js
//
// Turns a stored CallReport (plus the live both-present seconds the recorder
// still holds in memory) into the payload the admin "Call report" page renders:
// the same shape the direct-call report uses - participants, problems,
// timeline - plus a small summary. Pure; no I/O.
const { describeClientLabel } = require("./clientDescriptor");

const ROLE_LABEL = { doctor: "Doctor", patient: "Patient" };
const who = (role) => ROLE_LABEL[role] || "Someone";

const DISCONNECT_REASONS = {
  "ping timeout": "stopped responding (lost network or the device went to sleep)",
  "transport close": "the connection closed (network change, closed tab or app)",
  "transport error": "a network error",
  "client namespace disconnect": "left or closed the page",
  "server namespace disconnect": "was disconnected by the server",
  "server shutting down": "the server was restarting",
};
const NETWORK_REASONS = new Set(["ping timeout", "transport error", "transport close"]);

const dur = (sec) => {
  if (!Number.isFinite(sec) || sec < 0) return "";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
};

function describeEvent(event) {
  const d = event.detail || {};
  const name = who(event.role);
  switch (event.type) {
    case "joined":
      return `${name} joined${d.client ? ` from ${d.client}` : ""}`;
    case "rejoined":
      return `${name} came back to the call${d.client ? ` from ${d.client}` : ""}`;
    case "reconnected":
      return `${name} reconnected${d.afterSec ? ` after ${dur(d.afterSec)}` : ""}`;
    case "disconnected":
      return `${name} disconnected - ${DISCONNECT_REASONS[d.reason] || d.reason || "connection lost"}`;
    case "left":
      return d.how === "grace_expired"
        ? `${name} left the call (did not come back after losing connection)`
        : `${name} left the call`;
    case "both_present":
      return "Doctor and patient are both in the call";
    case "call_connected":
      return `Call connected (reported by the ${name.toLowerCase()}'s device)`;
    case "client_changed":
      return `${name} switched device: ${d.from} -> ${d.to}`;
    case "join_denied":
      return `${name}'s attempt to (re)join was refused (${d.reason || "unknown reason"})`;
    case "call_ended":
      return d.reason === "completed"
        ? "The appointment was marked complete - the call was ended"
        : d.reason === "cancelled"
          ? "The appointment was cancelled - the call was ended"
          : "The call was ended by the system";
    default:
      return `${name}: ${event.type}`;
  }
}

function buildProblems(report) {
  const problems = [];
  const events = report.events || [];
  for (const e of events) {
    const name = who(e.role);
    const d = e.detail || {};
    if (e.type === "disconnected" && NETWORK_REASONS.has(d.reason)) {
      problems.push({
        at: e.at, who: name, label: `Connection dropped (${d.reason})`, detectable: "server",
        suggestion: "Usually the device lost network, switched networks, or went to sleep. If it keeps happening, ask them to move closer to the router or switch between Wi-Fi and mobile data.",
      });
    } else if (e.type === "left" && d.how === "grace_expired") {
      problems.push({
        at: e.at, who: name, label: "Lost connection and did not come back", detectable: "server",
        suggestion: "They may have closed the app/tab, lost signal for good, or their device was switched off.",
      });
    } else if (e.type === "join_denied") {
      problems.push({
        at: e.at, who: name, label: `Could not (re)join: ${d.reason || "refused"}`, detectable: "server",
        suggestion: d.reason === "server_error" || d.reason === "unauthenticated"
          ? "This is usually temporary (the app retries automatically). If it repeats, check the server logs around this time."
          : "The appointment may have ended or been cancelled.",
      });
    }
  }
  const p = report.participants || {};
  for (const role of ["doctor", "patient"]) {
    if (p[role] && p[role].reconnects >= 3) {
      problems.push({
        at: p[role].lastSeenAt || report.lastActivityAt, who: who(role), label: `Unstable connection (${p[role].reconnects} reconnects)`, detectable: "server",
        suggestion: "Repeated drops point to a weak or switching network on their side.",
      });
    }
  }
  if (report.bothPresentAt && !report.connectedAt) {
    problems.push({
      at: report.bothPresentAt, who: "Call", label: "Both joined but the video call never connected", detectable: "server",
      suggestion: "Often a firewall/NAT issue between the two networks, or a blocked camera/microphone. Ask them to try another network.",
    });
  }
  return problems.sort((a, b) => new Date(a.at) - new Date(b.at));
}

function buildParticipants(report) {
  const p = report.participants || {};
  return ["doctor", "patient"]
    .filter((role) => p[role])
    .map((role) => {
      const x = p[role];
      return {
        key: role,
        role,
        joinedFrom: describeClientLabel(x),
        platform: x.platform || "unknown",
        platformSource: x.platformSource || "",
        device: x.deviceModel || "",
        firstJoinedAt: x.firstJoinedAt || null,
        lastSeenAt: x.lastSeenAt || null,
        leftAt: x.leftAt || null,
        joins: x.joins || 0,
        reconnects: x.reconnects || 0,
        disconnects: x.disconnects || 0,
        connectionState: x.connectionState || "unknown",
        maskedIp: x.maskedIp || "",
      };
    });
}

function buildCallReportView(report, { openSegmentSec = 0 } = {}) {
  if (!report) {
    return { empty: true, participants: [], problems: [], timeline: [], summary: null };
  }
  const durationSec = (report.durationSec || 0) + openSegmentSec;
  return {
    empty: false,
    kind: report.kind,
    summary: {
      firstActivityAt: report.firstActivityAt || null,
      bothPresentAt: report.bothPresentAt || null,
      connected: Boolean(report.connectedAt),
      connectedAt: report.connectedAt || null,
      connectedSource: report.connectedSource || "",
      callEndedAt: report.callEndedAt || null,
      durationSec,
      durationLabel: dur(durationSec),
      endReason: report.endReason || "",
      inProgress: openSegmentSec > 0,
    },
    participants: buildParticipants(report),
    problems: buildProblems(report),
    timeline: (report.events || []).map((e) => ({
      at: e.at, type: e.type, role: e.role || "", summary: describeEvent(e),
    })),
  };
}

module.exports = { buildCallReportView, describeEvent, buildProblems, dur };
