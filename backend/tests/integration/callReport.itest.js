// Appointment call report against the real server: who joined from what,
// reconnects, crash fallback, completion, category consultations, forged
// clientInfo, and who may (not) read or delete a report.
const test = require("node:test");
const assert = require("node:assert/strict");
const { startStack, sleep } = require("../helpers/signalingStack");

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const DART = "Dart/3.5 (dart:io)";
const ANDROID_INFO = { platform: "android", appVersion: "1.0.18+17", osName: "Android", osVersion: "14", deviceModel: "Pixel 8" };
const GRACE_MS = 1500;

let stack;
test.before(async () => {
  stack = await startStack({ graceMs: GRACE_MS });
});
test.after(async () => {
  await stack?.stop();
});

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
async function getReport(id, token) {
  const res = await fetch(`${stack.baseUrl}/api/call-reports/${id}`, { headers: token ? bearer(token) : {} });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function deleteReport(id, token) {
  const res = await fetch(`${stack.baseUrl}/api/call-reports/${id}`, { method: "DELETE", headers: token ? bearer(token) : {} });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const adminToken = () => stack.tokens.admin.accessToken;
const closeAll = (...s) => s.forEach((x) => x.close());

async function joinPair({ appointmentId, doctorUA = CHROME_WIN, patientUA = DART, patientInfo = ANDROID_INFO, doctorInfo } = {}) {
  const doctor = await stack.connect({ token: stack.tokens.doctor.accessToken, userAgent: doctorUA });
  const patient = await stack.connect({ token: stack.tokens.patient.accessToken, userAgent: patientUA });
  await stack.joinAppointment(doctor, "doctor", { appointmentId, clientInfo: doctorInfo });
  await stack.joinAppointment(patient, "patient", { appointmentId, clientInfo: patientInfo });
  await stack.waitFor(doctor, "peer-joined");
  await stack.waitFor(patient, "peer-joined");
  return { doctor, patient };
}
const part = (view, role) => view.participants.find((p) => p.role === role);

// the recorder writes fire-and-forget; poll the API until the expectation holds
async function eventually(fn, ms = 6000) {
  const deadline = Date.now() + ms;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (last.ok) return last.value;
    await sleep(150);
  }
  assert.fail(`condition not met in ${ms}ms: ${JSON.stringify(last?.value ?? last).slice(0, 600)}`);
}

test("web doctor + Android-app patient: 'joined from' for both, both-present, timeline in plain language", async () => {
  const id = await stack.makeAppointment("confirmed");
  const { doctor, patient } = await joinPair({ appointmentId: id });
  const view = await eventually(async () => {
    const r = await getReport(id, adminToken());
    return { ok: r.status === 200 && r.body.participants?.length === 2 && r.body.timeline?.some((e) => e.type === "both_present"), value: r.body };
  });
  assert.equal(part(view, "doctor").joinedFrom, "Web (Chrome 130 on Windows 10)");
  assert.equal(part(view, "patient").joinedFrom, "App (Android 14, v1.0.18+17, Pixel 8)");
  assert.equal(view.appointment.kind, "appointment");
  assert.equal(view.appointment.patientName, "Signal Patient");
  assert.ok(view.timeline.some((e) => e.summary === "Patient joined from App (Android 14, v1.0.18+17, Pixel 8)"));
  assert.ok(view.timeline.some((e) => /^Doctor joined from Web/.test(e.summary)));
  assert.ok(part(view, "doctor").firstJoinedAt && part(view, "patient").firstJoinedAt);
  closeAll(doctor, patient);
});

test("doctor app (no clientInfo, native User-Agent) is shown as an app", async () => {
  const id = await stack.makeAppointment("confirmed");
  const { doctor, patient } = await joinPair({ appointmentId: id, doctorUA: DART, doctorInfo: undefined, patientUA: CHROME_WIN, patientInfo: undefined });
  const view = await eventually(async () => {
    const r = await getReport(id, adminToken());
    return { ok: r.body.participants?.length === 2, value: r.body };
  });
  assert.equal(part(view, "doctor").joinedFrom, "App (version and OS not reported)");
  assert.equal(part(view, "doctor").platformSource, "ua-inferred");
  assert.match(part(view, "patient").joinedFrom, /^Web \(Chrome/);
  closeAll(doctor, patient);
});

test("forged clientInfo cannot make a browser look like the app, and hostile strings are neutralised", async () => {
  const id = await stack.makeAppointment("confirmed");
  const hostile = { platform: "android", appVersion: "<script>alert(1)</script>", osName: "<img src=x onerror=alert(1)>", osVersion: "999", deviceModel: "x".repeat(400) };
  const { doctor, patient } = await joinPair({ appointmentId: id, doctorUA: CHROME_WIN, doctorInfo: hostile, patientUA: DART, patientInfo: hostile });
  const view = await eventually(async () => {
    const r = await getReport(id, adminToken());
    return { ok: r.body.participants?.length === 2, value: r.body };
  });
  const d = part(view, "doctor");
  assert.equal(d.platform, "web", "a browser User-Agent wins over a claimed Android app");
  assert.equal(d.platformSource, "ua-overrode-declared");
  const p = part(view, "patient");
  assert.equal(p.platform, "android");
  assert.ok(!/[<>]/.test(JSON.stringify(view)), "no markup survives into the report");
  assert.ok(p.joinedFrom.length < 200);
  // unusable shapes do not break joining or recording
  const odd = await stack.connect({ token: stack.tokens.patient.accessToken, userAgent: DART });
  for (const bad of [null, "android", 42, [], { platform: { $ne: "x" } }, { platform: "android", appVersion: { a: 1 } }]) {
    await stack.joinAppointment(odd, "patient", { appointmentId: id, clientInfo: bad });
    await sleep(60);
  }
  assert.equal(await stack.alive(), true);
  closeAll(doctor, patient, odd);
});

test("socket drop + return = disconnects/reconnects counted; duration accumulates; leaving closes the call", async () => {
  const id = await stack.makeAppointment("confirmed");
  const { doctor, patient } = await joinPair({ appointmentId: id });
  await sleep(1200);
  patient.close(); // network drop
  await stack.waitFor(doctor, "peer-socket-down");
  await sleep(1100);
  const patient2 = await stack.connect({ token: stack.tokens.patient.accessToken, userAgent: DART });
  await stack.joinAppointment(patient2, "patient", { appointmentId: id, clientInfo: ANDROID_INFO });
  await stack.waitFor(doctor, "peer-socket-up");
  await sleep(1200);
  patient2.emit("leave-appointment-room", { appointmentId: id });

  const view = await eventually(async () => {
    const r = await getReport(id, adminToken());
    const p = r.body.participants?.find((x) => x.role === "patient");
    return { ok: p && p.leftAt && p.reconnects === 1 && p.disconnects === 1, value: r.body };
  });
  assert.equal(part(view, "patient").connectionState, "left");
  assert.ok(view.summary.durationSec >= 2, `duration ${view.summary.durationSec}`);
  const types = view.timeline.map((e) => e.type);
  assert.deepEqual(types.filter((t) => ["joined", "both_present", "disconnected", "reconnected", "left"].includes(t)), ["joined", "joined", "both_present", "disconnected", "reconnected", "left"]);
  assert.ok(view.timeline.some((e) => /reconnected after/.test(e.summary)));
  closeAll(doctor, patient2);
});

test("a client that crashes (never sends anything, never says goodbye) still leaves a correct report", async () => {
  const id = await stack.makeAppointment("confirmed");
  const { doctor, patient } = await joinPair({ appointmentId: id });
  await sleep(1000);
  patient.io.engine.close(); // vanish: no leave, no stats, no final summary
  const view = await eventually(async () => {
    const r = await getReport(id, adminToken());
    const p = r.body.participants?.find((x) => x.role === "patient");
    return { ok: Boolean(p && p.leftAt), value: r.body };
  }, GRACE_MS + 6000);
  const p = part(view, "patient");
  assert.equal(p.disconnects, 1);
  assert.ok(view.timeline.some((e) => /did not come back/.test(e.summary)));
  assert.ok(view.problems.some((x) => /did not come back/.test(x.label)));
  assert.ok(view.summary.durationSec >= 1);
  closeAll(doctor);
});

test("'call connected' reported by a client flips connected to true (source: client)", async () => {
  const id = await stack.makeAppointment("confirmed");
  const { doctor, patient } = await joinPair({ appointmentId: id });
  patient.emit("call-connected", { appointmentId: id });
  const view = await eventually(async () => {
    const r = await getReport(id, adminToken());
    return { ok: r.body.summary?.connected === true, value: r.body };
  });
  assert.equal(view.summary.connectedSource, "client");
  assert.ok(view.timeline.some((e) => e.type === "call_connected"));
  // a client that is not in the room cannot write to the report
  const stranger = await stack.connect({ token: stack.tokens.other.accessToken });
  stranger.emit("call-connected", { appointmentId: id });
  assert.equal((await stack.waitFor(stranger, "signaling-error")).code, "not_in_room");
  closeAll(doctor, patient, stranger);
});

test("the appointment being completed ends the report with reason 'completed'", async () => {
  const id = await stack.makeAppointment("confirmed");
  const { doctor, patient } = await joinPair({ appointmentId: id });
  await sleep(1000);
  const res = await fetch(`${stack.baseUrl}/api/appointments/${id}/complete`, { method: "PUT", headers: bearer(stack.tokens.doctor.accessToken) });
  assert.equal(res.status, 200);
  const view = await eventually(async () => {
    const r = await getReport(id, adminToken());
    return { ok: r.body.summary?.endReason === "completed", value: r.body };
  });
  assert.ok(view.timeline.some((e) => /marked complete/.test(e.summary)));
  assert.equal(part(view, "patient").connectionState, "left");
  closeAll(doctor, patient);
});

test("category consultations are covered too", async () => {
  const id = await stack.makeCategoryConsultation("Confirmed");
  const { doctor, patient } = await joinPair({ appointmentId: id });
  const view = await eventually(async () => {
    const r = await getReport(id, adminToken());
    return { ok: r.body.participants?.length === 2, value: r.body };
  });
  assert.equal(view.appointment.kind, "category_consultation");
  assert.equal(view.kind, "category_consultation");
  closeAll(doctor, patient);
});

test("a refused stranger cannot create or change a report", async () => {
  const id = await stack.makeAppointment("confirmed");
  const stranger = await stack.connect({ token: stack.tokens.other.accessToken, userAgent: DART });
  await stack.joinAppointment(stranger, "other", { appointmentId: id, clientInfo: ANDROID_INFO });
  assert.equal((await stack.waitFor(stranger, "room-access-denied")).reason, "not_participant");
  await sleep(400);
  const r = await getReport(id, adminToken());
  assert.equal(r.status, 200);
  assert.equal(r.body.empty, true);
  assert.equal(await stack.models.CallReport.countDocuments({ appointmentId: id }), 0);
  stranger.close();
});

test("retention: every report carries a 90-day expiry", async () => {
  const id = await stack.makeAppointment("confirmed");
  const { doctor, patient } = await joinPair({ appointmentId: id });
  const doc = await eventually(async () => {
    const d = await stack.models.CallReport.findOne({ appointmentId: id }).lean();
    return { ok: Boolean(d), value: d };
  });
  const days = (doc.expiresAt.getTime() - Date.now()) / 86_400_000;
  assert.ok(days > 89 && days <= 90.1, `expires in ${days} days`);
  closeAll(doctor, patient);
});

test("AUTHORIZATION: only admins read a report; only superadmins delete it (doctor, patient, stranger, anonymous all refused)", async () => {
  // Last in the file on purpose: a refused superadmin-only call is a "critical
  // privilege_escalation" security event, and the platform answers that by
  // revoking ALL of that user's sessions - so every token used for a refused
  // DELETE below is dead afterwards.
  const id = await stack.makeAppointment("confirmed");
  const { doctor, patient } = await joinPair({ appointmentId: id });
  await eventually(async () => ({ ok: (await getReport(id, adminToken())).body.participants?.length === 2, value: null }));

  const refusedRead = [
    ["no token", undefined, 401],
    ["garbage token", "not.a.jwt", 401],
    ["doctor of that appointment", stack.tokens.doctor.accessToken, 403],
    ["patient of that appointment", stack.tokens.patient.accessToken, 403],
    ["stranger (another patient)", stack.tokens.other.accessToken, 403],
  ];
  for (const [name, token, expected] of refusedRead) {
    assert.equal((await getReport(id, token)).status, expected, `GET as ${name}`);
  }
  assert.equal((await getReport(id, adminToken())).status, 200);

  // input validation + unknown ids
  assert.equal((await getReport("not-an-id", adminToken())).status, 400);
  assert.equal((await getReport("64b64b64b64b64b64b64b64b", adminToken())).status, 404);

  // viewing is audited on the report itself
  const doc = await stack.models.CallReport.findOne({ appointmentId: id }).lean();
  assert.ok(doc.views.length >= 1 && doc.views[0].adminId === stack.ids.adminId);

  // the report payload carries no raw IP, user-agent or SDP
  const body = JSON.stringify((await getReport(id, adminToken())).body);
  assert.ok(!/Mozilla|Dart\/|v=0|candidate:/i.test(body));

  // nobody but a superadmin may delete (a plain admin included)
  const refusedDelete = [...refusedRead, ["a regular admin", adminToken(), 403]];
  for (const [name, token, expected] of refusedDelete) {
    assert.equal((await deleteReport(id, token)).status, expected, `DELETE as ${name}`);
  }
  assert.equal(await stack.models.CallReport.countDocuments({ appointmentId: id }), 1, "nothing was deleted by the refused calls");

  assert.equal((await deleteReport(id, stack.tokens.superadmin.accessToken)).status, 200);
  assert.equal(await stack.models.CallReport.countDocuments({ appointmentId: id }), 0);
  closeAll(doctor, patient);
});
