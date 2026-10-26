// "Booking source": where a booking came from, kept on each booking (Appointment and CategoryConsultation share it).
//
// Two halves, and they are trusted differently:
//   - platform + appVersion are decided on the SERVER from the request headers (utils/clientInfo.js), never from the body.
//   - sourceType / sourceName / clickedOn* / pagePath / referrer / utm are sent by the client. They are display text for the
//     admin list only, so every one is checked against a fixed list or trimmed, stripped and length-capped. A value that is
//     not in the list is stored as "unknown"; nothing here ever rejects a booking.
//
// This file has the schema fragment, the cleaning rules and the display labels. It does not touch the database or the
// request lifecycle, and buildBookingSource() never throws. Old bookings have no `source` and read as "Unknown" /
// "Not recorded": no backfill.
const { detectRegistrationClient } = require("./clientInfo");

// What kind of page (or site-wide button) started the booking.
const SOURCE_TYPES = [
  "condition",
  "service",
  "speciality",
  "category",
  "doctor_profile",
  "blog",
  "home",
  "symptom",
  "find_doctor",
  "patient_dashboard",
  "my_appointments",
  "page",
  "header",
  "footer",
  "direct",
  "unknown",
];
// Site-wide buttons: the type is where the button is, so the page the patient was ON is kept next to it.
const BUTTON_TYPES = ["header", "footer", "home"];
// The page a button was clicked on can be any page type except another button position.
const CLICKED_ON_TYPES = SOURCE_TYPES.filter((t) => t !== "header" && t !== "footer");

// "app" = a native app whose OS could not be told (Flutter sends the same user-agent on both).
const PLATFORMS = ["web", "android", "ios", "app"];

const MAX_NAME_LENGTH = 120;
const MAX_PATH_LENGTH = 200;
const MAX_REFERRER_LENGTH = 200;
const MAX_UTM_LENGTH = 100;
const MAX_VERSION_LENGTH = 32;

// Spread into a schema definition, next to bookingEntryFields(). Old bookings have no `source` in the database and read as
// these empty defaults. (Mongoose's `immutable` option does not cover a whole nested object or a $set of it, so the
// write-once rule is enforced by protectBookingSource() below instead.)
const bookingSourceFields = () => ({
  source: {
    platform: { type: String, enum: [...PLATFORMS, ""], default: "" },
    appVersion: { type: String, default: "", maxlength: MAX_VERSION_LENGTH },
    sourceType: { type: String, enum: [...SOURCE_TYPES, ""], default: "" },
    sourceName: { type: String, default: "", maxlength: MAX_NAME_LENGTH },
    clickedOnType: { type: String, enum: [...CLICKED_ON_TYPES, ""], default: "" },
    clickedOnName: { type: String, default: "", maxlength: MAX_NAME_LENGTH },
    pagePath: { type: String, default: "", maxlength: MAX_PATH_LENGTH },
    referrer: { type: String, default: "", maxlength: MAX_REFERRER_LENGTH },
    utm: {
      source: { type: String, default: "", maxlength: MAX_UTM_LENGTH },
      medium: { type: String, default: "", maxlength: MAX_UTM_LENGTH },
      campaign: { type: String, default: "", maxlength: MAX_UTM_LENGTH },
    },
    capturedAt: { type: Date, default: null },
  },
});

// ── Write once ─────────────────────────────────────────────────────────────────

const isSourcePath = (key) => key === "source" || key.startsWith("source.");

// Removes every write to `source` from an update document ($set, $unset, ... and a plain top-level key). Mutates in place.
function stripSourceFromUpdate(update) {
  if (!update || typeof update !== "object" || Array.isArray(update)) return update;
  for (const key of Object.keys(update)) {
    if (key.startsWith("$")) {
      const operator = update[key];
      if (operator && typeof operator === "object") {
        for (const field of Object.keys(operator)) if (isSourcePath(field)) delete operator[field];
        if (Object.keys(operator).length === 0) delete update[key];
      }
    } else if (isSourcePath(key)) {
      delete update[key];
    }
  }
  return update;
}

// Schema plugin for the two booking models: the source is set when the booking is created and never again. A later save
// that changed it is not written; an update query that mentions it has that part removed. Nothing throws, so an admin
// action that happens to touch the booking still works. (Not covered: bulkWrite and replaceOne, which no code uses on
// bookings.)
function protectBookingSource(schema) {
  schema.pre("save", function protectSourceOnSave() {
    if (this.isNew) return;
    for (const path of this.modifiedPaths()) if (isSourcePath(path)) this.unmarkModified(path);
  });
  schema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function protectSourceOnUpdate() {
    stripSourceFromUpdate(this.getUpdate());
  });
}

// ── Cleaning ───────────────────────────────────────────────────────────────────

// Control characters, line/paragraph separators, zero-width and bidi-override characters (they can make a name read
// differently from what is stored).
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;

// Display text: strip invisible characters, squeeze whitespace, trim, cap. Never throws; non-strings become "".
function cleanText(value, max = MAX_NAME_LENGTH) {
  if (typeof value !== "string") return "";
  return value.replace(INVISIBLE, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
}

function cleanType(value, allowed) {
  if (typeof value !== "string") return "";
  const t = value.trim().toLowerCase();
  if (!t) return "";
  return allowed.includes(t) ? t : "unknown";
}

// A site path only: must start with a single "/", query string and fragment dropped.
function cleanPath(value) {
  const text = cleanText(value, 500);
  if (!text.startsWith("/") || text.startsWith("//")) return "";
  return text.split(/[?#]/)[0].slice(0, MAX_PATH_LENGTH);
}

// Host + path of a referring page, nothing else (no scheme, credentials, query or fragment: those can carry tokens).
function cleanReferrer(value) {
  const text = cleanText(value, 1000);
  if (!text) return "";
  try {
    // The website sends "host/path" already; a full URL is accepted too.
    const url = new URL(/^[a-z0-9.-]+(\/|$)/i.test(text) ? `https://${text}` : text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    const path = url.pathname === "/" ? "" : url.pathname;
    return (url.hostname.toLowerCase() + path).slice(0, MAX_REFERRER_LENGTH);
  } catch {
    return "";
  }
}

// utm_* values: a short, plain campaign tag.
const cleanUtmValue = (value) => cleanText(value, MAX_UTM_LENGTH).replace(/[^\w .+()\-:/@|]/g, "");

// ── Building the stored value ──────────────────────────────────────────────────

// Platform + app version from the request headers (the server's own view of the client).
function detectPlatform(req) {
  const client = detectRegistrationClient(req);
  if (client.registrationPlatform === "web") return { platform: "web", appVersion: "" };
  if (client.registrationPlatform === "app") {
    const sub = client.registrationSubType;
    return { platform: sub === "android" || sub === "ios" ? sub : "app", appVersion: client.registrationAppVersion || "" };
  }
  return { platform: "", appVersion: "" };
}

// req: the express request. raw: whatever the client sent as `source` in the body (anything at all; may be absent).
// Returns the whole `source` value for the create call. Never throws.
function buildBookingSource(req, raw, now = new Date()) {
  try {
    const { platform, appVersion } = detectPlatform(req);
    const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const utm = body.utm && typeof body.utm === "object" ? body.utm : {};

    const sourceType = cleanType(body.sourceType, SOURCE_TYPES);
    // The page a button was clicked on only means something for a site-wide button.
    const keepClickedOn = BUTTON_TYPES.includes(sourceType);

    return {
      platform,
      appVersion,
      sourceType,
      sourceName: cleanText(body.sourceName),
      clickedOnType: keepClickedOn ? cleanType(body.clickedOnType, CLICKED_ON_TYPES) : "",
      clickedOnName: keepClickedOn ? cleanText(body.clickedOnName) : "",
      pagePath: cleanPath(body.pagePath),
      // Referrer and campaign are a website notion; an app has neither.
      referrer: platform === "web" ? cleanReferrer(body.referrer) : "",
      utm:
        platform === "web"
          ? { source: cleanUtmValue(utm.source), medium: cleanUtmValue(utm.medium), campaign: cleanUtmValue(utm.campaign) }
          : { source: "", medium: "", campaign: "" },
      capturedAt: now,
    };
  } catch (err) {
    console.warn("[bookingSource] build failed:", err.message);
    return emptyBookingSource(now);
  }
}

const emptyBookingSource = (now = new Date()) => ({
  platform: "",
  appVersion: "",
  sourceType: "",
  sourceName: "",
  clickedOnType: "",
  clickedOnName: "",
  pagePath: "",
  referrer: "",
  utm: { source: "", medium: "", campaign: "" },
  capturedAt: now,
});

// For the create endpoints: the source of a booking made by THIS request (the patient's own checkout request; the client
// is read from this request's headers, so it must never be called from a webhook or job). Call it once, before any
// transaction callback that may run twice. Synchronous and cheap; on any failure the booking is saved with an empty source.
function bookingSourceFor(req) {
  try {
    return buildBookingSource(req, req?.body?.source);
  } catch {
    return emptyBookingSource();
  }
}

// ── Display ────────────────────────────────────────────────────────────────────

const TYPE_LABELS = {
  condition: "Condition",
  service: "Service",
  speciality: "Speciality",
  category: "Category",
  doctor_profile: "Doctor profile",
  blog: "Blog",
  home: "Home",
  symptom: "Symptom",
  find_doctor: "Find a doctor",
  patient_dashboard: "Patient dashboard",
  my_appointments: "My appointments",
  page: "Page",
  header: "Header",
  footer: "Footer",
  direct: "Direct",
  unknown: "Unknown",
};

// "Web" | "App" | "Unknown". Android and iOS are both "App".
function platformGroup(source) {
  const p = source?.platform;
  if (p === "web") return "Web";
  if (p === "android" || p === "ios" || p === "app") return "App";
  return "Unknown";
}

// Tooltip for the label: "Android · v1.0.0+16", "iOS", "Browser", "Booked before source tracking started".
function platformDetail(source) {
  switch (source?.platform) {
    case "web":
      return "Website";
    case "android":
    case "ios": {
      const os = source.platform === "ios" ? "iOS" : "Android";
      return source.appVersion ? `${os} · v${source.appVersion}` : os;
    }
    case "app":
      return source.appVersion ? `App · v${source.appVersion}` : "App";
    default:
      return "Booked before source tracking started";
  }
}

const hasPage = (source) => Boolean(source && source.sourceType && source.sourceType !== "unknown");

// The "Source page" cell: { type, name, clickedOn } or null for "Not recorded".
// A header/footer/home button reads "Header: Book Appointment", with "on Service: Fit to fly" underneath.
function sourcePageLabel(source) {
  if (!hasPage(source)) return null;
  const type = TYPE_LABELS[source.sourceType] || "Unknown";
  let clickedOn = "";
  if (source.clickedOnType && source.clickedOnType !== "unknown") {
    const onType = TYPE_LABELS[source.clickedOnType] || "";
    const onName = source.clickedOnName || "";
    clickedOn = source.clickedOnType === "home" && !onName ? "Home page" : [onType, onName].filter(Boolean).join(": ");
  } else if (source.clickedOnType === "unknown" && source.clickedOnName) {
    // A page with no type of its own (About us, Contact, a legal page): just its name.
    clickedOn = source.clickedOnName;
  }
  return { type, name: source.sourceName || "", clickedOn };
}

// One line of searchable text for the Source page column (type and name; the clicked-on page too).
function sourceSearchText(source) {
  const label = sourcePageLabel(source);
  return label ? [label.type, label.name, label.clickedOn].filter(Boolean).join(" ") : "";
}

// ── Admin list: the row fields, the Source filter, search and the CSV columns ──

const SOURCE_FILTERS = ["web", "app", "unknown"];

// The three fields every admin row carries for a booking's `source` (undefined for an old booking).
//   sourceGroup  "Web" | "App" | "Unknown"   (android, ios and app all count as App)
//   sourceDetail the tooltip: "Android · v1.0.0+16", "Website", "Booked before source tracking started"
//   sourcePage   { type, name, clickedOn } or null for "Not recorded"
function sourceRowFields(source) {
  return { sourceGroup: platformGroup(source), sourceDetail: platformDetail(source), sourcePage: sourcePageLabel(source) };
}

// The Source filter as a query on the stored platform. An old booking has no platform, so it is "unknown".
function sourceFilterMatch(group) {
  if (group === "web") return { "source.platform": "web" };
  if (group === "app") return { "source.platform": { $in: ["android", "ios", "app"] } };
  if (group === "unknown") return { "source.platform": { $in: [null, ""] } };
  return null;
}

// Search clauses for the Source page column: matches the type (by its label, "Doctor profile"), the name and the
// clicked-on page. `rx` is the already-escaped search expression.
function sourceSearchClauses(rx) {
  const typesMatching = (list) => list.filter((t) => rx.test(TYPE_LABELS[t]) || rx.test(t.replace(/_/g, " ")));
  const types = typesMatching(SOURCE_TYPES);
  return [
    ...(types.length ? [{ "source.sourceType": { $in: types } }, { "source.clickedOnType": { $in: types } }] : []),
    { "source.sourceName": rx },
    { "source.clickedOnName": rx },
  ];
}

// A spreadsheet treats a cell that starts with = + - @ (or a tab / carriage return) as a formula. Display text came from a
// visitor's browser, so such a cell is made plain text with a leading apostrophe.
const csvSafe = (value) => {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
};

// The five columns the Appointment entries CSV gets. Values are formula-safe; quoting is the exporter's job.
function sourceCsvColumns(source) {
  const label = sourcePageLabel(source);
  const platform = {
    web: "Web", android: "Android", ios: "iOS", app: "App",
  }[source?.platform] || "";
  const version = source?.appVersion ? ` (v${source.appVersion})` : "";
  return {
    Source: platformGroup(source),
    Platform: csvSafe(platform + (platform && platform !== "Web" ? version : "")),
    "Source page type": csvSafe(label?.type || ""),
    "Source page name": csvSafe(label?.name || ""),
    "Clicked on": csvSafe(label?.clickedOn || ""),
  };
}

module.exports = {
  SOURCE_FILTERS,
  sourceRowFields,
  sourceFilterMatch,
  sourceSearchClauses,
  csvSafe,
  sourceCsvColumns,
  SOURCE_TYPES,
  BUTTON_TYPES,
  CLICKED_ON_TYPES,
  PLATFORMS,
  MAX_NAME_LENGTH,
  bookingSourceFields,
  protectBookingSource,
  stripSourceFromUpdate,
  cleanText,
  cleanType,
  cleanPath,
  cleanReferrer,
  cleanUtmValue,
  detectPlatform,
  buildBookingSource,
  emptyBookingSource,
  bookingSourceFor,
  platformGroup,
  platformDetail,
  sourcePageLabel,
  sourceSearchText,
};
