// The ONLY place in this feature that writes to the browser console. Used for the "[tr-diag]" lines that show why a subtitle did or did not
// appear. Every line carries codes and numbers (language codes, counts, outcome names), NEVER a sentence, a translation or a name.
export function defaultLog(...args) {
  try { if (typeof console !== "undefined") console.info(...args); } catch { /* no console: nothing to show */ }
}
