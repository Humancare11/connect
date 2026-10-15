const express = require("express");
const mongoose = require("mongoose");
const EmailSettings = require("../models/EmailSettings");
const EmailTrackingOptOut = require("../models/EmailTrackingOptOut");
const { DEFAULT_DISCLOSURE } = EmailSettings;
const { disclosureExamples } = require("../services/email/disclosure");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { getTrackingState, clearSettingsCache } = require("../services/email/emailSettings");
const { normalizeAddressList, EmailValidationError } = require("../utils/emailValidation");

class ValidationError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const MAX_OPT_OUTS = 5000;
const EDITABLE = ["trackingEnabled", "disclosureEnabled", "disclosureText", "trackInternalRecipients", "trackClicks", "secureLinksEnabled", "secureLinkDays", "companyFooterWithSignature"];

// Single line, no control characters (the line is added to the footer of outgoing mail).
const cleanLine = (v) => String(v).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

const serializeOptOut = (o) => ({ id: String(o._id), address: o.address, note: o.note || "", createdAt: o.createdAt });

// Super Admin only. The Email module's open-tracking switches and the list of
// recipients who must never be tracked.
//
//   GET    /                   current state: the three gates + disclosure + opt-outs
//   PATCH  /                   { trackingEnabled?, disclosureEnabled?, disclosureText?, trackInternalRecipients? }
//   POST   /opt-outs           { address, note? }
//   DELETE /opt-outs/:id
//
// Turning tracking ON here does nothing by itself unless the server's env gate
// (EMAIL_TRACKING_ENABLED + PUBLIC_TRACKING_BASE_URL) is also set: the response says so.
function createRouter({ guard = [verifyAdminToken, superAdminOnly], getState = (opts) => getTrackingState(opts) } = {}) {
  const router = express.Router();
  router.use(...guard);

  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof ValidationError) return res.status(err.status).json({ msg: err.message, ...err.extra });
      if (err instanceof EmailValidationError) return res.status(400).json({ msg: err.message });
      if (err?.code === 11000) return res.status(409).json({ msg: "This address is already on the list.", code: "EXISTS" });
      console.error("[superadmin-email-settings]", req.method, req.path, err?.message || err);
      res.status(500).json({ msg: "Something went wrong. Please try again." });
    }
  };

  async function snapshot() {
    clearSettingsCache();
    const [s, optOuts] = await Promise.all([
      getState({ full: true }),
      EmailTrackingOptOut.find({}).sort({ address: 1 }).limit(MAX_OPT_OUTS).lean(),
    ]);
    return {
      tracking: {
        // The three gates, so the page can say exactly why tracking is (not) active.
        envEnabled: s.envEnabled,
        baseUrlOk: s.baseUrlOk,
        baseUrl: s.baseUrl,
        switchOn: s.switchOn,
        active: s.active,
        disclosureEnabled: s.disclosureEnabled,
        trackInternalRecipients: s.trackInternalRecipients,
        // "Also add the company footer when an admin signature is used" (default on).
        companyFooterWithSignature: s.companyFooterWithSignature,
        // Link click tracking: its own server gate and its own switch (needs open tracking active too).
        linksEnvEnabled: s.linksEnvEnabled,
        trackClicks: s.trackClicks,
        linksActive: s.linksActive,
        // Secure attachment links: own server gate, own switch, and a cap on the expiry.
        secureLinksEnvEnabled: s.secureLinksEnvEnabled,
        secureLinksEnabled: s.secureLinksEnabled,
        secureLinksActive: s.secureLinksActive,
        secureLinkDays: s.secureLinkDaysStored,
        secureLinkDaysEffective: s.secureLinkDays,
        secureLinkDaysMax: s.secureLinkDaysMax,
        // Custom line (replaces the automatic wording for every mail); empty = automatic.
        disclosureText: s.disclosureText,
        disclosureCustom: Boolean(String(s.disclosureText || "").trim()),
        defaultDisclosure: DEFAULT_DISCLOSURE,
        // What goes out for each combination while no custom line is set.
        disclosureExamples: disclosureExamples(),
        graceSeconds: s.graceSeconds,
      },
      optOuts: optOuts.map(serializeOptOut),
    };
  }

  router.get("/", handle(async (req, res) => res.json(await snapshot())));

  router.patch("/", handle(async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("Invalid request.");
    const unknown = Object.keys(body).filter((k) => !EDITABLE.includes(k));
    if (unknown.length) throw new ValidationError(`Cannot edit: ${unknown.join(", ")}.`);

    const patch = {};
    for (const key of ["trackingEnabled", "disclosureEnabled", "trackInternalRecipients", "trackClicks", "secureLinksEnabled", "companyFooterWithSignature"]) {
      if (body[key] === undefined) continue;
      if (typeof body[key] !== "boolean") throw new ValidationError(`${key} must be true or false.`);
      // The footer notice switch is stored under its own new name (see models/EmailSettings.js).
      patch[key === "disclosureEnabled" ? "footerNoticeEnabled" : key] = body[key];
    }
    if (body.secureLinkDays !== undefined) {
      const max = getState && (await getState({ full: true })).secureLinkDaysMax;
      const days = body.secureLinkDays;
      if (!Number.isInteger(days) || days < 1 || days > max) {
        throw new ValidationError(`Secure links can last between 1 and ${max} days.`);
      }
      patch.secureLinkDays = days;
    }
    if (body.disclosureText !== undefined) {
      if (typeof body.disclosureText !== "string") throw new ValidationError("The disclosure line must be text.");
      const text = cleanLine(body.disclosureText);
      if (text.length > 300) throw new ValidationError("The disclosure line must be 300 characters or fewer.");
      patch.disclosureText = text;
    }
    if (!Object.keys(patch).length) throw new ValidationError("Nothing to update.");

    const current = await EmailSettings.findOneAndUpdate({ key: "email" }, { $setOnInsert: { key: "email" } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
    // An empty custom line is fine: the automatic wording (see services/email/disclosure.js) is used.

    Object.assign(current, patch, { updatedBy: req.user.id });
    await current.save();
    res.json(await snapshot());
  }));

  router.post("/opt-outs", handle(async (req, res) => {
    if (typeof req.body?.address !== "string") throw new ValidationError("Enter an email address.");
    const list = normalizeAddressList(req.body.address, { label: "Address", required: true });
    if (list.length !== 1) throw new ValidationError("Add one address at a time.");
    const note = typeof req.body.note === "string" ? cleanLine(req.body.note).slice(0, 200) : "";
    if ((await EmailTrackingOptOut.estimatedDocumentCount()) >= MAX_OPT_OUTS) throw new ValidationError("The opt-out list is full.");
    await EmailTrackingOptOut.create({ address: list[0].address, note, createdBy: req.user.id });
    res.status(201).json(await snapshot());
  }));

  router.delete("/opt-outs/:id", handle(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ValidationError("Not found.", 404);
    const removed = await EmailTrackingOptOut.findByIdAndDelete(req.params.id);
    if (!removed) throw new ValidationError("Not found.", 404);
    res.json(await snapshot());
  }));

  return router;
}

module.exports = createRouter();
module.exports.create = createRouter;
