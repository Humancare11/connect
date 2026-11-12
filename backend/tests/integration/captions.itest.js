// Real-process tests of the live caption relay (lang-changed + caption): the actual `node server.js` with real sockets.
// Run with:  npm run test:integration
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startStack, sleep } = require("../helpers/signalingStack");

const SECRET = "ZEBRA-CAPTION-SECRET";
const caption = (appointmentId, extra = {}) => ({ appointmentId: String(appointmentId), id: "cap-1", final: true, text: `Guten Tag ${SECRET}`, srcLang: "de-DE", conf: 0.91, tr: { en: `Hello ${SECRET}` }, ...extra });
const closeAll = (...sockets) => sockets.forEach((s) => s.close());

async function bothJoined(stack, appointmentId = stack.ids.appointmentId) {
  const doctor = await stack.connect({ token: stack.tokens.doctor.accessToken });
  const patient = await stack.connect({ token: stack.tokens.patient.accessToken });
  await stack.joinAppointment(doctor, "doctor", { appointmentId });
  await stack.joinAppointment(patient, "patient", { appointmentId });
  await stack.waitFor(doctor, "peer-joined");
  await stack.waitFor(patient, "peer-joined");
  return { doctor, patient };
}
const got = (socket, event) => socket.events.filter((e) => e.event === event).map((e) => e.args[0]);

describe("live captions, feature ON", () => {
  let stack;
  before(async () => { stack = await startStack({ env: { TRANSCRIPTION_ENABLED: "true" } }); });
  after(async () => { await stack?.stop(); });

  test("a caption goes to the other person only, labelled with who sent it (from the server, not the payload)", async () => {
    const { doctor, patient } = await bothJoined(stack);
    doctor.emit("caption", caption(stack.ids.appointmentId, { from: "patient", role: "patient", at: 1, hacked: true }));
    const received = await stack.waitFor(patient, "caption");
    assert.equal(received.from, "doctor", "the label comes from the logged-in socket");
    assert.equal(received.appointmentId, String(stack.ids.appointmentId));
    assert.equal(received.final, true);
    assert.equal(received.text, `Guten Tag ${SECRET}`);
    assert.deepEqual(received.tr, { en: `Hello ${SECRET}` });
    assert.equal(received.srcLang, "de-DE");
    assert.equal(received.conf, 0.91);
    assert.ok(received.at > 1_600_000_000_000, "delivery time stamped by the server");
    assert.equal("hacked" in received, false);
    assert.equal("role" in received, false);
    await sleep(300);
    assert.equal(got(doctor, "caption").length, 0, "the sender does not get its own caption back");

    patient.emit("caption", caption(stack.ids.appointmentId, { id: "cap-2", final: false, text: "Ich ha" }));
    const back = await stack.waitFor(doctor, "caption", { predicate: (c) => c.id === "cap-2" });
    assert.equal(back.from, "patient");
    assert.equal(back.final, false);
    closeAll(doctor, patient);
  });

  test("lang-changed goes to the other person, both ways, with who changed it", async () => {
    const { doctor, patient } = await bothJoined(stack);
    patient.emit("lang-changed", { appointmentId: String(stack.ids.appointmentId), lang: "hi", from: "doctor" });
    assert.deepEqual(await stack.waitFor(doctor, "lang-changed"), { appointmentId: String(stack.ids.appointmentId), lang: "hi", from: "patient" });
    doctor.emit("lang-changed", { appointmentId: String(stack.ids.appointmentId), lang: "none" });
    assert.deepEqual(await stack.waitFor(patient, "lang-changed"), { appointmentId: String(stack.ids.appointmentId), lang: "none", from: "doctor" });
    await sleep(200);
    assert.equal(got(patient, "lang-changed").length, 1);
    assert.equal(got(doctor, "lang-changed").length, 1);
    closeAll(doctor, patient);
  });

  test("bad messages are refused with a code, only the sender hears about it, and the other person sees nothing", async () => {
    const { doctor, patient } = await bothJoined(stack);
    const id = String(stack.ids.appointmentId);
    for (const bad of [null, "text", 5, {}, { appointmentId: id }, caption(id, { text: "" }), caption(id, { final: "yes" }), caption(id, { id: "bad id!" }), caption(id, { tr: { en: "a", de: "b", es: "c", fr: "d" } })]) doctor.emit("caption", bad);
    doctor.emit("lang-changed", { appointmentId: id, lang: "<script>" });
    await stack.waitFor(doctor, "signaling-error", { predicate: (e) => e.event === "caption" });
    await sleep(400);
    const errors = got(doctor, "signaling-error");
    assert.ok(errors.length >= 1 && errors.length <= 3, "error replies are capped (3 a second)");
    assert.ok(errors.every((e) => e.code === "invalid_payload"), JSON.stringify(errors));
    assert.equal(JSON.stringify(errors).includes(SECRET), false);
    assert.equal(got(patient, "caption").length + got(patient, "lang-changed").length, 0);
    closeAll(doctor, patient);
  });

  test("a message that is too big is refused", async () => {
    const { doctor, patient } = await bothJoined(stack);
    const hindi = "नमस्ते ".repeat(300).slice(0, 2000);
    doctor.emit("caption", caption(stack.ids.appointmentId, { text: hindi, tr: { en: hindi, de: hindi, es: hindi } }));
    const err = await stack.waitFor(doctor, "signaling-error", { predicate: (e) => e.event === "caption" });
    assert.equal(err.code, "too_big");
    await sleep(200);
    assert.equal(got(patient, "caption").length, 0);
    closeAll(doctor, patient);
  });

  test("someone who is not in the call room cannot send into it (not_in_room), and nobody receives anything", async () => {
    const { doctor, patient } = await bothJoined(stack);
    const outsider = await stack.connect({ token: stack.tokens.other.accessToken });
    outsider.emit("caption", caption(stack.ids.appointmentId));
    outsider.emit("lang-changed", { appointmentId: String(stack.ids.appointmentId), lang: "de" });
    const err = await stack.waitFor(outsider, "signaling-error");
    assert.equal(err.code, "not_in_room");
    await sleep(300);
    assert.equal(got(doctor, "caption").length + got(patient, "caption").length + got(doctor, "lang-changed").length + got(patient, "lang-changed").length, 0);
    // a socket that never signed in at all
    const anonymous = await stack.connect();
    anonymous.emit("caption", caption(stack.ids.appointmentId));
    assert.equal((await stack.waitFor(anonymous, "signaling-error")).code, "not_in_room");
    closeAll(doctor, patient, outsider, anonymous);
  });

  test("an admin or any other signed-in person who never joined the call gets nothing and sends nothing", async () => {
    const { doctor, patient } = await bothJoined(stack);
    const admin = await stack.connect({ token: stack.tokens.admin.accessToken });
    admin.emit("caption", caption(stack.ids.appointmentId));
    assert.equal((await stack.waitFor(admin, "signaling-error")).code, "not_in_room");
    doctor.emit("caption", caption(stack.ids.appointmentId, { id: "cap-9" }));
    await stack.waitFor(patient, "caption");
    await sleep(200);
    assert.equal(got(admin, "caption").length, 0, "captions only reach the people in the call");
    closeAll(doctor, patient, admin);
  });

  test("the sender is rate limited (12 a second) and captions are never replayed to someone who joins later", async () => {
    const doctor = await stack.connect({ token: stack.tokens.doctor.accessToken });
    await stack.joinAppointment(doctor, "doctor");
    await sleep(300);
    // no one else is in the room: nothing is stored for later
    doctor.emit("caption", caption(stack.ids.appointmentId, { id: "early-1" }));
    await sleep(300);
    const patient = await stack.connect({ token: stack.tokens.patient.accessToken });
    await stack.joinAppointment(patient, "patient");
    await stack.waitFor(patient, "peer-joined");
    await sleep(500);
    assert.equal(got(patient, "caption").length, 0, "a late joiner gets no replay");

    for (let i = 0; i < 40; i++) doctor.emit("caption", caption(stack.ids.appointmentId, { id: `burst-${i}`, final: false, text: `partial ${i}` }));
    await sleep(900);
    const delivered = got(patient, "caption").length;
    assert.ok(delivered >= 1 && delivered <= 12, `at most 12 get through in a second, got ${delivered}`);
    assert.ok(got(doctor, "signaling-error").some((e) => e.event === "caption" && e.code === "rate_limited"));
    closeAll(doctor, patient);
  });

  test("the real server log never contains a word of any caption, refused or relayed (only event name + code)", async () => {
    const logs = stack.logs();
    assert.equal(logs.includes(SECRET), false, "caption text found in the server log");
    assert.equal(logs.includes("Guten Tag"), false);
    assert.match(logs, /\[socket\] signaling event rejected/, "the refusals are logged, by event name and code");
    assert.match(logs, /"event":\s*'?"?caption|event: 'caption'/, "…naming the event");
  });
});

describe("live captions, feature OFF (the default)", () => {
  let stack;
  before(async () => { stack = await startStack({ env: { TRANSCRIPTION_ENABLED: "false" } }); });
  after(async () => { await stack?.stop(); });

  test("captions and language changes are ignored completely: nothing is relayed, no error is sent back, nothing is logged", async () => {
    const { doctor, patient } = await bothJoined(stack);
    for (let i = 0; i < 5; i++) {
      doctor.emit("caption", caption(stack.ids.appointmentId, { id: `off-${i}` }));
      patient.emit("lang-changed", { appointmentId: String(stack.ids.appointmentId), lang: "de" });
    }
    doctor.emit("caption", { garbage: true });
    await sleep(700);
    for (const s of [doctor, patient]) {
      assert.equal(got(s, "caption").length + got(s, "lang-changed").length, 0);
      assert.equal(got(s, "signaling-error").length, 0, "behaves like an event the server never heard of");
    }
    assert.equal(stack.logs().includes(SECRET), false);
    assert.equal(/event: 'caption'|event: 'lang-changed'/.test(stack.logs()), false, "not even a refusal is logged");
    closeAll(doctor, patient);
  });

  test("the rest of the call still works exactly as before (camera-state is relayed)", async () => {
    const { doctor, patient } = await bothJoined(stack);
    doctor.emit("camera-state", { appointmentId: stack.ids.appointmentId, isCamOff: true });
    assert.equal((await stack.waitFor(patient, "camera-state")).isCamOff, true);
    closeAll(doctor, patient);
  });
});
