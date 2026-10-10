// Support hours and agent availability, in one place so handoff, the Team page and the top-bar switch agree.
//
// settings.supportHours = { timezone, alwaysOn?, days: [{ day, enabled, open, close }] } with HH:MM strings.
//   - alwaysOn: open 24/7, the days are ignored.
//   - open < close: one shift inside the day (08:00-22:00).
//   - open > close: the shift crosses midnight and ends the next morning (17:30-07:30). After midnight the
//     shift belongs to the day it STARTED on, so that day's "enabled" toggle decides.
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const ZONE_LABELS = {
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Phoenix": "MST",
  "America/Los_Angeles": "PT",
  "America/Anchorage": "AKT",
  "Pacific/Honolulu": "HST",
  "Asia/Kolkata": "IST",
};

function zoneLabel(zone, date = new Date()) {
  if (ZONE_LABELS[zone]) return ZONE_LABELS[zone];
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value || zone || "";
  } catch {
    return zone || "";
  }
}

// { day: index into DAY_NAMES, hm: "HH:MM" } in the support time zone, or null when the zone is unusable.
function localParts(timezone, date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/New_York",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    const day = DAY_NAMES.indexOf(get("weekday").toLowerCase());
    if (day < 0) return null;
    return { day, hm: `${get("hour")}:${get("minute")}` };
  } catch {
    return null;
  }
}

const crossesMidnight = (d) => Boolean(d) && d.open > d.close;

function isWithinSupportHours(settings, date = new Date()) {
  const hours = settings?.supportHours;
  if (hours?.alwaysOn === true) return true;
  if (!hours?.days?.length) return true;
  const now = localParts(hours.timezone, date);
  if (!now) return true;
  const byDay = (index) => hours.days.find((d) => d.day === DAY_NAMES[index]);

  const today = byDay(now.day);
  if (today?.enabled) {
    if (crossesMidnight(today)) {
      if (now.hm >= today.open) return true; // the evening part of a shift that ends tomorrow
    } else if (now.hm >= today.open && now.hm < today.close) {
      return true;
    }
  }
  // The morning part of last night's shift: it started yesterday, so yesterday's toggle applies.
  const yesterday = byDay((now.day + 6) % 7);
  if (yesterday?.enabled && crossesMidnight(yesterday) && now.hm < yesterday.close) return true;
  return false;
}

// "08:00-22:00 ET", "17:30-07:30 IST (closes next day)", "24/7" or "closed today" - today's window in the support zone.
function hoursLabel(settings, date = new Date()) {
  const hours = settings?.supportHours;
  if (hours?.alwaysOn === true) return "24/7";
  const now = localParts(hours?.timezone, date);
  if (!now || !hours?.days?.length) return "";
  const today = hours.days.find((d) => d.day === DAY_NAMES[now.day]);
  if (!today?.enabled) return "closed today";
  const zone = zoneLabel(hours.timezone, date);
  return `${today.open}–${today.close} ${zone}${crossesMidnight(today) ? " (closes next day)" : ""}`.trim();
}

// Whether hours decide availability at all: not under "No agent is online (support hours are ignored)".
const hoursApply = (settings) => settings?.offlineRule !== "no_agent";

// One agent: the Online switch, a live admin socket and (when the rule uses hours) the support hours.
//   state: { online, connected } from the agent registry
//   -> { status: "online" | "offline", reason: "online" | "switch_off" | "no_connection" | "outside_hours", hours }
// `hours` is only filled for outside_hours, and never when the rule ignores hours.
function agentStatus({ settings, state = {}, date = new Date() }) {
  if (!state.online) return { status: "offline", reason: "switch_off", hours: "" };
  if (!state.connected) return { status: "offline", reason: "no_connection", hours: "" };
  if (hoursApply(settings) && !isWithinSupportHours(settings, date)) {
    return { status: "offline", reason: "outside_hours", hours: hoursLabel(settings, date) };
  }
  return { status: "online", reason: "online", hours: "" };
}

module.exports = { DAY_NAMES, isWithinSupportHours, hoursLabel, hoursApply, agentStatus, crossesMidnight, zoneLabel };
