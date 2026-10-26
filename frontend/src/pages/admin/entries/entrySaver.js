import { isStale, rowKey, saveErrorText } from "./entriesFormat.js";

// Saves one field at a time, and one save at a time PER ROW. Every save carries the row's version, and a save bumps it, so two
// saves of the same row in flight at once (typing a fee, then tabbing straight to the status) would make the second one fail
// as "stale". The queue waits for the first, then reads the row again for its new version.
//
//   send(kind, id, { field, value, version })  -> the HTTP call (returns the response; throws on an error status)
//   getRow(key)                                -> the newest copy of the row the page has, or undefined
//   onRow(item)                                -> called with every fresh copy of a row the server sends back
// save(row, field, value) always resolves: { ok: true, item, noop } or { ok: false, msg, stale }.
export function createSaveQueue({ send, getRow, onRow }) {
  const tails = new Map();

  const run = async (row, field, value) => {
    const key = rowKey(row);
    const current = getRow(key) || row;
    try {
      const res = await send(current.kind, current.id, { field, value, version: current.entry.version });
      onRow(res.data.item);
      return { ok: true, item: res.data.item, noop: Boolean(res.data.noop) };
    } catch (error) {
      const stale = isStale(error);
      // Someone else changed the row: show their version.
      if (stale && error.response.data.item) onRow(error.response.data.item);
      return { ok: false, stale, msg: saveErrorText(error) };
    }
  };

  const save = (row, field, value) => {
    const key = rowKey(row);
    const result = (tails.get(key) || Promise.resolve()).then(() => run(row, field, value));
    const tail = result.then(() => undefined);
    tails.set(key, tail);
    tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return result;
  };

  return { save };
}
