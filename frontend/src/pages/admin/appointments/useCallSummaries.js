import { useEffect, useMemo, useState } from "react";
import api from "../../../api";

// The Call column: one batch request per 100 visible rows. Best effort, so the list works the same if this fails.
export default function useCallSummaries(rows) {
  const [summaries, setSummaries] = useState({});
  const idsKey = useMemo(() => rows.map((row) => row.id).join(","), [rows]);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) return undefined;
    let alive = true;
    const chunks = [];
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
    Promise.all(chunks.map((chunk) => api.post("/api/call-reports/summaries", { ids: chunk }).then((res) => res.data?.summaries || {}).catch(() => ({})))).then((parts) => {
      if (alive) setSummaries(Object.assign({}, ...parts));
    });
    return () => {
      alive = false;
    };
  }, [idsKey]);

  return summaries;
}
