// Visit Note editor: load/merge/backup helpers. Run from frontend/:  node --test tests/visitNoteDraft.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import { mergeLoaded, diffFields, readBackup, writeBackup, backupOwner, clearAllBackups, clearBackup, isPermanentLoadError, isFinalisedLockError } from "../src/utils/visitNoteDraft.js";

const empty = { symptoms: "", clinicalFindings: "", plan: "", note: "" };
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), size: () => m.size, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null };
};

test("mergeLoaded: untouched fields take the server text", () => {
  const server = { ...empty, symptoms: "Fever" };
  assert.deepEqual(mergeLoaded(server, empty, new Set(), null), server);
});

test("mergeLoaded: text typed before the load arrived is kept, never overwritten", () => {
  const server = { ...empty, symptoms: "Fever" };
  const typed = { ...empty, plan: "Rest" };
  const out = mergeLoaded(server, typed, new Set(["plan"]), null);
  assert.equal(out.symptoms, "Fever");
  assert.equal(out.plan, "Rest");
});

test("mergeLoaded: server and typed text in the same field are both kept (nothing is lost)", () => {
  const server = { ...empty, symptoms: "Fever for 3 days" };
  const out = mergeLoaded(server, { ...empty, symptoms: "Cough" }, new Set(["symptoms"]), null);
  assert.equal(out.symptoms, "Fever for 3 days\nCough");
});

test("mergeLoaded: a local backup on top of the same server text is restored (unsaved text survives a drop)", () => {
  const server = { ...empty, symptoms: "Fever" };
  const backup = { base: { symptoms: "Fever" }, value: { symptoms: "Fever and chills" } };
  assert.equal(mergeLoaded(server, empty, new Set(), backup).symptoms, "Fever and chills");
});

test("mergeLoaded: a backup older than newer server text does not overwrite it (kept alongside)", () => {
  const server = { ...empty, symptoms: "Newer text saved elsewhere" };
  const backup = { base: { symptoms: "Fever" }, value: { symptoms: "Fever and chills" } };
  const out = mergeLoaded(server, empty, new Set(), backup);
  assert.match(out.symptoms, /^Newer text saved elsewhere\nFever and chills$/);
});

test("mergeLoaded: text already on the server is not duplicated", () => {
  const server = { ...empty, note: "abc def" };
  const out = mergeLoaded(server, { ...empty, note: "abc def" }, new Set(["note"]), { base: { note: "" }, value: { note: "abc def" } });
  assert.equal(out.note, "abc def");
});

test("backup: written only while there are unsaved changes, cleared once saved", () => {
  const store = memoryStorage();
  const saved = { ...empty, symptoms: "Fever" };
  writeBackup("d1", "a1", saved, { ...saved, plan: "Rest" }, store);
  const b = readBackup("d1", "a1", store);
  assert.deepEqual(b.value, { plan: "Rest" });
  assert.deepEqual(b.base, { plan: "" });
  writeBackup("d1", "a1", { ...saved, plan: "Rest" }, { ...saved, plan: "Rest" }, store);
  assert.equal(readBackup("d1", "a1", store), null);
  assert.equal(store.size(), 0);
});

test("backup: unreadable storage never throws", () => {
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  assert.equal(readBackup("d1", "a1", broken), null);
  assert.doesNotThrow(() => writeBackup("d1", "a1", empty, { ...empty, note: "x" }, broken));
});

test("diffFields lists only changed fields", () => {
  assert.deepEqual(diffFields({ ...empty, plan: "x" }, empty), { plan: "x" });
});

test("load errors: network / 5xx / 401 / timeout are retried; 403 / 404 are final", () => {
  assert.equal(isPermanentLoadError({}), false); // network error: no response
  assert.equal(isPermanentLoadError({ response: { status: 500 } }), false);
  assert.equal(isPermanentLoadError({ response: { status: 401 } }), false);
  assert.equal(isPermanentLoadError({ response: { status: 429 } }), false);
  assert.equal(isPermanentLoadError({ response: { status: 404 } }), true);
  assert.equal(isPermanentLoadError({ response: { status: 403 } }), true);
});

test("only a finalised-note 409 locks the editor; a version conflict does not", () => {
  const e = (msg) => ({ response: { status: 409, data: { msg } } });
  assert.equal(isFinalisedLockError(e("This note is finalised into a Visit Note and can no longer be edited.")), true);
  assert.equal(isFinalisedLockError(e("Note was updated elsewhere. Refresh and try again.")), false);
  assert.equal(isFinalisedLockError({ response: { status: 500, data: { msg: "finalised" } } }), false);
});

const jwt = (id) => `x.${Buffer.from(JSON.stringify({ id })).toString("base64url")}.y`;

test("backup is scoped per doctor and per appointment", () => {
  const store = memoryStorage();
  const unsaved = { ...empty, note: "private" };
  writeBackup("docA", "a1", empty, unsaved, store);
  assert.equal(readBackup("docA", "a1", store).value.note, "private");
  assert.equal(readBackup("docB", "a1", store), null, "another doctor on the same browser sees nothing");
  assert.equal(readBackup("docA", "a2", store), null, "another appointment sees nothing");
  assert.equal(backupOwner(jwt("doc-123")), "doc-123");
  assert.equal(backupOwner("garbage"), "anon");
  assert.equal(backupOwner(""), "anon");
});

test("backup is removed right after a successful save (nothing unsaved left)", () => {
  const store = memoryStorage();
  writeBackup("d1", "a1", empty, { ...empty, note: "x" }, store);
  assert.equal(store.size(), 1);
  writeBackup("d1", "a1", { ...empty, note: "x" }, { ...empty, note: "x" }, store); // what the editor does once the save lands
  assert.equal(store.size(), 0);
});

test("finalise clears the backup of that note only; Sign Out clears every note backup but nothing else", () => {
  const store = memoryStorage();
  writeBackup("d1", "a1", empty, { ...empty, note: "1" }, store);
  writeBackup("d1", "a2", empty, { ...empty, note: "2" }, store);
  writeBackup("d2", "a3", empty, { ...empty, note: "3" }, store);
  store.setItem("unrelated", "keep");
  clearBackup("d1", "a1", store);
  assert.equal(readBackup("d1", "a1", store), null);
  assert.ok(readBackup("d1", "a2", store));
  clearAllBackups(store);
  assert.equal(readBackup("d1", "a2", store), null);
  assert.equal(readBackup("d2", "a3", store), null);
  assert.equal(store.getItem("unrelated"), "keep");
});
