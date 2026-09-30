const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { createAlertEngine } = require("../utils/directCallAlerts");

// Fake Mongo model + mailer — these tests exercise only the trigger/debounce
// logic in utils/directCallAlerts.js, never a real database or SMTP server.
function makeFakes() {
  const created = [];
  const emails = [];
  const AlertModel = {
    create: async (doc) => {
      created.push(doc);
      return doc;
    },
  };
  const sendEmailFn = async (msg) => {
    emails.push(msg);
  };
  return { AlertModel, sendEmailFn, created, emails };
}

describe("directCallAlerts", () => {
  let prevEnabled;
  let prevEmails;

  beforeEach(() => {
    prevEnabled = process.env.DIRECT_CALL_ALERTS_ENABLED;
    prevEmails = process.env.DIRECT_CALL_ALERT_EMAILS;
    process.env.DIRECT_CALL_ALERTS_ENABLED = "true";
    process.env.DIRECT_CALL_ALERT_EMAILS = "ops@example.com,ops2@example.com";
  });

  afterEach(() => {
    process.env.DIRECT_CALL_ALERTS_ENABLED = prevEnabled;
    process.env.DIRECT_CALL_ALERT_EMAILS = prevEmails;
  });

  test("room-full rejection raises one alert and emails all recipients", async () => {
    const { AlertModel, sendEmailFn, created, emails } = makeFakes();
    const engine = createAlertEngine({ AlertModel, sendEmailFn });

    engine.onEvent("rejected", { roomId: "room1", extra: { reason: "full" } });
    // onEvent's internal raise() is fire-and-forget (void raise(...)); give
    // its microtasks a tick to settle before asserting.
    await new Promise((r) => setImmediate(r));

    assert.equal(created.length, 1);
    assert.equal(created[0].type, "room_full");
    assert.equal(created[0].roomId, "room1");
    assert.equal(emails.length, 1);
    assert.equal(emails[0].to, "ops@example.com,ops2@example.com");
  });

  test("full_toctou also counts as a room-full rejection", async () => {
    const { AlertModel, sendEmailFn, created } = makeFakes();
    const engine = createAlertEngine({ AlertModel, sendEmailFn });
    engine.onEvent("rejected", { roomId: "room1", extra: { reason: "full_toctou" } });
    await new Promise((r) => setImmediate(r));
    assert.equal(created.length, 1);
    assert.equal(created[0].type, "room_full");
  });

  test("an unrelated rejection reason raises nothing", async () => {
    const { AlertModel, sendEmailFn, created } = makeFakes();
    const engine = createAlertEngine({ AlertModel, sendEmailFn });
    engine.onEvent("rejected", { roomId: "room1", extra: { reason: "not_found" } });
    await new Promise((r) => setImmediate(r));
    assert.equal(created.length, 0);
  });

  test("3 retries within the window raise repeated_retries exactly once", async () => {
    const { AlertModel, sendEmailFn, created } = makeFakes();
    let clock = 1_000_000;
    const engine = createAlertEngine({ AlertModel, sendEmailFn, now: () => clock, retryWindowMs: 5000 });

    engine.onEvent("retry", { roomId: "room1" });
    clock += 1000;
    engine.onEvent("retry", { roomId: "room1" });
    clock += 1000;
    engine.onEvent("retry", { roomId: "room1" }); // 3rd within the 5s window
    clock += 1000;
    engine.onEvent("retry", { roomId: "room1" }); // 4th — already alerted, debounced
    await new Promise((r) => setImmediate(r));

    assert.equal(created.length, 1);
    assert.equal(created[0].type, "repeated_retries");
    assert.equal(created[0].detail.retryCount, 3);
  });

  test("retries spread outside the window never reach the threshold", async () => {
    const { AlertModel, sendEmailFn, created } = makeFakes();
    let clock = 1_000_000;
    const engine = createAlertEngine({ AlertModel, sendEmailFn, now: () => clock, retryWindowMs: 5000 });

    engine.onEvent("retry", { roomId: "room1" });
    clock += 6000; // outside the 5s window — the first retry ages out
    engine.onEvent("retry", { roomId: "room1" });
    clock += 6000;
    engine.onEvent("retry", { roomId: "room1" });
    await new Promise((r) => setImmediate(r));

    assert.equal(created.length, 0);
  });

  test("both joined + no connect within the window raises never_connected", async () => {
    const { AlertModel, sendEmailFn, created } = makeFakes();
    const engine = createAlertEngine({ AlertModel, sendEmailFn, neverConnectedMs: 20 });

    engine.onEvent("joined", { roomId: "room1", seatCount: 2 });
    await new Promise((r) => setTimeout(r, 60));

    assert.equal(created.length, 1);
    assert.equal(created[0].type, "never_connected");
  });

  test("a connected event before the window cancels the never_connected alert", async () => {
    const { AlertModel, sendEmailFn, created } = makeFakes();
    const engine = createAlertEngine({ AlertModel, sendEmailFn, neverConnectedMs: 30 });

    engine.onEvent("joined", { roomId: "room1", seatCount: 2 });
    engine.onEvent("connected", { roomId: "room1" });
    await new Promise((r) => setTimeout(r, 60));

    assert.equal(created.length, 0);
  });

  test("debounce: two different trigger types in the same room within the window only raise once", async () => {
    const { AlertModel, sendEmailFn, created } = makeFakes();
    let clock = 1_000_000;
    const engine = createAlertEngine({ AlertModel, sendEmailFn, now: () => clock, debounceMs: 600_000 });

    engine.onEvent("rejected", { roomId: "room1", extra: { reason: "full" } });
    clock += 1000;
    engine.onEvent("rejected", { roomId: "room1", extra: { reason: "full" } });
    await new Promise((r) => setImmediate(r));

    assert.equal(created.length, 1);
  });

  test("debounce does not cross rooms", async () => {
    const { AlertModel, sendEmailFn, created } = makeFakes();
    const engine = createAlertEngine({ AlertModel, sendEmailFn });

    engine.onEvent("rejected", { roomId: "room1", extra: { reason: "full" } });
    engine.onEvent("rejected", { roomId: "room2", extra: { reason: "full" } });
    await new Promise((r) => setImmediate(r));

    assert.equal(created.length, 2);
  });

  test("DIRECT_CALL_ALERTS_ENABLED=false suppresses every trigger", async () => {
    process.env.DIRECT_CALL_ALERTS_ENABLED = "false";
    const { AlertModel, sendEmailFn, created } = makeFakes();
    const engine = createAlertEngine({ AlertModel, sendEmailFn });

    engine.onEvent("rejected", { roomId: "room1", extra: { reason: "full" } });
    await new Promise((r) => setImmediate(r));

    assert.equal(created.length, 0);
  });

  test("no recipients configured: alert is still persisted, no email sent", async () => {
    process.env.DIRECT_CALL_ALERT_EMAILS = "";
    const { AlertModel, sendEmailFn, created, emails } = makeFakes();
    const engine = createAlertEngine({ AlertModel, sendEmailFn });

    engine.onEvent("rejected", { roomId: "room1", extra: { reason: "full" } });
    await new Promise((r) => setImmediate(r));

    assert.equal(created.length, 1);
    assert.equal(emails.length, 0);
  });

  test("onEvent never throws even if AlertModel.create rejects", async () => {
    const AlertModel = {
      create: async () => {
        throw new Error("db down");
      },
    };
    const engine = createAlertEngine({ AlertModel, sendEmailFn: async () => {} });
    assert.doesNotThrow(() => {
      engine.onEvent("rejected", { roomId: "room1", extra: { reason: "full" } });
    });
    await new Promise((r) => setImmediate(r));
  });

  test("cleanupRoom clears debounce/retry/connected state for that room", async () => {
    const { AlertModel, sendEmailFn, created } = makeFakes();
    let clock = 1_000_000;
    const engine = createAlertEngine({ AlertModel, sendEmailFn, now: () => clock, debounceMs: 600_000 });

    engine.onEvent("rejected", { roomId: "room1", extra: { reason: "full" } });
    await new Promise((r) => setImmediate(r));
    assert.equal(created.length, 1);

    engine.cleanupRoom("room1");
    // Debounce state was cleared, so an identical trigger right after raises again.
    engine.onEvent("rejected", { roomId: "room1", extra: { reason: "full" } });
    await new Promise((r) => setImmediate(r));
    assert.equal(created.length, 2);
  });
});
