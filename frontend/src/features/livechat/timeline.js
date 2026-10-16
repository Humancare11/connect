// The order of the bubbles in the patient's chat window.
//
// Saved messages (from the server) keep the server's order. Messages the patient just sent and the server has not
// confirmed yet (status "sending" or "failed", the `outbox`) always come after them, in the order they were sent, so a
// failed bubble never jumps above a reply that arrived later. On a successful send the outbox entry is removed and the
// saved message takes its real position at the end of the saved list.
//
// An outbox entry is dropped when the server already holds a patient message with the same text that was saved after
// it was sent (the message arrived but its acknowledgement was late): showing both would repeat the message.
// `skewMs` allows for a patient clock that runs behind the server's.
export function buildTimeline(messages = [], outbox = [], { skewMs = 120_000 } = {}) {
  const items = messages.map((message) => ({ kind: "message", key: message.id, message }));
  const claimed = new Set();
  for (const entry of outbox) {
    const sentAt = Date.parse(entry.at) || 0;
    const saved = messages.find(
      (m) => m.sender === "patient" && !claimed.has(m.id) && m.text === entry.text && (Date.parse(m.at) || 0) >= sentAt - skewMs
    );
    if (saved) {
      claimed.add(saved.id);
      continue;
    }
    items.push({ kind: "outbox", key: entry.id, entry });
  }
  return items;
}
