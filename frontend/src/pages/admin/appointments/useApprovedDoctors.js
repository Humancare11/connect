import { useCallback, useEffect, useState } from "react";
import { fetchApprovedDoctors } from "./bookingApi";

// The doctor list changes rarely, so it is fetched once per page visit, when the first
// doctor dialog opens, and reused for every dialog after that.
let cached = null;

export default function useApprovedDoctors(enabled) {
  const [state, setState] = useState({ doctors: cached || [], loading: false, error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || cached) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    fetchApprovedDoctors()
      .then((doctors) => {
        cached = doctors;
        if (alive) setState({ doctors, loading: false, error: "" });
      })
      .catch((err) => {
        console.error("Failed to load doctors", err);
        if (alive) setState({ doctors: [], loading: false, error: "Could not load the doctors." });
      });
    return () => {
      alive = false;
    };
  }, [enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, doctors: cached || state.doctors, retry };
}

// For tests and for the page to drop the list when it unmounts.
export const resetApprovedDoctorsCache = () => {
  cached = null;
};
