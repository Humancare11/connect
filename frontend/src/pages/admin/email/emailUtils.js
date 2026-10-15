import { createContext, useContext } from "react";

// ── routes ──
export const EMAIL_BASE = "/admin-dashboard/email";

export const FOLDERS = [
  { id: "inbox", label: "Received" },
  { id: "sent", label: "Sent" },
  { id: "spam", label: "Spam" },
  { id: "all", label: "All mail" },
];
export const FOLDER_IDS = FOLDERS.map((f) => f.id);

// The selected Mail ID travels in the URL as ?mb=<id> ("all" = every mail ID); no
// ?mb= means the first active mail ID. Folder/mail links carry it along.
export const withMb = (path, mb, extra = "") => {
  const params = new URLSearchParams(extra);
  if (mb) params.set("mb", mb);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

export const folderPath = (folder, mb, extra) => withMb(`${EMAIL_BASE}/${folder}`, mb, extra);

export const messagePath = (id, mb) => withMb(`${EMAIL_BASE}/mail/${id}`, mb);

// ── shared state for the module (compose window, toasts, counts) ──
export const EmailShellContext = createContext(null);
export const useEmailShell = () => useContext(EmailShellContext);

// ── people ──
const AVATAR_COLORS = ["#2f6fd0", "#b2457e", "#7a5ac8", "#c0711a", "#0d7a6f", "#b4372f", "#5b6bc0", "#2e7d32"];

export function hashColor(key) {
  let h = 0;
  for (const ch of String(key || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name) {
  const letters = String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || "?";
}

export const firstName = (name) => String(name || "").split(/\s+/)[0] || "Someone";

export const roleLabel = (role) => (role === "superadmin" ? "Super Admin" : role === "admin" ? "Admin" : "");

// "Anita Joshi" or, for mail without a name, the address.
export const personLabel = (p) => (p?.name && p.name.trim()) || p?.address || "Unknown";

// Mail sent from the Gmail website (not through the dashboard) has no admin behind it.
export const OUTSIDE_LABEL = "Gmail";
export const OUTSIDE_NOTE = "Sent from the Gmail website, outside the dashboard";

// Recipients as one short label: "Acme Support" or "Acme Support +2".
export const recipientsLabel = (list = []) => (list.length ? `${personLabel(list[0])}${list.length > 1 ? ` +${list.length - 1}` : ""}` : "");

// ── dates (all in the admin's own timezone) ──
const sameDay = (a, b) => a.toDateString() === b.toDateString();

export function fmtTime(value) {
  const d = new Date(value);
  return sameDay(d, new Date())
    ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const fmtFull = (value) =>
  new Date(value).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// The server filters by an exact start date, so presets are resolved here.
export function dateFromPreset(preset, now = new Date()) {
  if (preset === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (preset === "7d") return new Date(now.getTime() - 7 * 864e5).toISOString();
  if (preset === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return undefined;
}

// ── files ──
export const fmtSize = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

export function extClass(name) {
  const e = String(name).split(".").pop().toLowerCase();
  if (e === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(e)) return "img";
  if (["doc", "docx"].includes(e)) return "doc";
  if (["xls", "xlsx", "csv"].includes(e)) return "xls";
  return "oth";
}

// Mirrors the server's limits and allow-list so people get instant feedback;
// the server remains the authority.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 18 * 1024 * 1024;
export const MAX_FILES = 10;
export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "pdf", "txt", "csv", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip"];
export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

// Returns { files, error } after adding `incoming` to `current`.
export function addFiles(current, incoming) {
  const next = [...current];
  for (const file of incoming) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) return { files: current, error: `"${file.name}": this file type is not allowed.` };
    if (file.size > MAX_FILE_BYTES) return { files: current, error: `"${file.name}" is larger than 10 MB.` };
    next.push(file);
  }
  if (next.length > MAX_FILES) return { files: current, error: `You can attach up to ${MAX_FILES} files.` };
  if (next.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) return { files: current, error: "Attachments are over 18 MB in total." };
  return { files: next, error: "" };
}

export const EMAIL_RE = /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/;

export const newRequestId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

// ── read status ──
// One combined status per sent mail, the strongest signal wins (the server decides, see
// backend readStatus.js): Replied > Downloaded > Clicked > Read receipt > Opened.
// A tracking image only shows that a mail app (or a scanner) loaded it, never that a
// person read the mail, so "Opened" is explained in the detail text, and the last three
// states stay separate so a mail we cannot track never reads as "Not opened".
const READ_LABELS = {
  replied: "Replied",
  downloaded: "Downloaded",
  clicked: "Clicked",
  receipt: "Read receipt",
  opened: "Opened",
  opened_apple: "Opened (Apple — may be automatic)",
  pending: "Not opened yet",
  automated: "Only automatic loads seen",
  unavailable: "Tracking unavailable",
};

export const TRACKING_FILTER_OPTIONS = Object.entries(READ_LABELS);

// What each status means and where it can be wrong. Shown on the mail page; the same text
// is in docs/email-read-status.md. Strongest signal first.
export const READ_STATUS_HELP = [
  ["replied", "The client answered in the same conversation. The strongest sign. It says nothing about whether other recipients read it."],
  ["downloaded", "Someone used a secure download link. A security scanner is ignored, but one that looks like a normal browser from an unknown address can still count."],
  ["clicked", "Someone used a link in the mail. Scanners that open every link at delivery are filtered, but a scanner we do not know can still count."],
  ["receipt", "The recipient's mail app confirmed the mail was displayed. Very few mail apps ever send this, and the recipient can decline."],
  ["opened", "The recipient's mail app loaded the tracking image. Not proof the mail was read: a preview, a scanner or an image-loading setting can do it."],
  ["opened_apple", "Apple Mail loads images by itself on the recipient's behalf. It may not mean the mail was opened. Never shown as a plain Opened."],
  ["pending", "Nothing has loaded the image. The mail may be unopened, or the recipient's mail app blocks images (common in Outlook and many company mailboxes)."],
  ["automated", "Only security scanners, previews or prefetch loaded the image. The recipient may or may not have opened it."],
  ["unavailable", "Tracking was not on for this mail (switched off, opted out, sent from Gmail, or older mail), so nothing can be said."],
].map(([key, text]) => ({ key, label: READ_LABELS[key], text }));

const TRACKING_REASONS = {
  tracking_off: "Open tracking was not switched on when this mail was sent.",
  mail_off: "Tracking was switched off for this mail.",
  internal_recipients: "Sent to a company address while “Track mail to company addresses” was switched off.",
  opted_out: "A recipient has opted out of tracking.",
  outside_dashboard: "Sent from Gmail, outside the dashboard.",
};

export const INTERNAL_NOTE = "Includes our own staff. An open may be a colleague, not the client.";

// Shown in the compose and reply forms: company addresses are tracked, but cannot be
// told apart from the client. "" when there is nothing to say.
export function internalCaveat(addresses, tracking) {
  if (!tracking?.available || tracking.trackInternal === false) return "";
  const domain = `@${String(tracking.companyDomain || "").toLowerCase()}`;
  if (domain === "@") return "";
  const found = addresses.some((a) => String(a || "").trim().toLowerCase().replace(/>$/, "").endsWith(domain));
  return found ? INTERNAL_NOTE : "";
}

const times = (s) => {
  const n = s.count > 1 ? `${s.count}× · ` : "";
  const last = s.last && s.last !== s.first ? `, last ${fmtFull(s.last)}` : "";
  return `${n}${s.first ? `first ${fmtFull(s.first)}` : "recorded"}${last}`;
};

// Every signal that was seen, strongest first: [{ label, text }]. Empty when there is none.
function signalRows(sig = {}) {
  const rows = [];
  if (sig.replied) rows.push({ label: "Replied", text: sig.replied.at ? fmtFull(sig.replied.at) : "The recipient replied" });
  if (sig.downloaded) rows.push({ label: "Downloaded", text: times(sig.downloaded) });
  if (sig.clicked) rows.push({ label: "Clicked", text: times(sig.clicked) });
  if (sig.receipt) {
    const when = sig.receipt.at ? fmtFull(sig.receipt.at) : "Received";
    rows.push({ label: "Read receipt", text: sig.receipt.by ? `${when} · ${sig.receipt.by}` : when });
  }
  if (sig.opened) rows.push({ label: "Opened", text: times(sig.opened) });
  if (sig.openedApple) rows.push({ label: "Opened (Apple)", text: times(sig.openedApple) });
  return rows;
}

// → { kind, text, detail, rows } or null (nothing to show: failed / received mail).
//   kind  = the combined read status (replied | downloaded | clicked | receipt | opened |
//           opened_apple | pending | automated), or "na" when mail was not tracked.
export function trackingInfo(t) {
  if (!t) return null;
  const rows = signalRows(t.signals);
  // Asked for, nothing came back: say so, because most mail apps never send one.
  if (t.receiptRequested && !t.signals?.receipt) {
    rows.push({ label: "Read receipt", text: "Requested, none received (most mail apps never send one)" });
  }
  const status = t.readStatus || "unavailable";
  const who = t.multiRecipient ? " We cannot tell which recipient did it." : "";
  const staff = t.includesInternal ? " One recipient is a company address, so this may be a colleague rather than the client." : "";

  const DETAIL = {
    replied: "The recipient replied to this mail.",
    downloaded: `A recipient used a download link.${who}`,
    clicked: `A recipient used a link in the mail.${who}`,
    receipt: "The recipient's mail app confirmed the mail was displayed.",
    opened: `The recipient's mail app loaded the tracking image, so it isn't proof the mail was read.${who}${staff}`,
    opened_apple:
      "Apple Mail loads images automatically on the recipient's behalf (Mail Privacy Protection), so this may not mean the mail was opened.",
    pending: "Nothing has loaded the image. The mail may be unopened, or their mail app blocks images.",
    automated: "A security scanner, preview or mail-app prefetch loaded the image. The recipient may or may not have opened it.",
  };

  if (status === "unavailable") {
    return { kind: "na", text: READ_LABELS.unavailable, detail: TRACKING_REASONS[t.reason] || "Tracking is not available for this mail.", rows };
  }
  let text = READ_LABELS[status];
  if (status === "opened") {
    if (t.multiRecipient) text = "Opened (by at least one recipient)";
    if (t.includesInternal) text = "Opened (may include our own staff)";
  }
  return { kind: status, text, detail: DETAIL[status], rows };
}


// Refresh interval for counts/lists: new mail is synced every 30–60 s on the server.
export const POLL_MS = 45_000;
