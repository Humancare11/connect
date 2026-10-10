const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The Medical Q&A feature was removed (public GET /api/qna exposed patient
// names and attachment keys). The `questions` collection and the stored
// attachment files are deliberately kept; only the code is gone. These checks
// stop it from being wired back in by accident.
const backend = path.join(__dirname, "..");

test("the Q&A route and model are gone", () => {
  assert.equal(fs.existsSync(path.join(backend, "routes", "qna.js")), false);
  assert.equal(fs.existsSync(path.join(backend, "models", "Question.js")), false);
});

test("server.js no longer mounts /api/qna or loads the Question model", () => {
  const server = fs.readFileSync(path.join(backend, "server.js"), "utf8");
  assert.doesNotMatch(server, /\/api\/qna/);
  assert.doesNotMatch(server, /routes\/qna/);
  assert.doesNotMatch(server, /models\/Question/);
});

test("no backend file requires the removed modules", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js") && full !== __filename) {
        if (/require\(["'][^"']*(routes\/qna|models\/Question)["']\)/.test(fs.readFileSync(full, "utf8"))) {
          offenders.push(path.relative(backend, full));
        }
      }
    }
  };
  walk(backend);
  assert.deepEqual(offenders, []);
});
