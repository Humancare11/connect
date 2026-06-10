import { useState, useEffect } from "react";
import api from "../api";

export default function useLocationData(country, state) {
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    if (!country) { setStates([]); setCities([]); return; }
    let cancelled = false;
    setLoadingStates(true);
    setCities([]);
    api
      .get(`/api/locations/states/${encodeURIComponent(country)}`)
      .then((res) => { if (!cancelled) setStates(res.data.states); })
      .catch(() => { if (!cancelled) setStates([]); })
      .finally(() => { if (!cancelled) setLoadingStates(false); });
    return () => { cancelled = true; };
  }, [country]);

  useEffect(() => {
    if (!country || !state) { setCities([]); return; }
    let cancelled = false;
    setLoadingCities(true);
    api
      .get(`/api/locations/cities/${encodeURIComponent(country)}/${encodeURIComponent(state)}`)
      .then((res) => { if (!cancelled) setCities(res.data.cities); })
      .catch(() => { if (!cancelled) setCities([]); })
      .finally(() => { if (!cancelled) setLoadingCities(false); });
    return () => { cancelled = true; };
  }, [country, state]);

  return { states, cities, loadingStates, loadingCities };
}
