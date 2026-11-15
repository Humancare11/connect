// The growing message box of the patient chat (and the greeter pill): one line to start with, growing as the patient
// types up to a cap, then scrolling inside. Pure helpers, so they are unit-tested without a browser.
export const COMPOSER_MAX_PX = 120; // the chat's message box
export const PILL_MAX_PX = 132; // the greeter pill (it has taller padding)

// Fits a <textarea> to its text: grows to `maxPx`, then keeps that height and scrolls inside. Returns the new height.
export function fitTextarea(el, maxPx) {
  if (!el) return 0;
  el.style.height = "auto";
  const wanted = el.scrollHeight;
  const height = Math.min(wanted, maxPx);
  el.style.height = `${height}px`;
  el.style.overflowY = wanted > maxPx ? "auto" : "hidden";
  return height;
}

// A phone or tablet: the on-screen keyboard has its own Enter ("return"), so there it adds a new line and the send
// button sends.
export const isCoarsePointer = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: coarse)").matches);

// Enter sends; Shift+Enter is a new line; Enter while an input method (IME) is composing, or on a touch device, is not
// a send.
export function enterSends({ key, shiftKey = false, isComposing = false }, coarse = false) {
  return key === "Enter" && !shiftKey && !isComposing && !coarse;
}
