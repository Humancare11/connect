import { useCallback, useEffect, useMemo, useState } from "react";
import { pruneSelection } from "./selectionLogic";

// Which rows of the current page are ticked, and whether the tick boxes are showing.
// The selection is of this page only: it is cleared when the tab, Hide testing, the search or the
// page changes (`resetKey`), and rows that leave the page (cancelled elsewhere, filtered out) drop out.
export default function useSelection({ rows, resetKey }) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    setSelected((current) => (current.size ? new Set() : current));
  }, [resetKey]);

  useEffect(() => {
    setSelected((current) => pruneSelection(current, rows));
  }, [rows]);

  const enter = useCallback(() => setSelecting(true), []);
  const clear = useCallback(() => setSelected(new Set()), []);
  const exit = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);
  const selectPage = useCallback(() => {
    setSelecting(true);
    setSelected(new Set(rows.map((r) => r.id)));
  }, [rows]);
  const toggle = useCallback((id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      selecting,
      selected,
      count: selected.size,
      allSelected: rows.length > 0 && selected.size === rows.length,
      isSelected: (id) => selected.has(id),
      selectedRows: rows.filter((r) => selected.has(r.id)),
      enter, exit, clear, selectPage, toggle,
    }),
    [selecting, selected, rows, enter, exit, clear, selectPage, toggle],
  );
}
