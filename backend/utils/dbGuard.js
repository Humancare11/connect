// Guard for maintenance scripts that WRITE to the database (seeding mailboxes,
// syncing Gmail into Mongo, ...). They must never run against production by
// accident — e.g. because a production MONGO_URI was left un-commented in .env.
//
// The production cluster is identified by host (not by database name: UAT and
// production both use "authDB"). Configure it in the env file as:
//   PRODUCTION_MONGO_HOSTS=okc5dpy.mongodb.net      (comma-separated; a host
//   matches when it equals an entry or is a sub-domain of one, so one entry
//   covers every shard host of an Atlas cluster.)
//
// Fails CLOSED: if the list is not configured the script refuses to run, since
// it then cannot tell production from anything else.
// Error messages contain host names only — never credentials.

// Credentials end at the LAST "@" before the query string, even when a password
// contains an unescaped "/" or "@" — a naive "first slash" split would then read
// part of the password as the host and let production through (fail open).
function parseMongoHosts(uri) {
  const noQuery = String(uri || "").replace(/^mongodb(\+srv)?:\/\//, "").split("?")[0];
  const at = noQuery.lastIndexOf("@");
  const afterCreds = at === -1 ? noQuery : noQuery.slice(at + 1);
  const slash = afterCreds.indexOf("/");
  return (slash === -1 ? afterCreds : afterCreds.slice(0, slash))
    .split(",")
    .map((h) => h.replace(/:\d+$/, "").trim().toLowerCase())
    .filter(Boolean);
}

const parseBlockedHosts = (value) =>
  String(value || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

const hostIsBlocked = (host, blocked) => blocked.some((b) => host === b || host.endsWith(`.${b}`));

// → { hosts } when it is safe to proceed; throws otherwise.
function assertNotProductionDb({ uri, env = process.env }) {
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to run: NODE_ENV is production.");
  }

  const hosts = parseMongoHosts(uri);
  if (hosts.length === 0) {
    throw new Error("Refusing to run: MONGO_URI is missing or has no host.");
  }

  const blocked = parseBlockedHosts(env.PRODUCTION_MONGO_HOSTS);
  if (blocked.length === 0) {
    throw new Error(
      "Refusing to run: PRODUCTION_MONGO_HOSTS is not set, so production cannot be ruled out. " +
        "Set it in the env file to the production cluster host (e.g. PRODUCTION_MONGO_HOSTS=xxxxxxx.mongodb.net)."
    );
  }

  const hit = hosts.find((h) => hostIsBlocked(h, blocked));
  if (hit) {
    throw new Error(`Refusing to run: MONGO_URI points at the production database cluster (${hit}).`);
  }
  return { hosts };
}

module.exports = { assertNotProductionDb, parseMongoHosts, parseBlockedHosts, hostIsBlocked };
