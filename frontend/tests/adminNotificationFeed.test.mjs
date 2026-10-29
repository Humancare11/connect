// Behavioural tests for the combined admin notification feed and its links. These run the real
// modules in Node against a fake API client and fake timers (no DOM, no network, no browser).
// Run: node --test tests/adminNotificationFeed.test.mjs  (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import {
  createAdminNotificationFeed,
  normalizeDirect,
  normalizeGeneral,
  unreadTotal,
  timeAgo,
  POLL_MS,
} from "../src/pages/admin/adminNotificationFeed.js";
import { notificationLink, isSafeAdminPath, ticketTabFromQuery } from "../src/pages/admin/adminNotificationLinks.js";

const G = "/api/admin/notifications";
const D = "/api/direct-video-room/alerts";
const ID = (n) => String(n).padStart(24, "0");

const general = (n, extra = {}) => ({
  id: ID(n), type: "appointment_created", title: `Booking ${n}`, message: "msg", refType: "appointment",
  refId: ID(n), link: `/admin-dashboard/appointments/${ID(n)}`, createdAt: `2026-10-0${n}T10:00:00.000Z`, read: false, ...extra,
});
const direct = (n, extra = {}) => ({
  _id: `d${n}`, roomId: `room${n}`, type: "never_connected", message: "Both joined, never connected.",
  doctorName: "Roe", createdAt: `2026-10-0${n}T12:00:00.000Z`, readAt: null, ...extra,
});

// Fake axios-like client. `handlers` maps "METHOD path" -> value | function | Error; calls are recorded.
function makeApi(handlers) {
  const calls = [];
  const run = async (method, url) => {
    calls.push(`${method} ${url}`);
    const h = handlers[`${method} ${url}`] ?? handlers[`${method} ${url.split("?")[0]}`];
    if (h === undefined) throw new Error(`unexpected ${method} ${url}`);
    const v = typeof h === "function" ? await h() : h;
    if (v instanceof Error) throw v;
    return { data: v };
  };
  return { calls, get: (u) => run("GET", u), post: (u) => run("POST", u) };
}
const fail = () => new Error("boom");
const tick = () => new Promise((r) => setImmediate(r));
const settle = async () => { for (let i = 0; i < 5; i += 1) await tick(); };
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

function makeFeed(handlers) {
  const api = makeApi(handlers);
  const timers = { fns: [], cleared: [] };
  const feed = createAdminNotificationFeed({
    api,
    setIntervalFn: (fn, ms) => { timers.fns.push({ fn, ms }); return timers.fns.length; },
    clearIntervalFn: (id) => timers.cleared.push(id),
  });
  return { feed, api, timers };
}
const okHandlers = (over = {}) => ({
  [`GET ${G}/unread-count`]: { count: 2 },
  [`GET ${D}/unread-count`]: { count: 1 },
  [`GET ${G}`]: { notifications: [general(1), general(3, { read: true })] },
  [`GET ${D}`]: { alerts: [direct(2)] },
  ...over,
});

test("unread total is the sum of both sources; each event is counted once", async () => {
  const { feed } = makeFeed(okHandlers());
  feed.start();
  await settle();
  assert.equal(feed.getState().generalUnread, 2);
  assert.equal(feed.getState().directUnread, 1);
  assert.equal(unreadTotal(feed.getState()), 3);
  feed.stop();
});

test("opening the panel loads both lists, merged newest first with source-specific fields", async () => {
  const { feed } = makeFeed(okHandlers());
  feed.start();
  feed.setPanelOpen(true);
  assert.equal(feed.getState().status, "loading");
  await settle();
  const s = feed.getState();
  assert.equal(s.status, "ready");
  assert.deepEqual(s.items.map((i) => i.key), [`n:${ID(3)}`, "d:d2", `n:${ID(1)}`]);
  const [g3, d2] = s.items;
  assert.equal(g3.read, true);
  assert.equal(g3.link, `/admin-dashboard/appointments/${ID(3)}`);
  assert.equal(d2.title, "Never connected", "direct alert label kept");
  assert.equal(d2.message, "Both joined, never connected. — Dr. Roe");
  assert.equal(d2.link, "/admin-dashboard/direct-video-consultation/calls/room2", "View call route kept");
  assert.equal(d2.linkLabel, "View call →");
  feed.stop();
});

test("empty results are 'ready' with no items, distinct from an error", async () => {
  const { feed } = makeFeed(okHandlers({ [`GET ${G}`]: { notifications: [] }, [`GET ${D}`]: { alerts: [] } }));
  feed.start();
  feed.setPanelOpen(true);
  await settle();
  assert.deepEqual([feed.getState().status, feed.getState().items.length, feed.getState().partial], ["ready", 0, false]);
  feed.stop();
});

test("both sources failing is an error (not empty), and Retry recovers", async () => {
  let broken = true;
  const { feed } = makeFeed(okHandlers({
    [`GET ${G}`]: () => (broken ? fail() : { notifications: [general(1)] }),
    [`GET ${D}`]: () => (broken ? fail() : { alerts: [] }),
  }));
  feed.start();
  feed.setPanelOpen(true);
  await settle();
  assert.equal(feed.getState().status, "error");
  assert.equal(feed.getState().items.length, 0);
  broken = false;
  await feed.loadItems(); // what the Retry button calls
  assert.equal(feed.getState().status, "ready");
  assert.equal(feed.getState().items.length, 1);
  feed.stop();
});

test("one source failing still shows the other, flagged as partial", async () => {
  const { feed } = makeFeed(okHandlers({ [`GET ${D}`]: fail() }));
  feed.start();
  feed.setPanelOpen(true);
  await settle();
  const s = feed.getState();
  assert.equal(s.status, "ready");
  assert.equal(s.partial, true);
  assert.equal(s.items.length, 2);
  feed.stop();
});

test("failed count polls keep the last known counts instead of resetting to zero", async () => {
  let down = false;
  const { feed, timers } = makeFeed(okHandlers({
    [`GET ${G}/unread-count`]: () => (down ? fail() : { count: 4 }),
    [`GET ${D}/unread-count`]: () => (down ? fail() : { count: 1 }),
  }));
  feed.start();
  await settle();
  down = true;
  timers.fns[0].fn();
  await settle();
  assert.equal(unreadTotal(feed.getState()), 5);
  feed.stop();
});

test("marking a shared notification read updates item and count, and survives a refresh", async () => {
  const { feed, api } = makeFeed(okHandlers({
    [`POST ${G}/${ID(1)}/read`]: { notification: {} },
    [`GET ${G}/unread-count`]: { count: 0 },
  }));
  feed.start();
  feed.setPanelOpen(true);
  await settle();
  await feed.markRead(`n:${ID(1)}`);
  await settle();
  assert.ok(api.calls.includes(`POST ${G}/${ID(1)}/read`));
  assert.equal(feed.getState().items.find((i) => i.key === `n:${ID(1)}`).read, true);
  assert.equal(feed.getState().generalUnread, 0);
  assert.equal(feed.getState().markError, "");
  feed.stop();
});

test("a failed mark-read rolls back the item and count and shows an error", async () => {
  const { feed } = makeFeed(okHandlers({
    [`POST ${G}/${ID(1)}/read`]: fail(),
    [`GET ${G}/unread-count`]: { count: 2 },
  }));
  feed.start();
  feed.setPanelOpen(true);
  await settle();
  await feed.markRead(`n:${ID(1)}`);
  await settle();
  const s = feed.getState();
  assert.equal(s.items.find((i) => i.key === `n:${ID(1)}`).read, false);
  assert.equal(s.generalUnread, 2);
  assert.match(s.markError, /Couldn't mark it as read/);
  feed.stop();
});

test("direct-call alerts are marked through their own endpoint; failure rolls back", async () => {
  const { feed, api } = makeFeed(okHandlers({ [`POST ${D}/d2/read`]: fail() }));
  feed.start();
  feed.setPanelOpen(true);
  await settle();
  await feed.markRead("d:d2");
  await settle();
  assert.ok(api.calls.includes(`POST ${D}/d2/read`));
  assert.equal(feed.getState().items.find((i) => i.key === "d:d2").read, false);
  assert.equal(feed.getState().directUnread, 1);
  assert.ok(feed.getState().markError);
  feed.stop();
});

test("mark all as read uses the shared endpoint only and never touches direct-call alerts", async () => {
  let done = false;
  const { feed, api } = makeFeed(okHandlers({
    [`POST ${G}/read-all`]: () => { done = true; return { updated: 2 }; },
    [`GET ${G}/unread-count`]: () => ({ count: done ? 0 : 2 }),
  }));
  feed.start();
  feed.setPanelOpen(true);
  await settle();
  await feed.markAllRead();
  await settle();
  const s = feed.getState();
  assert.equal(s.generalUnread, 0);
  assert.ok(s.items.filter((i) => i.source === "general").every((i) => i.read));
  assert.equal(s.items.find((i) => i.key === "d:d2").read, false, "direct alert untouched");
  assert.ok(!api.calls.some((c) => c.startsWith(`POST ${D}`)));
  assert.equal(api.calls.filter((c) => c === `POST ${G}/read-all`).length, 1);
  feed.stop();
});

test("a failed mark-all rolls back exactly the previous read state", async () => {
  const { feed } = makeFeed(okHandlers({
    [`POST ${G}/read-all`]: fail(),
    [`GET ${G}/unread-count`]: { count: 2 },
  }));
  feed.start();
  feed.setPanelOpen(true);
  await settle();
  await feed.markAllRead();
  await settle();
  const s = feed.getState();
  assert.equal(s.generalUnread, 2);
  assert.equal(s.items.find((i) => i.key === `n:${ID(1)}`).read, false);
  assert.equal(s.items.find((i) => i.key === `n:${ID(3)}`).read, true, "already-read item stays read");
  assert.match(s.markError, /Couldn't mark all as read/);
  feed.stop();
});

test("a slow poll that started before a mark-read cannot overwrite the new count", async () => {
  const slow = deferred();
  let first = true;
  const { feed } = makeFeed(okHandlers({
    [`GET ${G}/unread-count`]: () => {
      if (first) { first = false; return slow.promise; } // initial poll hangs, then answers with the OLD count
      return { count: 1 };
    },
    [`POST ${G}/${ID(1)}/read`]: { notification: {} },
  }));
  feed.start();
  feed.setPanelOpen(true);
  await settle(); // list loaded; first count poll still pending
  await feed.markRead(`n:${ID(1)}`);
  await settle();
  assert.equal(feed.getState().generalUnread, 1);
  slow.resolve({ data: { count: 2 } }); // late, stale answer (the fake returns the value as data)
  await settle();
  assert.equal(feed.getState().generalUnread, 1, "stale response dropped");
  feed.stop();
});

test("polling: one interval at the existing 30s cadence, no overlapping count requests, cleaned up on stop", async () => {
  const hang = deferred();
  const { feed, api, timers } = makeFeed(okHandlers({ [`GET ${G}/unread-count`]: () => hang.promise }));
  feed.start();
  feed.start(); // double start (e.g. StrictMode) must not add a second timer
  assert.equal(timers.fns.length, 1);
  assert.equal(timers.fns[0].ms, 30_000);
  assert.equal(POLL_MS, 30_000);
  await settle();
  timers.fns[0].fn();
  timers.fns[0].fn();
  await settle();
  assert.equal(api.calls.filter((c) => c === `GET ${G}/unread-count`).length, 1, "no overlapping count requests");
  feed.stop();
  assert.deepEqual(timers.cleared, [1]);
  hang.resolve({ data: { count: 9 } });
  await settle();
  assert.equal(feed.getState().generalUnread, 0, "responses after stop are ignored");
});

test("while the panel is open a poll refreshes the list silently, and a failed refresh keeps the list", async () => {
  let down = false;
  const { feed, timers } = makeFeed(okHandlers({
    [`GET ${G}`]: () => (down ? fail() : { notifications: [general(1)] }),
    [`GET ${D}`]: () => (down ? fail() : { alerts: [] }),
  }));
  feed.start();
  feed.setPanelOpen(true);
  await settle();
  down = true;
  timers.fns[0].fn();
  assert.equal(feed.getState().status, "ready", "background refresh never flashes the loading state");
  await settle();
  assert.equal(feed.getState().status, "ready");
  assert.equal(feed.getState().items.length, 1);
  feed.stop();
});

test("timeAgo", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  assert.equal(timeAgo("2026-10-10T11:59:40Z", now), "just now");
  assert.equal(timeAgo("2026-10-10T11:15:00Z", now), "45m ago");
  assert.equal(timeAgo("2026-10-10T07:00:00Z", now), "5h ago");
  assert.equal(timeAgo("2026-10-07T12:00:00Z", now), "3d ago");
  assert.equal(timeAgo("not a date", now), "just now");
});

test("normalisers never expose extra fields", () => {
  const n = normalizeGeneral({ ...general(1), readBy: ["x"], dedupeKey: "k", email: "a@b.c" });
  assert.deepEqual(Object.keys(n).sort(), ["createdAt", "id", "key", "link", "linkLabel", "message", "read", "source", "title"]);
  assert.deepEqual(Object.keys(normalizeDirect(direct(1))).sort(), Object.keys(n).sort());
});

// ── navigation ────────────────────────────────────────────────────────────────

test("navigation for every supported notification type", () => {
  const id = ID(7);
  const cases = [
    [{ type: "appointment_created", refType: "appointment", refId: id, link: `/admin-dashboard/appointments/${id}` }, `/admin-dashboard/appointments/${id}`],
    [{ type: "doctor_registered", refType: "doctor", refId: ID(8), link: `/admin-dashboard/doctor-profile/${id}` }, `/admin-dashboard/doctor-profile/${id}`],
    [{ type: "doctor_enrollment_submitted", refType: "enrollment", refId: id, link: `/admin-dashboard/doctor-profile/${id}` }, `/admin-dashboard/doctor-profile/${id}`],
    [{ type: "partner_case_created", refType: "partner_case", refId: id, link: `/admin-dashboard/partner-cases/${id}` }, `/admin-dashboard/partner-cases/${id}`],
    [{ type: "support_ticket_created", refType: "user_ticket", refId: id, link: "/admin-dashboard/tickets" }, "/admin-dashboard/tickets?tab=patient"],
    [{ type: "support_ticket_created", refType: "ticket", refId: id, link: "/admin-dashboard/tickets" }, "/admin-dashboard/tickets?tab=doctor"],
    [{ type: "doctor_profile_updated", refType: "enrollment", refId: id, link: `/admin-dashboard/doctor-profile/${id}` }, `/admin-dashboard/doctor-profile/${id}`],
    [{ type: "doctor_profile_updated", refType: "enrollment", refId: id, link: "https://evil.example/x" }, `/admin-dashboard/doctor-profile/${id}`],
    [{ type: "doctor_account_deletion_requested", refType: "enrollment", refId: id, link: `/admin-dashboard/doctor-profile/${id}` }, `/admin-dashboard/doctor-profile/${id}`],
    [{ type: "doctor_account_deletion_requested", refType: "enrollment", refId: id, link: "https://evil.example/x" }, `/admin-dashboard/doctor-profile/${id}`],
    [{ type: "security_repeated_failed_logins", refType: null, refId: "", link: "/admin-dashboard/manage-users" }, "/admin-dashboard/manage-users"],
    [{ type: "security_critical_event", refType: "user", refId: id, link: "https://evil.example/x" }, "/admin-dashboard/manage-users"],
    [{ type: "partner_case_cancelled", refType: "partner_case", refId: id, link: `/admin-dashboard/partner-cases/${id}` }, `/admin-dashboard/partner-cases/${id}`],
    [{ type: "partner_case_message", refType: "partner_case", refId: id, link: "https://evil.example/x" }, `/admin-dashboard/partner-cases/${id}`],
    [{ type: "doctor_approved", refType: "enrollment", refId: id, link: `/admin-dashboard/doctor-profile/${id}` }, `/admin-dashboard/doctor-profile/${id}`],
    [{ type: "doctor_rejected", refType: "enrollment", refId: id, link: "https://evil.example/x" }, `/admin-dashboard/doctor-profile/${id}`],
    [{ type: "payment_needs_reconciliation", refType: null, refId: "pi_123", link: "/admin-dashboard/appointments" }, "/admin-dashboard/appointments"],
    [{ type: "payment_needs_reconciliation", refType: null, refId: "pi_123", link: "https://evil.example/x" }, "/admin-dashboard/appointments"],
    [{ type: "appointment_confirmed_by_doctor", refType: "appointment", refId: id, link: `/admin-dashboard/appointments/${id}` }, `/admin-dashboard/appointments/${id}`],
    [{ type: "appointment_completed_by_doctor", refType: "appointment", refId: id, link: "https://evil.example/x" }, `/admin-dashboard/appointments/${id}`],
    [{ type: "account_deletion_requested", refType: "user", refId: id, link: "/admin-dashboard/deletion-requests" }, "/admin-dashboard/deletion-requests"],
    [{ type: "account_deletion_requested", refType: "user", refId: id, link: "https://evil.example/x" }, "/admin-dashboard/deletion-requests"],
  ];
  for (const [input, expected] of cases) assert.equal(notificationLink(input), expected, input.type + input.refType);
});

test("fallback routes are used only when the stored link is missing, and never for doctor_registered", () => {
  const id = ID(9);
  assert.equal(notificationLink({ type: "appointment_created", refId: id }), `/admin-dashboard/appointments/${id}`);
  assert.equal(notificationLink({ type: "partner_case_created", refId: id }), `/admin-dashboard/partner-cases/${id}`);
  assert.equal(notificationLink({ type: "doctor_enrollment_submitted", refType: "enrollment", refId: id }), `/admin-dashboard/doctor-profile/${id}`);
  assert.equal(notificationLink({ type: "doctor_registered", refType: "doctor", refId: id }), null, "Doctor id is not an Enrollment id");
  assert.equal(notificationLink({ type: "appointment_created", refId: "not-an-id" }), null);
  assert.equal(notificationLink({ type: "something_new", refId: id }), null);
});

test("unsafe or external links are rejected, falling back or dropping", () => {
  for (const bad of ["https://evil.example/x", "//evil.example", "javascript:alert(1)", "/other/page", "/admin-dashboard/../x",
    "/admin-dashboard//x", "/admin-dashboard/tickets?tab=doctor", "/admin-dashboard/a b", `/admin-dashboard/${"a".repeat(400)}`, "", null, undefined, 42]) {
    assert.equal(isSafeAdminPath(bad), false, String(bad));
    assert.equal(notificationLink({ type: "unknown", link: bad }), null);
  }
  const id = ID(5);
  assert.equal(notificationLink({ type: "appointment_created", refId: id, link: "https://evil.example" }), `/admin-dashboard/appointments/${id}`);
  assert.equal(isSafeAdminPath("/admin-dashboard"), true);
  assert.equal(isSafeAdminPath("/admin-dashboard/direct-video-consultation/calls/room2"), true);
});

test("ticket tab query: only patient or doctor are honoured", () => {
  assert.equal(ticketTabFromQuery("doctor"), "doctor");
  assert.equal(ticketTabFromQuery("patient"), "patient");
  for (const bad of [null, undefined, "", "admin", "DOCTOR", "doctor ", "__proto__", "1"]) assert.equal(ticketTabFromQuery(bad), null);
});
