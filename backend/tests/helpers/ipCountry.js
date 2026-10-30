// Test helper: which country a request comes from is decided by its IP. A fake GeoIP reader answers a country for each of these
// documentation-style public IPs, so a test can say "this user is in the UK right now" independently of the country on their profile.
const geoIp = require("../../utils/geoIp");

const BY_COUNTRY = {
  India: { ip: "49.36.0.10", iso: "IN" },
  Germany: { ip: "88.64.0.10", iso: "DE" },
  France: { ip: "88.65.0.10", iso: "FR" },
  "United Kingdom": { ip: "81.2.0.10", iso: "GB" },
  "United States": { ip: "8.8.8.8", iso: "US" },
};
const ISO_BY_IP = Object.fromEntries(Object.values(BY_COUNTRY).map(({ ip, iso }) => [ip, iso]));

// The IP a visitor in `country` appears to come from; an unknown country gets an IP the reader cannot place.
const ipFor = (country) => BY_COUNTRY[country]?.ip || "203.0.113.200";

function installIpReader() {
  geoIp._setReader({
    get: (ip) =>
      ISO_BY_IP[ip] ? { country: { iso_code: ISO_BY_IP[ip] }, subdivisions: [], city: { names: { en: "Somewhere" } } } : null,
  });
}
function removeIpReader() {
  geoIp._setReader(null);
}

module.exports = { ipFor, installIpReader, removeIpReader, BY_COUNTRY };
