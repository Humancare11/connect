// Image signatures: small pure helpers (no React, no imports) so they can be tested with plain
// `node --test` (see signatureUtils.test.mjs).

// react-query key for GET /signatures (the compose boxes share it with the My signature page).
export const SIGNATURES_KEY = ["email", "signatures"];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // the server refuses more; checked here to answer faster
export const IMAGE_TYPES = ["image/png", "image/jpeg"];

// What the admin wrote: the whole box. (The signature is an image added by the server; nothing
// is ever inserted into the text.)
export function messageOf(text) {
  return String(text || "").trim();
}

// The state of the "Add my signature" box when a compose or reply box opens: on only when
// there is an image AND the admin keeps "Add to new mails automatically" on.
export function startsTicked(signature) {
  return Boolean(signature?.image) && signature.autoAdd !== false;
}

// Quick check of a chosen file before it is uploaded. → "" when fine, else the message to show.
export function imageFileProblem(file) {
  if (!file) return "Choose an image file.";
  if (!IMAGE_TYPES.includes(file.type)) return "Please choose a PNG or JPG image.";
  if (file.size > MAX_UPLOAD_BYTES) return "The image is larger than 5 MB. Choose a smaller file.";
  return "";
}
