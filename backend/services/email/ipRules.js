// IP address rules shared by the open classifier and the scanner lists.

const stripV4Mapped = (ip) => String(ip || "").trim().replace(/^::ffff:/i, "");

function v4ToInt(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

// Rules: an exact address (v4 or v6) or an IPv4 CIDR such as 203.0.113.0/24.
function ipMatches(ip, rules) {
  const addr = stripV4Mapped(ip).toLowerCase();
  if (!addr) return false;
  const asInt = v4ToInt(addr);
  for (const raw of rules) {
    const [base, bitsRaw] = String(raw).trim().split("/");
    const rule = stripV4Mapped(base).toLowerCase();
    if (bitsRaw === undefined) {
      if (rule === addr) return true;
      continue;
    }
    const bits = Number(bitsRaw);
    const ruleInt = v4ToInt(rule);
    if (asInt === null || ruleInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if (((asInt & mask) >>> 0) === ((ruleInt & mask) >>> 0)) return true;
  }
  return false;
}

module.exports = { ipMatches, stripV4Mapped, v4ToInt };
