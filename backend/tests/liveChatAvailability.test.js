// Support hours (including shifts that cross midnight and "always on") and agent availability with its reason.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { startChatServer, AGENT_A, SUPER_S } = require("./helpers/liveChatServer");
const { isWithinSupportHours, hoursLabel, agentStatus, DAY_NAMES } = require("../services/liveChat/supportHours");

const oid = (id) => new mongoose.Types.ObjectId(id);
const allDays = (patch = {}) => DAY_NAMES.map((day) => ({ day, enabled: true, open: "08:00", close: "22:00", ...patch }));
const hours = (timezone, days, extra = {}) => ({ supportHours: { timezone, days, ...extra } });
// IST = UTC+05:30. 2026-10-12 is a Monday. EDT = UTC-04:00 until the first Sunday of November.
const ist = (iso) => new Date(`${iso}+05:30`);
const et = (iso) => new Date(`${iso}-04:00`);

describe("support hours: one shift inside a day", () => {
  const ny = hours("America/New_York", allDays());

  test("inside and outside, in the support time zone", () => {
    assert.equal(isWithinSupportHours(ny, et("2026-10-12T09:00:00")), true);
    assert.equal(isWithinSupportHours(ny, et("2026-10-12T05:27:00")), false, "05:27 ET is before 08:00");
    assert.equal(isWithinSupportHours(ny, et("2026-10-12T22:00:00")), false, "the closing minute is outside");
    // 17:30 IST is 08:00 EDT, the opening minute
    assert.equal(isWithinSupportHours(ny, ist("2026-10-12T17:30:00")), true);
    assert.equal(isWithinSupportHours(ny, ist("2026-10-12T17:29:00")), false);
  });

  test("no days configured means open", () => {
    assert.equal(isWithinSupportHours({ supportHours: { timezone: "America/New_York", days: [] } }, new Date()), true);
  });
});

describe("support hours: a shift that crosses midnight (17:30-07:30 Asia/Kolkata)", () => {
  const overnight = hours("Asia/Kolkata", allDays({ open: "17:30", close: "07:30" }));

  test("inside before midnight", () => {
    assert.equal(isWithinSupportHours(overnight, ist("2026-10-12T20:00:00")), true);
    assert.equal(isWithinSupportHours(overnight, ist("2026-10-12T17:30:00")), true, "opening minute");
  });

  test("inside after midnight (the shift of the day before)", () => {
    assert.equal(isWithinSupportHours(overnight, ist("2026-10-13T02:00:00")), true);
    assert.equal(isWithinSupportHours(overnight, ist("2026-10-13T07:29:00")), true, "last minute");
  });

  test("outside in the gap", () => {
    assert.equal(isWithinSupportHours(overnight, ist("2026-10-13T07:30:00")), false, "the closing minute is outside");
    assert.equal(isWithinSupportHours(overnight, ist("2026-10-13T12:00:00")), false);
    assert.equal(isWithinSupportHours(overnight, ist("2026-10-13T17:29:00")), false);
  });

  test("the day boundary: after midnight the toggle of the day the shift STARTED on applies", () => {
    // Monday off, every other day on.
    const days = allDays({ open: "17:30", close: "07:30" }).map((d) => (d.day === "monday" ? { ...d, enabled: false } : d));
    const cfg = hours("Asia/Kolkata", days);
    assert.equal(isWithinSupportHours(cfg, ist("2026-10-12T20:00:00")), false, "Monday evening: Monday is off");
    assert.equal(isWithinSupportHours(cfg, ist("2026-10-13T02:00:00")), false, "Tuesday 02:00 belongs to Monday's shift, which is off");
    assert.equal(isWithinSupportHours(cfg, ist("2026-10-13T20:00:00")), true, "Tuesday evening: Tuesday is on");
    assert.equal(isWithinSupportHours(cfg, ist("2026-10-14T02:00:00")), true, "Wednesday 02:00 belongs to Tuesday's shift, which is on");
    assert.equal(isWithinSupportHours(cfg, ist("2026-10-12T02:00:00")), true, "Monday 02:00 belongs to Sunday's shift, which is on, although Monday is off");
  });

  test("the label says it closes the next day", () => {
    assert.equal(hoursLabel(overnight, ist("2026-10-13T12:00:00")), "17:30–07:30 IST (closes next day)");
  });
});

describe("support hours: always on", () => {
  test("open at any time, whatever the days say", () => {
    const cfg = hours("America/New_York", allDays({ enabled: false }), { alwaysOn: true });
    assert.equal(isWithinSupportHours(cfg, et("2026-10-12T03:00:00")), true);
    assert.equal(hoursLabel(cfg), "24/7");
  });
});

describe("agent status and its reason", () => {
  const cfg = { ...hours("America/New_York", allDays()), offlineRule: "hours_or_no_agent" };
  const inside = et("2026-10-12T10:00:00");
  const outside = et("2026-10-12T05:27:00");

  test("switch on + inside hours = online", () => {
    assert.deepEqual(agentStatus({ settings: cfg, state: { online: true, connected: true }, date: inside }), { status: "online", reason: "online", hours: "" });
  });

  test("switch on + outside hours = offline with reason outside_hours and the hours", () => {
    assert.deepEqual(agentStatus({ settings: cfg, state: { online: true, connected: true }, date: outside }), {
      status: "offline",
      reason: "outside_hours",
      hours: "08:00–22:00 ET",
    });
  });

  test("switch off = offline, whatever the hours", () => {
    for (const date of [inside, outside]) {
      const status = agentStatus({ settings: cfg, state: { online: false, connected: true }, date });
      assert.deepEqual([status.status, status.reason], ["offline", "switch_off"]);
    }
  });

  test("switch on but no admin socket = offline, no_connection", () => {
    assert.equal(agentStatus({ settings: cfg, state: { online: true, connected: false }, date: inside }).reason, "no_connection");
  });

  test("under the 'no agent online' rule hours are never mentioned and do not matter", () => {
    const status = agentStatus({ settings: { ...cfg, offlineRule: "no_agent" }, state: { online: true, connected: true }, date: outside });
    assert.deepEqual(status, { status: "online", reason: "online", hours: "" });
  });
});

describe("live chat: availability on the Team page and in settings", () => {
  let lc;
  let sam;
  const rest = (...args) => lc.rest(...args);
  const A = { user: AGENT_A };
  const S = { user: SUPER_S, role: "superadmin" };
  const save = (patch) => rest("PUT", "/settings", { ...S, body: patch });
  const current = async () => (await rest("GET", "/settings", S)).body.settings;
  const agentRow = async () => (await rest("GET", "/team", A)).body.agents.find((a) => a.name === "Sam Carter");
  const closedDays = async () => (await current()).supportHours.days.map((d) => ({ ...d, enabled: false }));
  const openDays = async () => (await current()).supportHours.days.map((d) => ({ ...d, enabled: true, open: "00:00", close: "23:59" }));

  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000" } });
    await mongoose.connection.db.collection("users").insertMany([
      { _id: oid(AGENT_A), name: "Sam Carter", role: "admin", email: "sam@example.com" },
      { _id: oid(SUPER_S), name: "Super Admin", role: "superadmin", email: "super@example.com" },
    ]);
    lc.identities["tok-sam"] = { id: AGENT_A, role: "admin" };
    sam = await lc.agent("tok-sam");
    await sam.snapshotPromise;
  });
  after(async () => {
    sam.close();
    await lc.close();
  });

  test("switch on + inside hours = online", async () => {
    await lc.call(sam, "agent:status", { online: true });
    const base = (await current()).supportHours;
    await save({ supportHours: { ...base, alwaysOn: false, days: await openDays() } });
    const row = await agentRow();
    assert.deepEqual([row.status, row.reason], ["online", "online"]);
  });

  test("switch on + outside hours = offline, reason outside_hours, with the hours label; the top bar says the same", async () => {
    const base = (await current()).supportHours;
    await save({ supportHours: { ...base, alwaysOn: false, days: await closedDays() } });
    const row = await agentRow();
    assert.deepEqual([row.status, row.reason], ["offline", "outside_hours"]);
    assert.equal(row.hours, "closed today");
    const reply = await lc.call(sam, "agent:status:get");
    assert.deepEqual([reply.ok, reply.online, reply.reason, reply.hours], [true, true, "outside_hours", "closed today"]);
  });

  test("switch off = offline, reason switch_off", async () => {
    await lc.call(sam, "agent:status", { online: false });
    const row = await agentRow();
    assert.deepEqual([row.status, row.reason], ["offline", "switch_off"]);
    await lc.call(sam, "agent:status", { online: true });
  });

  test("'always on' makes the agent online outside the day hours", async () => {
    const base = (await current()).supportHours;
    await save({ supportHours: { ...base, alwaysOn: true, days: await closedDays() } });
    assert.equal((await agentRow()).reason, "online");
    assert.equal((await current()).supportHours.alwaysOn, true);
  });

  test("under the 'no agent is online' rule the Team page never mentions hours", async () => {
    const base = (await current()).supportHours;
    await save({ offlineRule: "no_agent", supportHours: { ...base, alwaysOn: false, days: await closedDays() } });
    const row = await agentRow();
    assert.deepEqual([row.status, row.reason, row.hours], ["online", "online", ""]);
    await save({ offlineRule: "hours_or_no_agent" });
  });

  test("settings accept a close earlier than the open (next day) but not open equal to close", async () => {
    const base = (await current()).supportHours;
    const overnight = base.days.map((d) => ({ ...d, enabled: true, open: "17:30", close: "07:30" }));
    const ok = await save({ supportHours: { ...base, timezone: "Asia/Kolkata", alwaysOn: false, days: overnight } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const saved = (await current()).supportHours;
    assert.deepEqual([saved.timezone, saved.days[0].open, saved.days[0].close], ["Asia/Kolkata", "17:30", "07:30"]);

    const bad = await save({ supportHours: { ...base, days: base.days.map((d) => ({ ...d, enabled: true, open: "09:00", close: "09:00" })) } });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.errors["supportHours.monday"]);
  });
});
