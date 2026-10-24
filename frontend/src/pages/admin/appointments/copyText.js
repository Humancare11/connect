// Copies text to the clipboard, with a fallback for browsers or pages where the clipboard API is not available or is
// refused (an insecure page, a blocked permission). Plain function with injected pieces so it can be tested with
// `node --test` (see copyText.test.mjs).
//   "copied"   the text is on the clipboard
//   "selected" it could not be copied; `select()` highlighted the text instead, so Ctrl+C / Cmd+C works
export async function copyText(text, { clipboard = globalThis.navigator?.clipboard, select, execCopy } = {}) {
  try {
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return "copied";
    }
  } catch {
    // refused: fall through to the fallback
  }
  try {
    select?.();
    if (execCopy?.()) return "copied";
  } catch {
    // the old copy command is not available either
  }
  return "selected";
}
