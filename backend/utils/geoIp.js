// utils/geoIp.js
//
// IP → { country, state, city } using an offline MaxMind GeoLite2-City (or any
// compatible City .mmdb) database. Results are normalised to the
// country-state-city names the frontend dropdowns use, so a detected location
// can be shown as-is in the Country → State → City selects.
//
// Contract: lookupLocation() NEVER throws and never blocks signup. A missing
// DB file, a private/local IP, an unknown IP or any internal error all
// resolve to null and the caller simply leaves the location empty.
//
// Env:
//   GEOIP_DB_PATH  path to the .mmdb (default: backend/data/GeoLite2-City.mmdb)
const path = require("path");
const maxmind = require("maxmind");
const { Country, State } = require("country-state-city");
const { isPublicIp, normalizeIp } = require("./clientIp");

const DEFAULT_DB_PATH = path.join(__dirname, "..", "data", "GeoLite2-City.mmdb");

let readerPromise = null;
let injectedReader = null; // test hook

function dbPath() {
  const configured = String(process.env.GEOIP_DB_PATH || "").trim();
  return configured ? path.resolve(configured) : DEFAULT_DB_PATH;
}

// Opens the database once. watchForUpdates picks up a replaced file (the
// monthly refresh) without a restart, and non-persistent watching keeps it
// from holding the process open. Failure is logged once and cached as null.
function getReader() {
  if (injectedReader) return Promise.resolve(injectedReader);
  if (!readerPromise) {
    const file = dbPath();
    readerPromise = maxmind
      .open(file, { watchForUpdates: true, watchForUpdatesNonPersistent: true })
      .then((reader) => {
        console.log(`[geoip] Loaded ${file}`);
        return reader;
      })
      .catch((err) => {
        console.warn(
          `[geoip] Could not open ${file} (${err.code || err.message}). ` +
            "New users will have an empty location until the database is installed."
        );
        return null;
      });
  }
  return readerPromise;
}

// Call at startup so the first signup doesn't pay the load cost. Safe to ignore.
function initGeoIp() {
  return getReader().then(() => undefined);
}

const fold = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const englishName = (node) => (node?.names?.en ? String(node.names.en).trim() : "");

function resolveState(countryIso, subdivisions) {
  const states = State.getStatesOfCountry(countryIso) || [];
  if (states.length === 0 || !Array.isArray(subdivisions)) return "";

  // Most specific match first: ISO 3166-2 code, then the English name.
  for (const sub of subdivisions) {
    if (sub?.iso_code) {
      const byCode = State.getStateByCodeAndCountry(String(sub.iso_code).toUpperCase(), countryIso);
      if (byCode) return byCode.name;
    }
  }
  for (const sub of subdivisions) {
    const wanted = fold(englishName(sub));
    if (!wanted) continue;
    const byName = states.find((s) => fold(s.name) === wanted);
    if (byName) return byName.name;
  }
  return "";
}

function mapRecord(record) {
  const iso = String(record?.country?.iso_code || "").toUpperCase();
  if (!iso) return null;
  const country = Country.getCountryByCode(iso);
  if (!country) return null;

  return {
    country: country.name,
    state: resolveState(iso, record.subdivisions),
    city: englishName(record.city),
  };
}

async function lookupLocation(rawIp) {
  try {
    if (!isPublicIp(rawIp)) return null;
    const reader = await getReader();
    if (!reader) return null;
    return mapRecord(reader.get(normalizeIp(rawIp)));
  } catch (err) {
    console.warn("[geoip] lookup failed:", err.message);
    return null;
  }
}

module.exports = {
  initGeoIp,
  lookupLocation,
  // exported for tests only
  _mapRecord: mapRecord,
  _setReader: (reader) => {
    injectedReader = reader;
  },
};
