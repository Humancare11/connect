const test = require("node:test");
const assert = require("node:assert/strict");
const { createCallReportRecorder, EVENT_CAP } = require("../utils/callReportRecorder");
const { buildCallReportView } = require("../utils/callReportView");

function setup() {
  const ops = [];
  let t = Date.parse("2026-01-01T10:00:00Z");
  const CallReport = {
    updateOne: async (filter, update, options) => {
      ops.push({ filter, update, options });
    },
  };
  const recorder = createCallReportRecorder({ CallReport, logger: { warn() {} }, now: () => t });
  return { ops, recorder, advance: (ms) => { t += ms; }, at: () => t };
}
const APPT = "64b64b64b64b64b64b64b64b";
const web = { platform: "web", platformSource: "ua-inferred", browser: "Chrome", browserVersion: "130", osName: "Windows", osVersion: "11", label: "Web (Chrome 130 on Windows 11)" };
const app = { platform: "android", platformSource: "declared", appVersion: "1.0.18", osName: "Android", osVersion: "14", label: "App (Android 14, v1.0.18)" };
const eventsOf = (ops) => ops.flatMap((o) => o.update.$push?.events.$each || []).map((e) => e.type);
const sumInc = (ops, key) => ops.reduce((n, o) => n + (o.update.$inc?.[key] || 0), 0);

test("first join records platform, firstJoinedAt (via $min) and a 'joined' event", async () => {
  const { ops, recorder } = setup();
  await recorder.onJoin({ appointmentId: APPT, kind: "appointment", role: "patient", userId: "p1", client: app, maskedIp: "1.2.x.x" });
  const u = ops[0].update;
  assert.equal(ops[0].options.upsert, true);
  assert.equal(u.$set["participants.patient.platform"], "android");
  assert.equal(u.$set["participants.patient.appVersion"], "1.0.18");
  assert.equal(u.$set["participants.patient.maskedIp"], "1.2.x.x");
  assert.ok(u.$min["participants.patient.firstJoinedAt"] instanceof Date);
  assert.equal(u.$inc["participants.patient.joins"], 1);
  assert.deepEqual(eventsOf(ops), ["joined"]);
  assert.equal(u.$push.events.$slice, -EVENT_CAP);
});

test("both present starts a period; leaving closes it into durationSec; call counts as connected after 15s", async () => {
  const { ops, recorder, advance } = setup();
  await recorder.onJoin({ appointmentId: APPT, role: "doctor", userId: "d1", client: web });
  await recorder.onJoin({ appointmentId: APPT, role: "patient", userId: "p1", client: app });
  assert.ok(eventsOf(ops).includes("both_present"));
  assert.equal(recorder.openSegmentSec(APPT), 0);
  advance(125_000);
  assert.equal(recorder.openSegmentSec(APPT), 125);
  await recorder.onLeft({ appointmentId: APPT, role: "patient", how: "explicit" });
  assert.equal(sumInc(ops, "durationSec"), 125);
  const left = ops.at(-1).update;
  assert.equal(left.$min.connectedAt instanceof Date, true, "server-inferred connectedAt");
  assert.equal(left.$set.connectedSource, "server-inferred");
  assert.equal(left.$set.endReason, undefined, "the doctor is still in the call");
  assert.equal(recorder.openSegmentSec(APPT), 0);
});

test("a short both-present period is NOT counted as connected", async () => {
  const { ops, recorder, advance } = setup();
  await recorder.onJoin({ appointmentId: APPT, role: "doctor", client: web });
  await recorder.onJoin({ appointmentId: APPT, role: "patient", client: web });
  advance(5_000);
  await recorder.onLeft({ appointmentId: APPT, role: "doctor", how: "explicit" });
  assert.equal(ops.at(-1).update.$min?.connectedAt, undefined);
});

test("a client 'connected' report is recorded once, as source=client", async () => {
  const { ops, recorder } = setup();
  await recorder.onJoin({ appointmentId: APPT, role: "doctor", client: web });
  await recorder.onConnected({ appointmentId: APPT, role: "doctor" });
  await recorder.onConnected({ appointmentId: APPT, role: "patient" });
  const connected = ops.filter((o) => o.update.$set.connectedSource === "client");
  assert.equal(connected.length, 1);
  assert.equal(eventsOf(ops).filter((e) => e === "call_connected").length, 1);
});

test("drop then return = reconnect (counted); drop then grace expiry = left at the DROP time", async () => {
  const { ops, recorder, advance, at } = setup();
  await recorder.onJoin({ appointmentId: APPT, role: "patient", client: app });
  advance(10_000);
  await recorder.onDrop({ appointmentId: APPT, role: "patient", reason: "ping timeout" });
  advance(8_000);
  await recorder.onJoin({ appointmentId: APPT, role: "patient", client: app });
  assert.equal(sumInc(ops, "participants.patient.disconnects"), 1);
  assert.equal(sumInc(ops, "participants.patient.reconnects"), 1);
  const reconnected = ops.flatMap((o) => o.update.$push?.events.$each || []).find((e) => e.type === "reconnected");
  assert.equal(reconnected.detail.afterSec, 8);

  const dropAt = at();
  await recorder.onDrop({ appointmentId: APPT, role: "patient", reason: "transport close" });
  advance(30_000);
  await recorder.onLeft({ appointmentId: APPT, role: "patient", how: "grace_expired" });
  const last = ops.at(-1).update;
  assert.equal(last.$set["participants.patient.leftAt"].getTime(), dropAt, "left when the connection was lost, not when the grace timer fired");
  assert.equal(last.$set.endReason, "participants_left");
});

test("rejoin after leaving is 'rejoined' (joins++), not a reconnect", async () => {
  const { ops, recorder } = setup();
  await recorder.onJoin({ appointmentId: APPT, role: "doctor", client: web });
  await recorder.onLeft({ appointmentId: APPT, role: "doctor", how: "explicit" });
  await recorder.onJoin({ appointmentId: APPT, role: "doctor", client: web });
  assert.deepEqual(eventsOf(ops), ["joined", "left", "rejoined"]);
  assert.equal(ops.at(-1).update.$unset["participants.doctor.leftAt"], "");
  assert.equal(sumInc(ops, "participants.doctor.reconnects"), 0);
});

test("a recovered/duplicate join of someone already in the call writes no event", async () => {
  const { ops, recorder } = setup();
  await recorder.onJoin({ appointmentId: APPT, role: "doctor", client: web });
  await recorder.onJoin({ appointmentId: APPT, role: "doctor", client: web });
  assert.deepEqual(eventsOf(ops), ["joined"]);
});

test("device switch on rejoin is noted", async () => {
  const { ops, recorder } = setup();
  await recorder.onJoin({ appointmentId: APPT, role: "patient", client: web });
  await recorder.onLeft({ appointmentId: APPT, role: "patient", how: "explicit" });
  await recorder.onJoin({ appointmentId: APPT, role: "patient", client: app });
  assert.ok(eventsOf(ops).includes("client_changed"));
});

test("appointment completed closes the open period and ends the report (no upsert)", async () => {
  const { ops, recorder, advance } = setup();
  await recorder.onJoin({ appointmentId: APPT, role: "doctor", client: web });
  await recorder.onJoin({ appointmentId: APPT, role: "patient", client: app });
  advance(60_000);
  await recorder.onCallEnded({ appointmentId: APPT, reason: "completed" });
  const end = ops.at(-1);
  assert.equal(end.options.upsert, false);
  assert.equal(end.update.$set.endReason, "completed");
  assert.equal(end.update.$inc.durationSec, 60);
  assert.equal(end.update.$set["participants.patient.connectionState"], "left");
  assert.ok(eventsOf(ops).includes("call_ended"));
});

test("drop/leave/denied for an appointment nobody joined (e.g. a stranger) write nothing", async () => {
  const { ops, recorder } = setup();
  await recorder.onDrop({ appointmentId: APPT, role: "patient", reason: "x" });
  await recorder.onLeft({ appointmentId: APPT, role: "patient", how: "explicit" });
  await recorder.onJoinDenied({ appointmentId: APPT, role: "patient", reason: "server_error" });
  await recorder.onConnected({ appointmentId: APPT, role: "patient" });
  await recorder.onJoin({ appointmentId: APPT, role: "admin", client: web });
  await recorder.onJoin({ appointmentId: "", role: "doctor", client: web });
  assert.equal(ops.length, 0);
});

test("denied joins are throttled and never create a report", async () => {
  const { ops, recorder, advance } = setup();
  await recorder.onJoin({ appointmentId: APPT, role: "patient", client: app });
  ops.length = 0;
  await recorder.onJoinDenied({ appointmentId: APPT, role: "patient", reason: "server_error" });
  await recorder.onJoinDenied({ appointmentId: APPT, role: "patient", reason: "server_error" });
  assert.equal(ops.length, 1);
  assert.equal(ops[0].options.upsert, false);
  advance(31_000);
  await recorder.onJoinDenied({ appointmentId: APPT, role: "patient", reason: "server_error" });
  assert.equal(ops.length, 2);
});

test("a failing database write never throws into the call", async () => {
  const warnings = [];
  const recorder = createCallReportRecorder({
    CallReport: { updateOne: async () => { throw new Error("db down"); } },
    logger: { warn: (...a) => warnings.push(a.join(" ")) },
  });
  await assert.doesNotReject(recorder.onJoin({ appointmentId: APPT, role: "doctor", client: web }));
  assert.ok(warnings.some((w) => /db down/.test(w)));
});

test("writes for one appointment keep their order even if the database is slow", async () => {
  const order = [];
  const recorder = createCallReportRecorder({
    CallReport: {
      updateOne: async (_f, update) => {
        const type = update.$push?.events.$each[0]?.type;
        await new Promise((r) => setTimeout(r, type === "joined" ? 30 : 1));
        order.push(type);
      },
    },
    logger: { warn() {} },
  });
  recorder.onJoin({ appointmentId: APPT, role: "doctor", client: web });
  recorder.onDrop({ appointmentId: APPT, role: "doctor", reason: "ping timeout" });
  await recorder.flush();
  assert.deepEqual(order, ["joined", "disconnected"]);
});

test("the view: plain-language timeline, 'joined from' labels, problems, duration", () => {
  const view = buildCallReportView(
    {
      kind: "appointment",
      durationSec: 130,
      bothPresentAt: new Date(),
      participants: {
        patient: { role: "patient", platform: "android", appVersion: "1.0.18", osVersion: "14", reconnects: 3, disconnects: 3, connectionState: "connected" },
        doctor: { role: "doctor", platform: "web", browser: "Chrome", browserVersion: "130", osName: "Windows", connectionState: "connected" },
      },
      events: [
        { at: new Date(1), type: "joined", role: "patient", detail: { client: "App (Android 14, v1.0.18)" } },
        { at: new Date(2), type: "disconnected", role: "patient", detail: { reason: "ping timeout" } },
        { at: new Date(3), type: "left", role: "patient", detail: { how: "grace_expired" } },
      ],
    },
    { openSegmentSec: 20 },
  );
  assert.equal(view.summary.durationSec, 150);
  assert.equal(view.summary.connected, false);
  assert.equal(view.participants.find((p) => p.role === "patient").joinedFrom, "App (Android 14, v1.0.18)");
  assert.equal(view.participants.find((p) => p.role === "doctor").joinedFrom, "Web (Chrome 130 on Windows)");
  assert.equal(view.timeline[0].summary, "Patient joined from App (Android 14, v1.0.18)");
  const labels = view.problems.map((p) => p.label).join(" | ");
  assert.match(labels, /Connection dropped/);
  assert.match(labels, /did not come back/);
  assert.match(labels, /Unstable connection \(3 reconnects\)/);
  assert.match(labels, /never connected/);
  assert.equal(buildCallReportView(null).empty, true);
});
