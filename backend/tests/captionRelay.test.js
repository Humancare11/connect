const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { MAX_TEXT, MAX_MESSAGE_BYTES, cleanCaptionText, parseLangChanged, parseCaption, createCaptionHandlers, parseStatus, STATUSES } = require("../utils/speech/captionRelay");

const SECRET = "ZEBRA-CAPTION-SECRET";
const APPT = "64b7f0c2a1b2c3d4e5f60718";
const cap = (extra = {}) => ({ appointmentId: APPT, id: "cap-1", final: true, text: "Guten Tag", srcLang: "de-DE", conf: 0.9, tr: { en: "Hello" }, ...extra });

describe("caption text cleaning", () => {
  test("control characters become spaces, spaces collapse, long text is cut at the limit", () => {
    assert.equal(cleanCaptionText("  hello\u0000\n\tworld  "), "hello world");
    assert.equal(cleanCaptionText("नमस्ते दुनिया"), "नमस्ते दुनिया");
    assert.equal(cleanCaptionText("a".repeat(MAX_TEXT + 500)).length, MAX_TEXT);
  });
  test("anything that is not text, or is absurdly long, becomes empty", () => {
    for (const v of [undefined, null, 5, {}, [], true, "", "   ", "\u0000", "a".repeat(MAX_TEXT * 2 + 1)]) assert.equal(cleanCaptionText(v), "", String(typeof v));
  });
});

describe("lang-changed payload", () => {
  test("accepts none and well-formed language codes", () => {
    for (const lang of ["none", "en", "de", "hi", "fil", "zh-Hans", "zh-Hant", "sr-Cyrl", "pt-pt", "fr-ca", "mn-Cyrl", "yue", "en-IN", "zh-Hans-CN"]) {
      assert.deepEqual(parseLangChanged({ appointmentId: APPT, lang }), { ok: true, appointmentId: APPT, lang }, lang);
    }
  });
  test("refuses everything else", () => {
    for (const bad of [null, undefined, "x", 5, [], {}, { lang: "de" }, { appointmentId: APPT }, { appointmentId: "", lang: "de" }, { appointmentId: 5, lang: "de" },
      { appointmentId: "x".repeat(65), lang: "de" }, { appointmentId: APPT, lang: "" }, { appointmentId: APPT, lang: "NONE" }, { appointmentId: APPT, lang: "<b>" },
      { appointmentId: APPT, lang: "english" }, { appointmentId: APPT, lang: 5 }, { appointmentId: APPT, lang: { a: 1 } }, { appointmentId: APPT, lang: "de_DE" },
      Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`k${i}`, 1]))]) {
      assert.equal(parseLangChanged(bad).ok, false, JSON.stringify(bad)?.slice(0, 60));
    }
  });
});

describe("caption payload", () => {
  test("a good caption is kept, with only the known fields", () => {
    const out = parseCaption(cap({ from: "doctor", role: "doctor", at: 1, extra: "x", evil: { a: 1 } }));
    assert.equal(out.ok, true);
    assert.equal(out.appointmentId, APPT);
    assert.deepEqual(out.caption, { id: "cap-1", final: true, text: "Guten Tag", srcLang: "de-DE", conf: 0.9, tr: { en: "Hello" } });
  });
  test("partial captions work the same; optional fields may be missing", () => {
    const out = parseCaption({ appointmentId: APPT, id: "cap-2", final: false, text: "Gut" });
    assert.deepEqual(out.caption, { id: "cap-2", final: false, text: "Gut", srcLang: "", conf: null, tr: {} });
  });
  test("translation keys are lower-cased, empty ones are dropped, at most 3", () => {
    assert.deepEqual(parseCaption(cap({ tr: { EN: "Hello", "fr-CA": "Bonjour", es: "   " } })).caption.tr, { en: "Hello", "fr-ca": "Bonjour" });
    assert.equal(parseCaption(cap({ tr: { en: "a", de: "b", es: "c", fr: "d" } })).ok, false);
    assert.equal(parseCaption(cap({ tr: { "a1": "x" } })).ok, false);
    assert.equal(parseCaption(cap({ tr: ["x"] })).ok, false);
    assert.equal(parseCaption(cap({ tr: "x" })).ok, false);
    assert.equal(parseCaption(cap({ tr: { en: 5 } })).ok, false);
    assert.equal(parseCaption(cap({ tr: null })).ok, true);
  });
  test("bad language and confidence values are cleaned, not fatal", () => {
    assert.equal(parseCaption(cap({ srcLang: "<script>" })).caption.srcLang, "");
    for (const conf of [1.5, -1, "0.9", NaN, null, {}]) assert.equal(parseCaption(cap({ conf })).caption.conf, null, String(conf));
    assert.equal(parseCaption(cap({ conf: 0 })).caption.conf, 0);
  });
  test("the id, the final flag, the text and the appointment are required and checked", () => {
    for (const bad of [null, "x", [], 5, cap({ id: undefined }), cap({ id: "" }), cap({ id: "has space" }), cap({ id: "x".repeat(65) }), cap({ id: 5 }),
      cap({ final: "true" }), cap({ final: 1 }), cap({ final: undefined }), cap({ text: "" }), cap({ text: "   " }), cap({ text: 5 }), cap({ text: undefined }),
      cap({ appointmentId: undefined }), cap({ appointmentId: "" }), cap({ appointmentId: 5 }), cap({ appointmentId: "x".repeat(65) })]) {
      const out = parseCaption(bad);
      assert.equal(out.ok, false, JSON.stringify(bad)?.slice(0, 70));
      assert.equal(out.reason, "invalid_payload");
    }
  });
  test("a message bigger than 8 KB is refused as too_big (multi-byte text counts in bytes)", () => {
    const hindi = "नमस्ते ".repeat(300).slice(0, MAX_TEXT); // 3 bytes per character
    const out = parseCaption(cap({ text: hindi, tr: { en: hindi, de: hindi, es: hindi } }));
    assert.equal(out.ok, false);
    assert.equal(out.reason, "too_big");
    assert.equal(MAX_MESSAGE_BYTES, 8192);
    assert.equal(parseCaption(cap({ text: "a".repeat(MAX_TEXT) })).ok, true);
  });
  test("an object with a huge number of keys is refused without being walked", () => {
    const wide = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`k${i}`, "x"]));
    assert.equal(parseCaption({ ...cap(), ...wide }).ok, false);
  });
});

describe("the two handlers", () => {
  function setup(over = {}) {
    const calls = { relay: [], reject: [], lang: 0, caption: 0 };
    const socket = { id: "sock-1" };
    const deps = {
      isEnabled: () => true,
      isInRoom: () => true,
      getSenderRole: () => "doctor",
      allowLang: () => { calls.lang++; return true; },
      allowCaption: () => { calls.caption++; return true; },
      relay: (s, appointmentId, event, payload) => calls.relay.push({ s, appointmentId, event, payload }),
      reject: (s, event, code) => calls.reject.push({ event, code }),
      now: () => 1700000000000,
      ...over,
    };
    return { calls, socket, h: createCaptionHandlers(deps) };
  }

  test("flag off: ignored completely (no relay, no error reply, no limiter use), exactly like an unknown event", () => {
    const { calls, socket, h } = setup({ isEnabled: () => false });
    h.onCaption(socket, cap());
    h.onLangChanged(socket, { appointmentId: APPT, lang: "de" });
    h.onCaption(socket, null);
    assert.deepEqual([calls.relay.length, calls.reject.length, calls.lang, calls.caption], [0, 0, 0, 0]);
  });

  test("a good caption is relayed to the others with the sender's role from the SOCKET, a server time, and only known fields", () => {
    const { calls, socket, h } = setup({ getSenderRole: () => "user" });
    h.onCaption(socket, cap({ from: "doctor", role: "doctor", at: 5, stolen: "x" }));
    assert.equal(calls.reject.length, 0);
    assert.equal(calls.relay.length, 1);
    const r = calls.relay[0];
    assert.equal(r.s, socket, "relayed from the sender's socket, so the sender does not get it back");
    assert.equal(r.appointmentId, APPT);
    assert.equal(r.event, "caption");
    assert.deepEqual(r.payload, { appointmentId: APPT, from: "patient", id: "cap-1", final: true, text: "Guten Tag", srcLang: "de-DE", conf: 0.9, tr: { en: "Hello" }, at: 1700000000000 });
  });

  test("a doctor's captions say doctor; a patient's say patient", () => {
    for (const [role, from] of [["doctor", "doctor"], ["user", "patient"]]) {
      const { calls, socket, h } = setup({ getSenderRole: () => role });
      h.onCaption(socket, cap());
      h.onLangChanged(socket, { appointmentId: APPT, lang: "de" });
      assert.deepEqual(calls.relay.map((x) => x.payload.from), [from, from]);
    }
  });

  test("lang-changed is relayed as { appointmentId, lang, from } and nothing else", () => {
    const { calls, socket, h } = setup();
    h.onLangChanged(socket, { appointmentId: APPT, lang: "hi", from: "patient", extra: 1 });
    assert.deepEqual(calls.relay[0].payload, { appointmentId: APPT, lang: "hi", from: "doctor" });
    assert.equal(calls.relay[0].event, "lang-changed");
  });

  test("bad payloads are refused with a code and never relayed", () => {
    const { calls, socket, h } = setup();
    for (const bad of [null, undefined, "x", 5, [], {}, cap({ text: "" }), cap({ final: "yes" })]) h.onCaption(socket, bad);
    for (const bad of [null, "x", {}, { appointmentId: APPT }, { appointmentId: APPT, lang: "<b>" }]) h.onLangChanged(socket, bad);
    assert.equal(calls.relay.length, 0);
    assert.equal(calls.reject.length, 13);
    assert.ok(calls.reject.every((r) => r.code === "invalid_payload"));
    assert.deepEqual([calls.lang, calls.caption], [0, 0], "no rate-limit slot is spent on junk");
  });

  test("too big, not in the room, wrong role and rate limit each have their own code", () => {
    const hindi = "नमस्ते ".repeat(300).slice(0, MAX_TEXT);
    let s = setup();
    s.h.onCaption(s.socket, cap({ text: hindi, tr: { en: hindi, de: hindi, es: hindi } }));
    assert.deepEqual(s.calls.reject, [{ event: "caption", code: "too_big" }]);

    s = setup({ isInRoom: () => false });
    s.h.onCaption(s.socket, cap()); s.h.onLangChanged(s.socket, { appointmentId: APPT, lang: "de" });
    assert.deepEqual(s.calls.reject, [{ event: "caption", code: "not_in_room" }, { event: "lang-changed", code: "not_in_room" }]);

    for (const role of ["admin", "superadmin", "partner", undefined, ""]) {
      s = setup({ getSenderRole: () => role });
      s.h.onCaption(s.socket, cap()); s.h.onLangChanged(s.socket, { appointmentId: APPT, lang: "de" });
      assert.deepEqual(s.calls.reject, [{ event: "caption", code: "not_allowed" }, { event: "lang-changed", code: "not_allowed" }], String(role));
      assert.equal(s.calls.relay.length, 0);
    }

    s = setup({ allowCaption: () => false, allowLang: () => false });
    s.h.onCaption(s.socket, cap()); s.h.onLangChanged(s.socket, { appointmentId: APPT, lang: "de" });
    assert.deepEqual(s.calls.reject, [{ event: "caption", code: "rate_limited" }, { event: "lang-changed", code: "rate_limited" }]);
    assert.equal(s.calls.relay.length, 0);
  });

  test("the cheap checks come first: junk never reaches the room or rate-limit checks", () => {
    const order = [];
    const { socket, h } = setup({ isInRoom: () => { order.push("room"); return true; }, allowCaption: () => { order.push("rate"); return true; } });
    h.onCaption(socket, { nonsense: true });
    assert.deepEqual(order, []);
    h.onCaption(socket, cap());
    assert.deepEqual(order, ["room", "rate"]);
  });
});

describe("nothing is ever logged", () => {
  test("refusals report the event and a code only, never a word of the payload", () => {
    const printed = [];
    const real = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    for (const m of Object.keys(real)) console[m] = (...a) => printed.push(a.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(" "));
    try {
      // the same shape as server.js rejectSignal: event + code + socket id
      const reject = (socket, event, code) => console.warn("[socket] signaling event rejected", { event, code, socketId: socket.id });
      const mk = (over) => createCaptionHandlers({ isEnabled: () => true, isInRoom: () => true, getSenderRole: () => "doctor", allowLang: () => true, allowCaption: () => true, relay() {}, reject, ...over });
      const socket = { id: "s1" };
      const secretCaption = cap({ text: SECRET, tr: { en: SECRET } });
      mk({}).onCaption(socket, { ...secretCaption, final: "not-a-boolean" });           // invalid
      mk({ isInRoom: () => false }).onCaption(socket, secretCaption);                     // not in room
      mk({ getSenderRole: () => "admin" }).onCaption(socket, secretCaption);              // wrong role
      mk({ allowCaption: () => false }).onCaption(socket, secretCaption);                 // rate limited
      mk({}).onCaption(socket, { ...secretCaption, text: SECRET.repeat(2000) });          // too big / long
      mk({}).onLangChanged(socket, { appointmentId: APPT, lang: SECRET });                // bad language
      mk({}).onCaption(socket, secretCaption);                                            // fine
    } finally {
      Object.assign(console, real);
    }
    assert.ok(printed.length >= 5, "the refusals themselves are reported");
    for (const line of printed) assert.equal(line.includes(SECRET), false, line);
  });

  test("static: the relay module has no console call at all, and server.js wires both events and both limiters", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "utils", "speech", "captionRelay.js"), "utf8");
    assert.equal(/\bconsole\s*\./.test(src), false);
    assert.equal(/\brequire\(\s*["'][^"']*(logger|activityLogger|securityMonitor)/.test(src), false);
    const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    assert.ok(server.includes('socket.on("lang-changed", (payload) => captionHandlers.onLangChanged(socket, payload));'));
    assert.ok(server.includes('socket.on("caption", (payload) => captionHandlers.onCaption(socket, payload));'));
    assert.ok(server.includes('socket.on("tr-status", (payload) => captionHandlers.onStatus(socket, payload));'));
    assert.ok(server.slice(server.indexOf("const SOCKET_LIMITERS = ["), server.indexOf("];", server.indexOf("const SOCKET_LIMITERS = ["))).includes("trStatusLimiter"));
    const list = server.slice(server.indexOf("const SOCKET_LIMITERS = ["), server.indexOf("];", server.indexOf("const SOCKET_LIMITERS = [")));
    assert.ok(list.includes("captionLimiter") && list.includes("langChangedLimiter"), "limiters are cleaned up when a socket disconnects");
    assert.ok(server.includes("reject: rejectSignal"), "refusals go through rejectSignal, which logs event + code only");
  });
});

describe("tr-status (the speaker's recognizer health, so the listener can unmute the real voice at once)", () => {
  const ST = (extra = {}) => ({ appointmentId: APPT, status: "stalled", ...extra });
  function setup(over = {}) {
    const calls = { relay: [], reject: [], status: 0, lang: 0 };
    const deps = {
      isEnabled: () => true, isInRoom: () => true, getSenderRole: () => "doctor",
      allowLang: () => { calls.lang++; return true; }, allowCaption: () => true, allowStatus: () => { calls.status++; return true; },
      relay: (s, appointmentId, event, payload) => calls.relay.push({ appointmentId, event, payload }),
      reject: (s, event, code) => calls.reject.push({ event, code }), now: () => 1,
      ...over,
    };
    return { calls, socket: { id: "s1" }, h: createCaptionHandlers(deps) };
  }
  test("only the known statuses are accepted", () => {
    assert.deepEqual([...STATUSES].sort(), ["backgrounded", "down", "interrupted", "no_match", "ok", "stalled"]);
    for (const status of STATUSES) assert.equal(parseStatus(ST({ status })).ok, true);
    for (const bad of [null, "x", [], {}, ST({ status: "boom" }), ST({ status: 5 }), ST({ status: undefined }), ST({ appointmentId: undefined }), ST({ appointmentId: "" }), ST({ appointmentId: 5 })]) assert.equal(parseStatus(bad).ok, false);
  });
  test("relayed as { appointmentId, status, from } with the role from the socket and nothing else; uses its own limiter", () => {
    const { calls, socket, h } = setup({ getSenderRole: () => "user" });
    h.onStatus(socket, ST({ from: "doctor", text: SECRET, extra: 1 }));
    assert.deepEqual(calls.relay, [{ appointmentId: APPT, event: "tr-status", payload: { appointmentId: APPT, status: "stalled", from: "patient" } }]);
    assert.deepEqual([calls.status, calls.lang], [1, 0]);
  });
  test("flag off: ignored silently. Bad payload, outsider, wrong role and rate limit each get a code and are never relayed", () => {
    const off = setup({ isEnabled: () => false });
    off.h.onStatus(off.socket, ST());
    assert.deepEqual([off.calls.relay.length, off.calls.reject.length], [0, 0]);
    const bad = setup(); bad.h.onStatus(bad.socket, { appointmentId: APPT, status: "nope" });
    const out = setup({ isInRoom: () => false }); out.h.onStatus(out.socket, ST());
    const role = setup({ getSenderRole: () => "admin" }); role.h.onStatus(role.socket, ST());
    const rate = setup({ allowStatus: () => false }); rate.h.onStatus(rate.socket, ST());
    assert.deepEqual([bad, out, role, rate].map((x) => x.calls.reject[0].code), ["invalid_payload", "not_in_room", "not_allowed", "rate_limited"]);
    for (const x of [bad, out, role, rate]) assert.equal(x.calls.relay.length, 0);
  });
});

describe("the new gap reason for speech that was not recognised", () => {
  test("accepted by both the model and the save path", () => {
    assert.ok(require("../models/TranscriptSegment").GAP_REASONS.includes("not_recognised"));
    assert.ok(require("../utils/speech/transcriptSegments").GAP_REASONS.has("not_recognised"));
  });
});
