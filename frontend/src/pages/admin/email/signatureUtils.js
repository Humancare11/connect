// Signatures in the compose and reply boxes. Pure functions (no React, no imports) so
// they can be tested with plain `node --test` (see signatureUtils.test.mjs).
//
// The signature lives INSIDE the editable text, below a "-- " line:
//
//   Dear client,
//   Thank you.
//
//   --
//   Anita Rao
//   Care Coordinator
//
// The server receives that text as the body. The company footer is added by the server.

// react-query key for GET /signatures (the compose boxes share it with the My signature page).
export const SIGNATURES_KEY = ["email", "signatures"];

// The tip shown next to the image upload (exact wording).
export const IMAGE_TIP =
  "Best result: a simple 600px-wide banner (logo, name, title). Put phone, email, website and address as text lines below — they stay readable and clickable.";

export const NO_SIGNATURE = "none";
export const DIVIDER = "-- ";

// Index where the LAST divider line ("-- " or "--") starts, or -1.
export function dividerIndex(text) {
  const re = /^-- ?$/gm;
  let at = -1;
  let m;
  while ((m = re.exec(String(text || ""))) !== null) at = m.index;
  return at;
}

// What is in the box → { message, signature, hasDivider }. The signature is whatever follows
// the last divider line.
export function splitCompose(text) {
  const value = String(text || "").replace(/\r\n/g, "\n");
  const at = dividerIndex(value);
  if (at < 0) return { message: value, signature: "", hasDivider: false };
  const after = value.indexOf("\n", at);
  return {
    message: value.slice(0, at).replace(/\s+$/, ""),
    signature: after < 0 ? "" : value.slice(after + 1).trim(),
    hasDivider: true,
  };
}

// Message + divider + signature, as inserted into the box. An empty message leaves two blank
// lines on top, so the cursor sits above the signature.
export function joinCompose(message, signature) {
  const sig = String(signature || "").trim();
  const msg = String(message || "").replace(/\s+$/, "");
  return sig ? `${msg}\n\n${DIVIDER}\n${sig}` : msg;
}

// The part the admin actually wrote. "Message is required" and "discard this mail?" look at
// this, so an inserted signature alone is not a message.
export function messageOf(text) {
  return splitCompose(text).message.trim();
}

// The dropdown changed. `previous` is the signature text that was inserted before ("" for
// none), `next` the new one ("" for No signature).
// → { text, needsConfirm }
//   If the admin edited the inserted signature, nothing is replaced and needsConfirm is true
//   so the screen can ask first; call `forceSwap` after they agree.
export function swapSignature(text, previous, next) {
  const { message, signature, hasDivider } = splitCompose(text);
  const untouched = !hasDivider || signature === "" || signature.trim() === String(previous || "").trim();
  if (!untouched) return { text, needsConfirm: true };
  return { text: joinCompose(message, next), needsConfirm: false };
}

export function forceSwap(text, next) {
  return joinCompose(splitCompose(text).message, next);
}

// The signature to start with: the one chosen for this mailbox, else the general default,
// else none. `data` is the GET /signatures response. → signature object | null
export function pickSignature(data, mailboxId) {
  const list = data?.signatures || [];
  const forMailbox = data?.mailboxDefaults?.[mailboxId];
  return list.find((s) => s.id === forMailbox) || list.find((s) => s.isDefault) || null;
}

// How a mail will end, for the "My signature" page. Mirrors the server (composeText):
// message, admin signature, company footer, one divider.
export function previewMail({ message, signature, companyFooter, withCompanyFooter }) {
  const msg = String(message || "").replace(/\s+$/, "");
  const sig = String(signature || "").trim();
  const footer = String(companyFooter || "").trim();
  if (sig) return [joinCompose(msg, sig), withCompanyFooter ? footer : ""].filter(Boolean).join("\n\n");
  return footer ? `${msg}\n\n${DIVIDER}\n${footer}` : msg;
}
