const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { decryptPHI } = require("../utils/phiCrypto");
const { getConfidenceThresholds, getLateUploadMinutes } = require("../utils/speech/config");
const { MAX_BATCH, MAX_TEXT, MAX_AGE_MS, bookingEndedAt, isLateUpload, cleanText, confidenceTier, languageBase, prepareOne, prepareBatch, serializeSegment } = require("../utils/speech/transcriptSegments");

const NOW = new Date("2026-11-12T10:00:00.000Z");
const TH = { unclearBelow: 0.4, lowBelow: 0.7 };
const one = (item) => prepareOne(item, { receivedAt: NOW, thresholds: TH });
const line = (extra = {}) => ({ type: "line", clientId: "line-0001", original: "Guten Tag, ich habe Kopfschmerzen.", translations: { en: "Hello, I have a headache." }, sourceLang: "de-DE", confidence: 0.9, ...extra });
const gap = (extra = {}) => ({ type: "gap", clientId: "gap-00001", reason: "muted", durationMs: 5000, ageMs: 5000, ...extra });

describe("transcript text cleaning", () => {
  test("plain text only: control characters become spaces, spaces collapse, ends are trimmed", () => {
    assert.deepEqual(cleanText("  hello\u0000\n\tworld   again  "), { ok: true, value: "hello world again" });
    assert.deepEqual(cleanText("नमस्ते   दुनिया"), { ok: true, value: "नमस्ते दुनिया" });
    assert.deepEqual(cleanText("你好，世界"), { ok: true, value: "你好，世界" });
  });
  test("empty, whitespace-only and non-text values are refused; over-long text is refused, exactly at the limit is fine", () => {
    for (const v of ["", "   ", "\u0000\u0001", undefined, null, 5, {}, ["a"]]) assert.equal(cleanText(v).ok, false, JSON.stringify(v));
    assert.equal(cleanText("a".repeat(MAX_TEXT)).ok, true);
    assert.deepEqual(cleanText("a".repeat(MAX_TEXT + 1)), { ok: false, reason: "text_too_long" });
  });
  test("HTML is kept as plain text (it is stored encrypted and shown as text); it is never interpreted here", () => {
    assert.equal(cleanText("<b>pain</b> & fever").value, "<b>pain</b> & fever");
  });
});

describe("confidence tiers and thresholds", () => {
  test("tiers follow the thresholds", () => {
    assert.equal(confidenceTier(0.39, TH), "unclear");
    assert.equal(confidenceTier(0.4, TH), "low");
    assert.equal(confidenceTier(0.69, TH), "low");
    assert.equal(confidenceTier(0.7, TH), "normal");
    assert.equal(confidenceTier(1, TH), "normal");
    assert.equal(confidenceTier(0, TH), "unclear");
    assert.equal(confidenceTier(null, TH), "unknown");
    assert.equal(confidenceTier(undefined, TH), "unknown");
  });
  test("the thresholds default to 0.4 / 0.7, can be set, and a bad pair falls back to the defaults", () => {
    const d = { unclearBelow: 0.4, lowBelow: 0.7 };
    assert.deepEqual(getConfidenceThresholds({}), d);
    assert.deepEqual(getConfidenceThresholds({ TRANSCRIPT_UNCLEAR_BELOW: "0.3", TRANSCRIPT_LOW_BELOW: "0.6" }), { unclearBelow: 0.3, lowBelow: 0.6 });
    for (const bad of [
      { TRANSCRIPT_UNCLEAR_BELOW: "0.3" }, { TRANSCRIPT_LOW_BELOW: "0.6" },
      { TRANSCRIPT_UNCLEAR_BELOW: "0.8", TRANSCRIPT_LOW_BELOW: "0.6" }, { TRANSCRIPT_UNCLEAR_BELOW: "0.5", TRANSCRIPT_LOW_BELOW: "0.5" },
      { TRANSCRIPT_UNCLEAR_BELOW: "abc", TRANSCRIPT_LOW_BELOW: "0.6" }, { TRANSCRIPT_UNCLEAR_BELOW: "0", TRANSCRIPT_LOW_BELOW: "0.6" },
      { TRANSCRIPT_UNCLEAR_BELOW: "0.3", TRANSCRIPT_LOW_BELOW: "1.5" }, { TRANSCRIPT_UNCLEAR_BELOW: "", TRANSCRIPT_LOW_BELOW: "" },
    ]) assert.deepEqual(getConfidenceThresholds(bad), d, JSON.stringify(bad));
  });
});

describe("one transcript line", () => {
  test("a good line becomes a row whose words are only inside the encrypted blob", () => {
    const { doc } = one(line({ ageMs: 4000 }));
    assert.equal(doc.kind, "line");
    assert.equal(doc.clientId, "line-0001");
    assert.equal(doc.sourceLang, "de-DE");
    assert.equal(doc.confidence, 0.9);
    assert.equal(doc.confidenceTier, "normal");
    assert.equal(doc.machineTranslated, true);
    assert.equal(doc.spokeAt.getTime(), NOW.getTime() - 4000);
    const stored = JSON.stringify(doc);
    assert.equal(stored.includes("Kopfschmerzen"), false, "the original words must not be stored in clear");
    assert.equal(stored.includes("headache"), false, "nor the translation");
    assert.deepEqual(decryptPHI(doc.enc), { original: "Guten Tag, ich habe Kopfschmerzen.", translations: { en: "Hello, I have a headache." } });
  });

  test("the browser's clock cannot move a row: only the reported age counts, and it is clamped", () => {
    assert.equal(one(line()).doc.spokeAt.getTime(), NOW.getTime());
    assert.equal(one(line({ ageMs: -5000 })).doc.spokeAt.getTime(), NOW.getTime(), "negative age = now");
    assert.equal(one(line({ ageMs: "abc" })).doc.spokeAt.getTime(), NOW.getTime());
    assert.equal(one(line({ ageMs: NaN })).doc.spokeAt.getTime(), NOW.getTime());
    assert.equal(one(line({ ageMs: 1e15 })).doc.spokeAt.getTime(), NOW.getTime() - MAX_AGE_MS, "never older than the limit");
    assert.equal(one(line({ spokeAt: "2001-01-01", receivedAt: "2001-01-01" })).doc.spokeAt.getTime(), NOW.getTime(), "dates sent by the browser are ignored");
  });

  test("confidence: valid numbers kept, anything else becomes unknown", () => {
    for (const [c, tier] of [[0.2, "unclear"], [0.5, "low"], [0.95, "normal"]]) assert.equal(one(line({ confidence: c })).doc.confidenceTier, tier);
    for (const c of [1.5, -0.1, "0.9", NaN, null, undefined, {}]) {
      const { doc } = one(line({ confidence: c }));
      assert.equal(doc.confidence, null, String(c));
      assert.equal(doc.confidenceTier, "unknown", String(c));
    }
  });

  test("language fields are checked; only exactly true sets a flag", () => {
    assert.equal(one(line({ sourceLang: "hi-IN" })).doc.sourceLang, "hi-IN");
    assert.equal(one(line({ sourceLang: "zh-Hans-CN" })).doc.sourceLang, "zh-Hans-CN");
    for (const bad of ["<script>", "x", "english please", 5, {}, "de_DE", "a".repeat(30)]) assert.equal(one(line({ sourceLang: bad })).doc.sourceLang, "", String(bad));
    assert.equal(one(line({ languageSource: "auto" })).doc.languageSource, "auto");
    assert.equal(one(line({ languageSource: "declared" })).doc.languageSource, "declared");
    assert.equal(one(line({ languageSource: "guess" })).doc.languageSource, "");
    assert.deepEqual(one(line({ flags: { suspectedEcho: true, languageNotInList: true, evil: true } })).doc.flags, { suspectedEcho: true, languageNotInList: true });
    assert.deepEqual(one(line({ flags: { suspectedEcho: "true", languageNotInList: 1 } })).doc.flags, { suspectedEcho: false, languageNotInList: false });
    assert.deepEqual(one(line({ flags: "echo" })).doc.flags, { suspectedEcho: false, languageNotInList: false });
  });

  test("translations: up to 3, valid language codes, lower-cased keys, empty ones dropped", () => {
    const { doc } = one(line({ translations: { EN: "Hello", "fr-CA": "Bonjour", es: "   " } }));
    assert.deepEqual(decryptPHI(doc.enc).translations, { en: "Hello", "fr-ca": "Bonjour" });
    assert.deepEqual(one(line({ translations: undefined })).doc && decryptPHI(one(line({ translations: undefined })).doc.enc).translations, {});
    assert.equal(one(line({ translations: { a1: "x" } })).reason, "bad_translation_language");
    assert.equal(one(line({ translations: { en: "a", de: "b", es: "c", fr: "d" } })).reason, "too_many_translations");
    assert.equal(one(line({ translations: ["x"] })).reason, "bad_translations");
    assert.equal(one(line({ translations: "x" })).reason, "bad_translations");
    assert.equal(one(line({ translations: { en: 5 } })).reason, "bad_translation");
    assert.equal(one(line({ translations: { en: "a".repeat(MAX_TEXT + 1) } })).reason, "text_too_long");
  });

  test("machineTranslated is true only when a translation into ANOTHER language is stored", () => {
    assert.equal(one(line({ sourceLang: "en-US", translations: { en: "same language" } })).doc.machineTranslated, false);
    assert.equal(one(line({ sourceLang: "en-US", translations: undefined })).doc.machineTranslated, false);
    assert.equal(one(line({ sourceLang: "de-DE", translations: { en: "x" } })).doc.machineTranslated, true);
    assert.equal(one(line({ sourceLang: "en-IN", translations: { en: "x", hi: "y" } })).doc.machineTranslated, true);
    assert.equal(one(line({ sourceLang: "", translations: { en: "x" } })).doc.machineTranslated, true, "language unknown: assume machine-made");
    assert.equal(languageBase("zh-Hans-CN"), "zh");
  });

  test("rows that cannot be stored say why", () => {
    assert.equal(one(null).reason, "bad_item");
    assert.equal(one("line").reason, "bad_item");
    assert.equal(one([]).reason, "bad_item");
    assert.equal(one(line({ type: "audio" })).reason, "bad_type");
    assert.equal(one(line({ type: undefined })).reason, "bad_type");
    for (const id of [undefined, "", "short", "has space!!", "x".repeat(65), 12345678, {}]) assert.equal(one(line({ clientId: id })).reason, "bad_client_id", String(id));
    assert.equal(one(line({ original: "" })).reason, "empty_text");
    assert.equal(one(line({ original: undefined })).reason, "empty_text");
    assert.equal(one(line({ original: "x".repeat(MAX_TEXT + 1) })).reason, "text_too_long");
  });
});

describe("one gap (time when nothing was transcribed)", () => {
  test("a gap keeps its reason and runs from the start to the start plus its length, never into the future", () => {
    const { doc } = one(gap({ ageMs: 10000, durationMs: 4000 }));
    assert.equal(doc.kind, "gap");
    assert.equal(doc.gapReason, "muted");
    assert.equal(doc.gapFrom.getTime(), NOW.getTime() - 10000);
    assert.equal(doc.gapTo.getTime(), NOW.getTime() - 6000);
    assert.equal(doc.enc, undefined, "a gap has no words");
    assert.equal(one(gap({ ageMs: 1000, durationMs: 60000 })).doc.gapTo.getTime(), NOW.getTime(), "cannot end after it was received");
    assert.equal(one(gap({ durationMs: -5 })).doc.gapTo.getTime(), one(gap({ durationMs: -5 })).doc.gapFrom.getTime());
  });
  test("every known reason is accepted, anything else is refused", () => {
    for (const reason of ["muted", "recognizer_down", "mic_stalled", "backgrounded", "interrupted", "other"]) assert.equal(one(gap({ reason })).doc.gapReason, reason);
    for (const reason of ["lunch", "", undefined, 5, "MUTED"]) assert.equal(one(gap({ reason })).reason, "bad_gap_reason", String(reason));
  });
});

describe("a batch: good rows are never lost to bad ones", () => {
  const base = () => ({ appointmentId: new mongoose.Types.ObjectId(), appointmentModel: "Appointment", recordedBy: new mongoose.Types.ObjectId(), speakerRole: "patient", receivedAt: NOW, noticePending: true });

  test("good rows are kept, bad rows are reported with their position and clientId", () => {
    const items = [line({ clientId: "good-0001" }), line({ clientId: "bad-00002", original: "" }), "junk", gap({ clientId: "good-0003" }), line({ clientId: "bad-00004", type: "video" }), { clientId: 5 }];
    const b = base();
    const { docs, rejected } = prepareBatch(items, b, TH);
    assert.deepEqual(docs.map((d) => d.clientId), ["good-0001", "good-0003"]);
    assert.deepEqual(rejected, [
      { index: 1, clientId: "bad-00002", reason: "empty_text" },
      { index: 2, clientId: null, reason: "bad_item" },
      { index: 4, clientId: "bad-00004", reason: "bad_type" },
      { index: 5, clientId: null, reason: "bad_client_id" },
    ]);
    for (const d of docs) {
      assert.equal(String(d.recordedBy), String(b.recordedBy), "who spoke comes from the caller, not the row");
      assert.equal(d.speakerRole, "patient");
      assert.equal(d.noticePending, true);
      assert.equal(String(d.appointmentId), String(b.appointmentId));
    }
  });

  test("a row cannot override who recorded it, which appointment, the role, or the notice mark", () => {
    const b = base();
    const forged = line({ recordedBy: String(new mongoose.Types.ObjectId()), appointmentId: String(new mongoose.Types.ObjectId()), speakerRole: "doctor", noticePending: false, receivedAt: "2001-01-01", kind: "gap" });
    const { docs } = prepareBatch([forged], b, TH);
    assert.equal(String(docs[0].recordedBy), String(b.recordedBy));
    assert.equal(String(docs[0].appointmentId), String(b.appointmentId));
    assert.equal(docs[0].speakerRole, "patient");
    assert.equal(docs[0].noticePending, true);
    assert.equal(docs[0].kind, "line");
    assert.equal(docs[0].receivedAt.getTime(), NOW.getTime());
  });

  test("the batch limit is a published number", () => {
    assert.equal(MAX_BATCH, 25);
  });
});

describe("late uploads", () => {
  const MIN = 60 * 1000;
  const at = (m) => new Date(NOW.getTime() + m * MIN);

  test("the late-upload limit defaults to 30 minutes and accepts a positive whole number of minutes; anything else falls back to 30", () => {
    assert.equal(getLateUploadMinutes({}), 30);
    assert.equal(getLateUploadMinutes({ TRANSCRIPT_LATE_UPLOAD_MINUTES: "45" }), 45);
    assert.equal(getLateUploadMinutes({ TRANSCRIPT_LATE_UPLOAD_MINUTES: " 1 " }), 1);
    assert.equal(getLateUploadMinutes({ TRANSCRIPT_LATE_UPLOAD_MINUTES: "43200" }), 43200);
    for (const bad of ["0", "-5", "abc", "30.5", "", "  ", "1e3", "43201", "99999999"]) assert.equal(getLateUploadMinutes({ TRANSCRIPT_LATE_UPLOAD_MINUTES: bad }), 30, bad);
  });

  test("a booking ends when it is complete or cancelled; cancellations use cancelledAt when there is one", () => {
    for (const status of ["complete", "completed", "Completed", "COMPLETE", "cancelled", "Cancelled"]) assert.ok(bookingEndedAt({ status, updatedAt: at(0) }), status);
    for (const status of ["confirmed", "Confirmed", "pending", "assigned", "requested", "upcoming", "", undefined]) assert.equal(bookingEndedAt({ status, updatedAt: at(0) }), null, String(status));
    assert.equal(bookingEndedAt(null), null);
    assert.equal(bookingEndedAt({ status: "completed" }), null, "no time stored at all");
    assert.equal(bookingEndedAt({ status: "completed", updatedAt: "garbage" }), null);
    assert.equal(bookingEndedAt({ status: "cancelled", cancelledAt: at(-50), updatedAt: at(-5) }).getTime(), at(-50).getTime());
    assert.equal(bookingEndedAt({ status: "cancelled", updatedAt: at(-5) }).getTime(), at(-5).getTime());
    assert.equal(bookingEndedAt({ status: "completed", cancelledAt: at(-50), updatedAt: at(-5) }).getTime(), at(-5).getTime(), "cancelledAt only counts for a cancellation");
  });

  test("late means STRICTLY more than the limit after the end; a booking that has not ended is never late", () => {
    const done = { status: "completed", updatedAt: at(0) };
    assert.equal(isLateUpload(done, at(30), 30), false);
    assert.equal(isLateUpload(done, new Date(at(30).getTime() + 1), 30), true);
    assert.equal(isLateUpload(done, at(29), 30), false);
    assert.equal(isLateUpload(done, at(31), 30), true);
    assert.equal(isLateUpload(done, at(-5), 30), false, "arriving before the recorded end is not late");
    assert.equal(isLateUpload({ status: "confirmed", updatedAt: at(-9999) }, at(0), 30), false);
    assert.equal(isLateUpload(null, at(0), 30), false);
    assert.equal(isLateUpload(done, at(100), 120), false, "a longer limit");
  });

  test("lateUpload travels with the row: copied from the server's side, ignored if the browser sends it, shown when read back", () => {
    const base = { appointmentId: new mongoose.Types.ObjectId(), appointmentModel: "Appointment", recordedBy: new mongoose.Types.ObjectId(), speakerRole: "doctor", receivedAt: NOW, noticePending: false, lateUpload: true };
    const { docs } = prepareBatch([line({ lateUpload: false }), gap({ clientId: "gap-00002" })], base, TH);
    assert.deepEqual(docs.map((d) => d.lateUpload), [true, true]);
    const forged = prepareBatch([line({ lateUpload: true })], { ...base, lateUpload: false }, TH).docs[0];
    assert.equal(forged.lateUpload, false, "the browser cannot set it");
    const row = (d) => ({ _id: new mongoose.Types.ObjectId(), speakerRole: "doctor", recordedBy: new mongoose.Types.ObjectId(), receivedAt: NOW, ...d });
    assert.equal(serializeSegment(row(docs[0])).lateUpload, true);
    assert.equal(serializeSegment(row(docs[1])).lateUpload, true);
    assert.equal(serializeSegment(row(forged)).lateUpload, false);
  });
});

describe("turning stored rows back into lines", () => {
  const stored = (item, extra = {}) => ({ _id: new mongoose.Types.ObjectId(), speakerRole: "patient", recordedBy: new mongoose.Types.ObjectId(), receivedAt: NOW, noticePending: false, ...prepareOne(item, { receivedAt: NOW, thresholds: TH }).doc, ...extra });

  test("a line comes back readable, with its flags", () => {
    const out = serializeSegment(stored(line({ flags: { languageNotInList: true } })));
    assert.equal(out.kind, "line");
    assert.equal(out.original, "Guten Tag, ich habe Kopfschmerzen.");
    assert.deepEqual(out.translations, { en: "Hello, I have a headache." });
    assert.equal(out.machineTranslated, true);
    assert.equal(out.unreadable, false);
    assert.equal(out.hidden, false);
    assert.equal(out.flags.languageNotInList, true);
    assert.equal(typeof out.id, "string");
    assert.equal("enc" in out, false, "the encrypted blob is never part of the answer");
  });
  test("echo and unclear lines are marked hidden (but still returned); low and normal are not", () => {
    assert.equal(serializeSegment(stored(line({ flags: { suspectedEcho: true } }))).hidden, true);
    assert.equal(serializeSegment(stored(line({ confidence: 0.2 }))).hidden, true);
    assert.equal(serializeSegment(stored(line({ confidence: 0.5 }))).hidden, false);
    assert.equal(serializeSegment(stored(line({ confidence: 0.9 }))).hidden, false);
    assert.equal(serializeSegment(stored(line({ confidence: undefined }))).hidden, false);
  });
  test("a row that cannot be decrypted is reported as unreadable, never thrown, never logged", () => {
    const row = stored(line());
    row.enc = { ...row.enc, authTag: Buffer.from("0".repeat(16)).toString("base64") };
    const out = serializeSegment(row);
    assert.equal(out.unreadable, true);
    assert.equal(out.original, null);
    assert.deepEqual(out.translations, {});
    assert.equal(serializeSegment({ ...row, enc: undefined }).unreadable, true);
  });
  test("a gap comes back with its reason and times", () => {
    const out = serializeSegment(stored(gap({ ageMs: 9000, durationMs: 3000 })));
    assert.deepEqual([out.kind, out.reason], ["gap", "muted"]);
    assert.equal(out.from.getTime(), NOW.getTime() - 9000);
    assert.equal(out.to.getTime(), NOW.getTime() - 6000);
    assert.equal("original" in out, false);
  });
});
