import { useEffect, useState } from "react";
import api from "../../../api";

// Loads one page of the unified admin Appointments list. The previous page's data
// stays on screen while the next one loads (so the tab counts do not flicker), and
// a response that arrives after the filters changed again is ignored.
export default function useAdminBookings({ status, hideTesting, q, page, limit }) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));

    api
      .get("/api/admin/bookings", { params: { status, hideTesting, page, limit, ...(q ? { q } : {}) } })
      .then((res) => {
        if (alive) setState({ data: res.data, loading: false, error: "" });
      })
      .catch((err) => {
        console.error("Failed to load appointments", err);
        if (alive) setState((s) => ({ ...s, loading: false, error: err.response?.data?.msg || "Failed to load appointments." }));
      });

    return () => {
      alive = false;
    };
  }, [status, hideTesting, q, page, limit, attempt]);

  return { ...state, reload: () => setAttempt((n) => n + 1) };
}
