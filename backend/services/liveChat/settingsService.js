// Live Chat settings (AI agent settings page): validation, saving, the change log, canned replies and the display
// names agents show to patients.
//
// Rules:
//   - only a superadmin changes settings, canned replies or other people's display names; an agent changes their own
//     display name (the routes enforce the role, this service enforces the own-name rule);
//   - a save is validated as a whole (nothing is saved if anything is wrong) and applies at once: the settings cache
//     of the module is cleared, no restart;
//   - every save is logged: who, when, which setting, before and after.
const mongoose = require("mongoose");
const { DAYS } = require("./settingsDefaults");
const sitePages = require("./sitePages").createSitePages();

class SettingsError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const AI_MODES = ["ai_first", "ai_when_no_agent", "ai_off"];
const OFFLINE_RULES = ["hours_or_no_agent", "no_agent", "hours"];
const ICONS = ["stethoscope", "pill", "clipboard", "document", "dots", "agent"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const KEY_RE = /^[a-z0-9_]{1,30}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/g;
// Single-line text: control characters and runs of whitespace become one space.
const clean = (value) => String(value ?? "").replace(CONTROL_RE, " ").replace(/\s+/g, " ").trim();
// Multi-line text (greeting, facts, replies): line breaks are kept, other control characters are removed.
// eslint-disable-next-line no-control-regex
const cleanBlock = (value) => String(value ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\t/g, " ").trim();
const oid = (id) => new mongoose.Types.ObjectId(String(id));

function validZone(zone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return typeof zone === "string" && zone.length > 0;
  } catch {
    return false;
  }
}

// Checks the fields that are present in `patch` (a partial save is fine). Returns { values, errors }.
function validateSettings(patch) {
  const errors = {};
  const values = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(patch, key);
  const text = (key, { min = 0, max, label, block = false }) => {
    if (!has(key)) return;
    const value = (block ? cleanBlock : clean)(patch[key]);
    if (value.length < min || value.length > max) errors[key] = `${label} must be ${min ? `${min}-` : "up to "}${max} characters.`;
    else values[key] = value;
  };
  const number = (value, { min, max, integer = false }) =>
    typeof value === "number" && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));

  if (has("aiMode")) {
    if (AI_MODES.includes(patch.aiMode)) values.aiMode = patch.aiMode;
    else errors.aiMode = "Choose when the AI should answer.";
  }
  if (has("offlineRule")) {
    if (OFFLINE_RULES.includes(patch.offlineRule)) values.offlineRule = patch.offlineRule;
    else errors.offlineRule = "Choose when the team counts as offline.";
  }
  text("agentDisplayName", { min: 1, max: 40, label: "The default agent name" });
  text("greeting", { min: 1, max: 600, label: "The greeting", block: true });
  text("businessFacts", { max: 8000, label: "Business facts", block: true });
  text("unavailableMessage", { min: 1, max: 600, label: "The AI-unavailable message", block: true });
  text("offlineMessage", { min: 1, max: 600, label: "The offline message", block: true });

  if (has("dailySpendCapUsd")) {
    if (number(patch.dailySpendCapUsd, { min: 0, max: 1000 })) values.dailySpendCapUsd = Math.round(patch.dailySpendCapUsd * 100) / 100;
    else errors.dailySpendCapUsd = "The daily AI cap must be a number from 0 to 1000 (USD).";
  }

  if (has("supportHours")) {
    const hours = patch.supportHours;
    const days = Array.isArray(hours?.days) ? hours.days : null;
    if (!hours || !validZone(hours.timezone)) errors["supportHours.timezone"] = "Choose a valid time zone.";
    if (!days || days.length !== 7 || new Set(days.map((d) => d?.day)).size !== 7 || !days.every((d) => DAYS.includes(d?.day))) {
      errors["supportHours.days"] = "Give the hours for all seven days.";
    } else {
      for (const d of days) {
        if (typeof d.enabled !== "boolean" || !TIME_RE.test(String(d.open)) || !TIME_RE.test(String(d.close))) {
          errors[`supportHours.${d.day}`] = "Use HH:MM times.";
        } else if (d.enabled && d.open >= d.close) {
          errors[`supportHours.${d.day}`] = "Closing time must be after opening time.";
        }
      }
    }
    if (!Object.keys(errors).some((k) => k.startsWith("supportHours"))) {
      values.supportHours = {
        timezone: hours.timezone,
        days: DAYS.map((name) => {
          const d = days.find((x) => x.day === name);
          return { day: name, enabled: d.enabled, open: d.open, close: d.close };
        }),
      };
    }
  }

  if (has("handoffRules")) {
    const r = patch.handoffRules || {};
    const out = {};
    for (const key of ["onPatientRequest", "onUnsure", "onAccountOrPayment", "onTechnicalIssue", "onComplaint"]) {
      // The two newer toggles may be missing from an older client: they stay on.
      if (r[key] === undefined && (key === "onTechnicalIssue" || key === "onComplaint")) out[key] = true;
      else if (typeof r[key] !== "boolean") errors[`handoffRules.${key}`] = "Must be on or off.";
      else out[key] = r[key];
    }
    if (!number(r.maxAiRepliesPerChat, { min: 1, max: 200, integer: true })) errors["handoffRules.maxAiRepliesPerChat"] = "AI replies per chat: a whole number from 1 to 200.";
    else out.maxAiRepliesPerChat = r.maxAiRepliesPerChat;
    if (!number(r.agentOfflineGraceSeconds, { min: 0, max: 3600 })) errors["handoffRules.agentOfflineGraceSeconds"] = "Grace period: 0 to 3600 seconds.";
    else out.agentOfflineGraceSeconds = r.agentOfflineGraceSeconds;
    if (!Object.keys(errors).some((k) => k.startsWith("handoffRules"))) values.handoffRules = out;
  }

  if (has("quickOptions")) {
    const options = patch.quickOptions;
    if (!Array.isArray(options) || options.length < 1 || options.length > 8) {
      errors.quickOptions = "Have 1 to 8 quick options.";
    } else {
      const keys = new Set();
      const out = [];
      options.forEach((o, i) => {
        const key = clean(o?.key);
        const label = clean(o?.label);
        const reply = cleanBlock(o?.reply);
        const icon = ICONS.includes(o?.icon) ? o.icon : null;
        const link = clean(o?.link);
        if (!KEY_RE.test(key) || keys.has(key)) errors[`quickOptions.${i}.key`] = "Each option needs a short unique key (letters, digits, underscore).";
        else if (label.length < 1 || label.length > 80) errors[`quickOptions.${i}.label`] = "The label must be 1-80 characters.";
        else if (!icon) errors[`quickOptions.${i}.icon`] = "Choose an icon.";
        else if (key !== "live" && (reply.length < 1 || reply.length > 1200)) errors[`quickOptions.${i}.reply`] = "The reply must be 1-1200 characters.";
        else if (link && !sitePages.has(link)) errors[`quickOptions.${i}.link`] = "Choose a page from the list.";
        else out.push({ key, label, icon, reply: key === "live" ? "" : reply, link: key === "live" ? "" : link });
        keys.add(key);
      });
      if (!Object.keys(errors).some((k) => k.startsWith("quickOptions"))) values.quickOptions = out;
    }
  }

  if (has("prices")) {
    const prices = patch.prices;
    if (!Array.isArray(prices) || prices.length > 30) errors.prices = "Up to 30 prices.";
    else {
      const out = [];
      prices.forEach((p, i) => {
        const name = clean(p?.name);
        if (name.length < 1 || name.length > 60) errors[`prices.${i}.name`] = "The service name must be 1-60 characters.";
        else if (!number(p?.price, { min: 0, max: 100000 })) errors[`prices.${i}.price`] = "The price must be a number from 0 to 100000.";
        else out.push({ name, price: Math.round(p.price * 100) / 100 });
      });
      if (!Object.keys(errors).some((k) => k.startsWith("prices"))) values.prices = out;
    }
  }
  return { values, errors };
}

const short = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return text.length > 400 ? `${text.slice(0, 400)}…(${text.length} characters)` : text;
};

// Per-setting changes between the saved settings and the new values (nested settings are listed field by field).
function diffSettings(current, values) {
  const changes = [];
  const push = (field, before, after) => {
    if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) changes.push({ field, before: short(before ?? ""), after: short(after ?? "") });
  };
  for (const [key, next] of Object.entries(values)) {
    const prev = current[key];
    if (key === "supportHours") {
      push("supportHours.timezone", prev?.timezone, next.timezone);
      for (const d of next.days) {
        const was = (prev?.days || []).find((x) => x.day === d.day);
        push(`supportHours.${d.day}`, was ? { enabled: was.enabled, open: was.open, close: was.close } : null, { enabled: d.enabled, open: d.open, close: d.close });
      }
    } else if (key === "handoffRules") {
      for (const [rule, value] of Object.entries(next)) push(`handoffRules.${rule}`, prev?.[rule], value);
    } else {
      push(key, prev, next);
    }
  }
  return changes;
}

function createSettingsService({ models, invalidateSettings = () => {}, now = () => Date.now() }) {
  const { LcSettings, LcSettingsAudit, LcCannedReply, LcAgentProfile } = models;

  async function currentSettings() {
    const doc = await LcSettings.getSettings();
    return doc.toObject();
  }

  // The log says WHO by name: the session carries only an id, so look the name up.
  async function nameOf(actor) {
    if (actor.name) return actor.name;
    try {
      const user = await require("../../models/User").findById(actor.id).select("name").lean();
      return user?.name || "";
    } catch {
      return "";
    }
  }

  async function logChange(actor, changes) {
    if (!changes.length) return;
    await LcSettingsAudit.create({ actorId: oid(actor.id), actorName: await nameOf(actor), actorRole: actor.role || "", changes });
  }

  async function get() {
    return currentSettings();
  }

  async function update(actor, patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new SettingsError(400, "invalid_settings", { errors: { form: "Nothing to save." } });
    const { values, errors } = validateSettings(patch);
    if (Object.keys(errors).length) throw new SettingsError(400, "invalid_settings", { errors });
    const current = await currentSettings();
    const changes = diffSettings(current, values);
    if (!changes.length) return { ok: true, changed: 0, settings: current };
    const saved = await LcSettings.findOneAndUpdate({ key: "default" }, { $set: { ...values, updatedBy: oid(actor.id) } }, { returnDocument: "after" });
    await logChange(actor, changes);
    invalidateSettings(); // applies at once, without a restart
    return { ok: true, changed: changes.length, settings: saved.toObject() };
  }

  async function audit(limit = 50) {
    const rows = await LcSettingsAudit.find().sort({ createdAt: -1 }).limit(Math.min(Math.max(Number(limit) || 50, 1), 200)).lean();
    return rows.map((r) => ({
      id: String(r._id),
      at: r.createdAt,
      actor: { id: r.actorId ? String(r.actorId) : null, name: r.actorName, role: r.actorRole },
      changes: r.changes,
    }));
  }

  // ── Canned replies ───────────────────────────────────────────────────────────

  function cannedFields(body, { partial = false } = {}) {
    const errors = {};
    const out = {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body || {}, k);
    if (!partial || has("title")) {
      const title = clean(body?.title);
      if (title.length < 1 || title.length > 80) errors.title = "The title must be 1-80 characters.";
      else out.title = title;
    }
    if (!partial || has("text")) {
      const textValue = cleanBlock(body?.text);
      if (textValue.length < 1 || textValue.length > 1000) errors.text = "The reply must be 1-1000 characters.";
      else out.text = textValue;
    }
    if (has("order")) {
      if (Number.isInteger(body.order) && body.order >= 0 && body.order <= 1000) out.order = body.order;
      else errors.order = "The order must be a whole number from 0 to 1000.";
    }
    if (has("active")) {
      if (typeof body.active === "boolean") out.active = body.active;
      else errors.active = "Active must be on or off.";
    }
    if (Object.keys(errors).length) throw new SettingsError(400, "invalid_canned_reply", { errors });
    return out;
  }

  async function listCanned() {
    const rows = await LcCannedReply.find().sort({ order: 1, createdAt: 1 }).lean();
    return rows.map((r) => ({ id: String(r._id), title: r.title, text: r.text, order: r.order, active: r.active }));
  }

  async function createCanned(actor, body) {
    const fields = cannedFields(body);
    if (fields.order === undefined) fields.order = (await LcCannedReply.countDocuments()) + 1;
    const doc = await LcCannedReply.create({ ...fields, createdBy: oid(actor.id) });
    await logChange(actor, [{ field: "cannedReply.added", before: "", after: short(fields.title) }]);
    return { ok: true, reply: { id: String(doc._id), title: doc.title, text: doc.text, order: doc.order, active: doc.active } };
  }

  async function findCanned(id) {
    if (!mongoose.isValidObjectId(id)) throw new SettingsError(404, "not_found");
    const doc = await LcCannedReply.findById(id);
    if (!doc) throw new SettingsError(404, "not_found");
    return doc;
  }

  async function updateCanned(actor, id, body) {
    const doc = await findCanned(id);
    const fields = cannedFields(body, { partial: true });
    const changes = [];
    for (const [key, value] of Object.entries(fields)) {
      if (doc[key] !== value) changes.push({ field: `cannedReply.${doc.title}.${key}`, before: short(doc[key]), after: short(value) });
    }
    Object.assign(doc, fields);
    await doc.save();
    await logChange(actor, changes);
    return { ok: true, reply: { id: String(doc._id), title: doc.title, text: doc.text, order: doc.order, active: doc.active } };
  }

  async function deleteCanned(actor, id) {
    const doc = await findCanned(id);
    await doc.deleteOne();
    await logChange(actor, [{ field: "cannedReply.deleted", before: short(doc.title), after: "" }]);
    return { ok: true };
  }

  // ── Display names ────────────────────────────────────────────────────────────

  // The name patients see. An agent changes their own; a superadmin changes anyone's.
  async function setDisplayName(actor, userId, rawName) {
    if (!mongoose.isValidObjectId(userId)) throw new SettingsError(404, "not_found");
    if (String(userId) !== String(actor.id) && actor.role !== "superadmin") throw new SettingsError(403, "own_name_only");
    const name = clean(rawName);
    if (name.length < 1 || name.length > 40) throw new SettingsError(400, "invalid_name", { errors: { displayName: "The name must be 1-40 characters." } });
    const User = require("../../models/User");
    const user = await User.findById(userId).select("name role").lean();
    if (!user || !["admin", "superadmin"].includes(user.role)) throw new SettingsError(404, "not_found");
    const before = await LcAgentProfile.findOne({ userId }).select("displayName").lean();
    await LcAgentProfile.findOneAndUpdate({ userId }, { $set: { displayName: name }, $setOnInsert: { online: false } }, { upsert: true });
    if ((before?.displayName || "") !== name) {
      await logChange(actor, [{ field: `agentDisplayName.${user.name || userId}`, before: before?.displayName || "", after: name }]);
    }
    return { ok: true, displayName: name };
  }

  return { get, update, audit, listCanned, createCanned, updateCanned, deleteCanned, setDisplayName, now };
}

module.exports = { createSettingsService, SettingsError, validateSettings, diffSettings, AI_MODES, OFFLINE_RULES, ICONS };
