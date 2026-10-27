import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listEntries, saveEntryField } from "./entriesApi";
import { PAGE_SIZE, replaceRow, rowKey } from "./entriesFormat";
import { createSaveQueue } from "./entrySaver";

const REFRESH_AFTER_SAVE_MS = 700;

// Loads one page of the entries list and saves single fields. The previous page's data stays on screen while the next one loads
// (so the tab counts do not flicker), and an answer that arrives after the filters changed again is ignored.
//
// After a save the row is swapped for the server's copy at once; a moment later the list is read again quietly (no spinner) so the
// tab counts, the three boxes, the totals and the row's place in the tab are right. A cell the person is still typing in is not
// overwritten: each cell keeps its own draft.
export default function useEntries({ view, tab, month, q, page }) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);
  const dataRef = useRef(null);
  const refreshTimer = useRef(null);

  const params = useMemo(
    () => ({ view, tab, page, limit: PAGE_SIZE, ...(month ? { month } : {}), ...(q ? { q } : {}) }),
    [view, tab, month, q, page],
  );

  const load = useCallback(
    (quiet) => {
      const id = ++requestId.current;
      if (!quiet) setState((s) => ({ ...s, loading: true, error: "" }));
      return listEntries(params)
        .then((res) => {
          if (id !== requestId.current) return;
          dataRef.current = res.data;
          setState({ data: res.data, loading: false, error: "" });
        })
        .catch((err) => {
          if (id !== requestId.current) return;
          console.error("Failed to load appointment entries", err);
          const msg = err.response?.data?.msg || "Failed to load appointment entries.";
          // A quiet refresh that fails keeps what is on screen.
          setState((s) => (quiet ? { ...s, loading: false } : { ...s, loading: false, error: msg }));
        });
    },
    [params],
  );

  useEffect(() => {
    load(false);
    return () => {
      requestId.current += 1;
      clearTimeout(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, attempt]);

  const refreshSoon = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => load(true), REFRESH_AFTER_SAVE_MS);
  }, [load]);

  // The newest copy of a row the page holds (read by the save queue, so it always sees the version a finished save produced).
  const getRow = useCallback((key) => dataRef.current?.items.find((row) => rowKey(row) === key), []);

  const putRow = useCallback((item) => {
    if (!dataRef.current) return;
    dataRef.current = { ...dataRef.current, items: replaceRow(dataRef.current.items, item) };
    setState((s) => ({ ...s, data: dataRef.current }));
  }, []);

  const queue = useMemo(
    () =>
      createSaveQueue({
        send: saveEntryField,
        getRow,
        onRow: putRow,
      }),
    [getRow, putRow],
  );

  const save = useCallback(
    async (row, field, value) => {
      const result = await queue.save(row, field, value);
      refreshSoon();
      return result;
    },
    [queue, refreshSoon],
  );

  return { ...state, reload: () => setAttempt((n) => n + 1), refresh: () => load(true), save, putRow };
}
