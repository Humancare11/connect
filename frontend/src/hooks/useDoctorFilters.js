import { useCallback, useEffect, useMemo, useState } from "react";
import { Country, State } from "country-state-city";

const EMPTY = { name: "", country: "", language: "", state: "", city: "", minPrice: "", maxPrice: "" };

export function doctorDisplayName(row) {
  return `${row?.firstName || ""} ${row?.surname || ""}`.trim() || row?.doctorId?.name || "";
}

const norm = (v) => String(v || "").trim().toLowerCase();

// State is stored as an ISO code; fall back to the raw value if it can't be resolved.
function stateLabel(country, code) {
  if (!code) return "";
  const s = country ? State.getStateByCodeAndCountry(code, country) : null;
  return s?.name || code;
}

function countryLabel(code) {
  return Country.getCountryByCode(code)?.name || code;
}

const toOptions = (map) =>
  [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

/**
 * Shared filters for the admin doctor listings (Manage Doctors, Our Doctors).
 * `rows` are Enrollment records; filtering is client-side because both lists are fully loaded.
 */
export default function useDoctorFilters(rows) {
  const [filters, setFilters] = useState(EMPTY);
  const [debouncedName, setDebouncedName] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(filters.name), 300);
    return () => clearTimeout(t);
  }, [filters.name]);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "country") { next.state = ""; next.city = ""; }
      if (key === "state") next.city = "";
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setFilters(EMPTY);
    setDebouncedName("");
  }, []);

  const options = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    const countries = new Map();
    const languages = new Map();
    const states = new Map();
    const cities = new Map();
    list.forEach((r) => {
      if (r.country) countries.set(r.country, countryLabel(r.country));
      (r.languagesKnown || []).forEach((l) => {
        const k = norm(l);
        if (k && !languages.has(k)) languages.set(k, String(l).trim());
      });
      if (filters.country && r.country === filters.country && r.state) {
        states.set(r.state, stateLabel(r.country, r.state));
        if (filters.state && r.state === filters.state && r.city) {
          const k = norm(r.city);
          if (!cities.has(k)) cities.set(k, String(r.city).trim());
        }
      }
    });
    return {
      countries: toOptions(countries),
      languages: toOptions(languages),
      states: toOptions(states),
      cities: toOptions(cities),
    };
  }, [rows, filters.country, filters.state]);

  const active = useMemo(
    () => Object.values(filters).some((v) => String(v).trim() !== ""),
    [filters],
  );

  const applyFilters = useCallback(
    (list) => {
      const q = norm(debouncedName);
      const min = filters.minPrice === "" ? null : Number(filters.minPrice);
      const max = filters.maxPrice === "" ? null : Number(filters.maxPrice);
      const lang = norm(filters.language);
      const city = norm(filters.city);
      return list.filter((r) => {
        if (q && !norm(doctorDisplayName(r)).includes(q)) return false;
        if (filters.country && r.country !== filters.country) return false;
        if (lang && !(r.languagesKnown || []).some((l) => norm(l) === lang)) return false;
        if (filters.state && r.state !== filters.state) return false;
        if (city && norm(r.city) !== city) return false;
        if (min !== null || max !== null) {
          const fee = r.consultantFees;
          if (fee === null || fee === undefined || fee === "" || !Number.isFinite(Number(fee))) return false;
          if (min !== null && Number(fee) < min) return false;
          if (max !== null && Number(fee) > max) return false;
        }
        return true;
      });
    },
    [debouncedName, filters.country, filters.language, filters.state, filters.city, filters.minPrice, filters.maxPrice],
  );

  return { filters, setFilter, reset, options, active, applyFilters };
}
