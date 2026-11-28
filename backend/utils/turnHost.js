// Which of OUR TURN servers a call used. Only a hostname that is configured in
// RTC_TURN_URLS* is ever stored; anything else a client sends becomes "other",
// so a report can never hold an IP address or arbitrary text.
const { TURN_REGIONS } = require("./iceServerRegions");

// "turns:host.example:443?transport=tcp" | "host.example" -> "host.example"
function hostOfIceUrl(value) {
  const match = String(value || "").trim().match(/^(?:turns?:|stuns?:)?([a-z0-9.-]+)(?::\d+)?(?:\?.*)?$/i);
  return match ? match[1].toLowerCase() : "";
}

const configuredTurnHosts = (regions = TURN_REGIONS) =>
  new Set(regions.flatMap((region) => region.urls.map(hostOfIceUrl)).filter(Boolean));

function sanitizeTurnHost(value, hosts = configuredTurnHosts()) {
  if (typeof value !== "string" || !value.trim()) return "";
  const host = hostOfIceUrl(value.slice(0, 200));
  return host && hosts.has(host) ? host : "other";
}

module.exports = { hostOfIceUrl, configuredTurnHosts, sanitizeTurnHost };
