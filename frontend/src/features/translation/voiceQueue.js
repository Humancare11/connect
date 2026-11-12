// The translated voice: one sentence at a time, never overlapping, and never falling far behind.
//
//   • Sentences are spoken in the order they arrive, strictly one after the other.
//   • At most 3 wait; if more arrive the OLDEST waiting one is dropped (a late sentence is worse than a missing one).
//   • Switching the voice off (or the echo breaker tripping) empties the queue and stops what is playing at once.
//   • A sentence that fails to play never blocks the ones behind it.
export const MAX_WAITING = 3;

export function createVoiceQueue({ speak, stop = () => {}, maxWaiting = MAX_WAITING, onStart = () => {}, onEnd = () => {}, onDrop = () => {}, onError = () => {} } = {}) {
  const waiting = [];
  let current = null;
  let enabled = true;
  let generation = 0; // bumped on clear(), so a sentence that finishes after being cancelled does not restart the pump

  async function pump() {
    if (current || !enabled) return;
    const item = waiting.shift();
    if (!item) return;
    current = item;
    const mine = generation;
    onStart(item);
    try {
      await speak(item);
    } catch (error) {
      onError(error, item);
    }
    if (current === item) current = null;
    onEnd(item);
    if (mine === generation) pump();
  }

  return {
    enqueue(item) {
      if (!enabled) return false;
      while (waiting.length >= maxWaiting) onDrop(waiting.shift());
      waiting.push(item);
      pump();
      return true;
    },
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled) this.clear();
    },
    clear() {
      generation += 1;
      waiting.length = 0;
      if (current) { try { stop(current); } catch { /* nothing more to do */ } }
    },
    isSpeaking: () => current !== null,
    waitingCount: () => waiting.length,
    isEnabled: () => enabled,
  };
}
