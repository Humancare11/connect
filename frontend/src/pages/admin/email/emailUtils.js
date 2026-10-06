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

// ── open tracking ──
// A tracking image can only show that a mail app (or a scanner) loaded it, never that
// a person read the mail. So the wording is hedged: "Likely opened", "No signal yet",
// "Only automatic loads seen". Deliberately NOT "Seen" or "Read".
export const TRACKING_FILTER_OPTIONS = [
  ["opened", "Likely opened"],
  ["pending", "No signal yet"],
  ["automated", "Automatic loads only"],
  ["unavailable", "Not tracked"],
];

const TRACKING_REASONS = {
  tracking_off: "Open tracking was not switched on when this mail was sent.",
  mail_off: "Tracking was switched off for this mail.",
  internal_recipients: "Sent to a company address, so opens by our own team could not be told apart from the recipient's.",
  apple_recipient: "Apple Mail hides real opens (Mail Privacy Protection), so tracking is not reliable for this recipient.",
  opted_out: "A recipient has opted out of tracking.",
  outside_dashboard: "Sent from Gmail, outside the dashboard.",
};

// → { kind: "opened" | "pending" | "automated" | "na", text, detail } or null (nothing to show: failed / received mail).
export function trackingInfo(t) {
  if (!t) return null;
  if (t.status === "opened") {
    const first = t.firstOpenedAt ? `First loaded ${fmtFull(t.firstOpenedAt)}` : "Loaded";
    const last = t.lastOpenedAt && t.lastOpenedAt !== t.firstOpenedAt ? `, last ${fmtFull(t.lastOpenedAt)}` : "";
    return {
      kind: "opened",
      text: t.multiRecipient ? "Likely opened (by at least one recipient)" : "Likely opened",
      detail: `${first}${last}. ${t.openCount} load${t.openCount === 1 ? "" : "s"}. Based on the recipient's mail app loading an image, so it isn't proof the mail was read.`,
    };
  }
  if (t.status === "pending") {
    return { kind: "pending", text: "No signal yet", detail: "Nothing has loaded the image. The mail may be unopened, or their mail app blocks images." };
  }
  if (t.reason === "automated_only") {
    return {
      kind: "automated",
      text: "Only automatic loads seen",
      detail: "A security scanner, preview or mail-app prefetch loaded the image. The recipient may or may not have opened it.",
    };
  }
  return { kind: "na", text: "Not tracked", detail: TRACKING_REASONS[t.reason] || "Open tracking is not available for this mail." };
}

// Refresh interval for counts/lists: new mail is synced every 30–60 s on the server.
export const POLL_MS = 45_000;
