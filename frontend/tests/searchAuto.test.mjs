// Tests for the automatic semantic enhancement (src/api/searchAuto.js) with the
// real createSearchSession and runSubmitSearch. No DOM, backend or network:
// `search` is a stub and timers are a manual fake clock.
// Run: node --test tests/searchAuto.test.mjs  (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";

import { createSearchSession, toSuggestions, SEARCH_GROUPS } from "../src/api/searchApi.js";
import { runSubmitSearch } from "../src/api/searchSubmit.js";
import { createAutoFullSearch, isStrongInstantResult, AUTO_FULL_DELAY_MS } from "../src/api/searchAuto.js";

const GROUP_OF = { category: "categories", specialty: "specialties", condition: "conditions", service: "services", doctor: "doctors", blog: "blogs" };
const item = (type, id, title, rank, matchedOn) => ({ type, id, title, rank, matchedOn, navigation: { path: `/p/${type}/${id}` } });
const response = (mode, items, extra = {}) => {
  const results = Object.fromEntries(SEARCH_GROUPS.map((g) => [g, []]));
  for (const it of items) results[GROUP_OF[it.type]].push(it);
  return { success: true, query: { normalized: "q" }, results, meta: { mode }, ...extra };
};

// Manual fake clock: timers only run when flush() is called.
function harness({ full = {}, fail = false } = {}) {
  const timers = [];
  const calls = [];
  const search = async (query, { mode }) => {
    calls.push({ query, mode });
    if (mode === "full") {
      if (fail) throw new Error("boom");
      const r = typeof full === "function" ? full(query) : full;
      return r instanceof Promise ? r : r;
    }
    return response("instant", []);
  };
  const session = createSearchSession({ search });
  let clock = 0;
  const auto = createAutoFullSearch({
    session,
    setTimer: (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length - 1; },
    clearTimer: (id) => { if (timers[id]) timers[id].live = false; },
    now: () => clock,
  });
  const shown = [];
  const onResults = (s) => shown.push(s.map((x) => x.title));
  const flush = async () => {
    for (const t of timers) if (t.live) { t.live = false; t.fn(); }
    await new Promise((r) => setImmediate(r));
  };
  const fullCalls = () => calls.filter((c) => c.mode === "full");
  return { auto, session, shown, onResults, flush, calls, fullCalls, advance: (ms) => { clock += ms; }, timers };
}

test("strong exact name result: no automatic full request (any type)", async () => {
  for (const [type, title] of [["specialty", "Cardiology"], ["condition", "Migraine"], ["service", "Telehealth"], ["doctor", "Dr. Ana Lee"], ["blog", "What is Telemedicine"], ["category", "Chronic Care"]]) {
    const h = harness();
    h.auto.consider(title, response("instant", [item(type, "1", title, 1, type === "blog" ? "title" : "name")]), h.onResults);
    await h.flush();
    assert.equal(h.fullCalls().length, 0, type);
  }
});

test("strong short alias: no full request; alias inside a long sentence is weak", async () => {
  const short = harness();
  short.auto.consider("heart doctor", response("instant", [item("specialty", "1", "Cardiology", 1, "alias")]), short.onResults);
  await short.flush();
  assert.equal(short.fullCalls().length, 0);
  assert.equal(isStrongInstantResult(response("instant", [item("specialty", "1", "X", 1, "alias")]), "heart doctor"), true);
  assert.equal(isStrongInstantResult(response("instant", [item("specialty", "1", "X", 1, "alias")]), "my stomach has been hurting after eating"), false);
});

test("weak result: runs full mode once after the pause, not before", async () => {
  const h = harness({ full: response("full", [item("condition", "c", "Abdominal Pain", 1, "intent"), item("specialty", "s", "Gastroenterology", 2, "alias")]) });
  h.auto.consider("my stomach has been hurting after eating", response("instant", [item("specialty", "s", "Gastroenterology", 1, "alias")]), h.onResults);
  assert.equal(h.fullCalls().length, 0); // nothing before the pause
  assert.equal(h.timers[0].ms, AUTO_FULL_DELAY_MS);
  await h.flush();
  assert.equal(h.fullCalls().length, 1);
});

test("no instant result: full mode runs after the pause", async () => {
  const h = harness({ full: response("full", [item("condition", "c", "Headache", 1, "intent"), item("specialty", "n", "Neurology", 2, "alias")]) });
  h.auto.consider("my head has been hurting", response("instant", []), h.onResults);
  await h.flush();
  assert.equal(h.fullCalls().length, 1);
  assert.deepEqual(h.shown, [["Headache", "Neurology"]]);
});

test("semantic query: full results replace the instant ones, backend rank order kept", async () => {
  const q = "my stomach has been hurting after eating";
  const h = harness({ full: response("full", [item("specialty", "s", "Gastroenterology", 2, "alias"), item("condition", "c", "Abdominal Pain", 1, "intent")]) });
  const instant = response("instant", [item("specialty", "s", "Gastroenterology", 1, "alias")]);
  assert.deepEqual(toSuggestions(instant).map((s) => s.title), ["Gastroenterology"]);
  h.auto.consider(q, instant, h.onResults);
  await h.flush();
  assert.deepEqual(h.shown, [["Abdominal Pain", "Gastroenterology"]]);
});

test("exact query: no full request", async () => {
  const h = harness();
  h.auto.consider("cardiology", response("instant", [item("specialty", "s", "Cardiology", 1, "name")]), h.onResults);
  await h.flush();
  assert.equal(h.fullCalls().length, 0);
  assert.deepEqual(h.shown, []);
});

test("typo-corrected query that matched a name is strong", async () => {
  const h = harness();
  h.auto.consider("cardeology", response("instant", [item("specialty", "s", "Cardiology", 1, "name")], { query: { normalized: "cardeology", corrected: "cardiology" } }), h.onResults);
  await h.flush();
  assert.equal(h.fullCalls().length, 0);
});

test("typing again before the pause cancels the pending full search", async () => {
  const h = harness({ full: response("full", [item("condition", "c", "Headache", 1, "intent"), item("specialty", "n", "Neurology", 2, "alias")]) });
  h.auto.consider("my head has been hurting", response("instant", []), h.onResults);
  h.auto.cancel(); // Home's effect cleanup on the next keystroke
  await h.flush();
  assert.equal(h.fullCalls().length, 0);
  assert.deepEqual(h.shown, []);
});

test("stale full response cannot overwrite a newer query", async () => {
  let release;
  const slow = new Promise((resolve) => { release = () => resolve(response("full", [item("condition", "c", "Old Result", 1, "intent"), item("specialty", "s", "Old Spec", 2, "alias")])); });
  const h = harness({ full: (q) => (q === "first long query here" ? slow : response("full", [item("condition", "n", "New Result", 1, "intent"), item("specialty", "m", "New Spec", 2, "alias")])) });
  h.auto.consider("first long query here", response("instant", []), h.onResults);
  await h.flush(); // first full request is now in flight
  h.auto.cancel(); // user typed a new query
  h.auto.consider("second long query here", response("instant", []), h.onResults);
  release();
  await h.flush();
  assert.deepEqual(h.shown, [["New Result", "New Spec"]]);
});

test("Search button / Enter joins an in-flight automatic search (no duplicate request)", async () => {
  const q = "my stomach has been hurting after eating";
  let release;
  const slow = new Promise((resolve) => { release = () => resolve(response("full", [item("condition", "c", "Abdominal Pain", 1, "intent"), item("specialty", "s", "Gastroenterology", 2, "alias")])); });
  const h = harness({ full: () => slow });
  h.auto.consider(q, response("instant", []), h.onResults);
  await h.flush();
  const joined = h.auto.join(q); // what submitSearch does for both Enter and the button
  assert.ok(joined);
  release();
  const out = await joined;
  assert.equal(out.action, "show");
  assert.equal(h.fullCalls().length, 1);
});

test("submit while the automatic search is only scheduled: timer dropped, submit sends the single request", async () => {
  const h = harness({ full: response("full", [item("condition", "c", "A", 1, "intent"), item("specialty", "s", "B", 2, "alias")]) });
  h.auto.consider("a weak long query", response("instant", []), h.onResults);
  assert.equal(h.auto.join("a weak long query"), null);
  const out = await runSubmitSearch(h.session, "a weak long query");
  await h.flush(); // the dropped timer must not fire
  assert.equal(out.action, "show");
  assert.equal(h.fullCalls().length, 1);
});

test("same query is not automatically searched twice", async () => {
  const h = harness({ full: response("full", [item("condition", "c", "A", 1, "intent"), item("specialty", "s", "B", 2, "alias")]) });
  const weak = response("instant", []);
  h.auto.consider("weak long query", weak, h.onResults);
  h.auto.consider("Weak  long query", weak, h.onResults); // while scheduled
  await h.flush();
  h.auto.consider("weak long query", weak, h.onResults); // after completion: reused
  await h.flush();
  assert.equal(h.fullCalls().length, 1);
  assert.deepEqual(h.shown, [["A", "B"], ["A", "B"]]);
});

test("a cached result expires", async () => {
  const h = harness({ full: response("full", [item("condition", "c", "A", 1, "intent"), item("specialty", "s", "B", 2, "alias")]) });
  h.auto.consider("weak long query", response("instant", []), h.onResults);
  await h.flush();
  h.advance(61 * 1000);
  h.auto.consider("weak long query", response("instant", []), h.onResults);
  await h.flush();
  assert.equal(h.fullCalls().length, 2);
});

test("empty/short query and unmount: pending work is cancelled", async () => {
  const h = harness({ full: response("full", [item("condition", "c", "A", 1, "intent"), item("specialty", "s", "B", 2, "alias")]) });
  h.auto.consider("weak long query", response("instant", []), h.onResults);
  h.auto.cancel(); // Home calls this when the query is cleared or the page unmounts
  await h.flush();
  assert.equal(h.fullCalls().length, 0);
  h.auto.consider("ab", response("instant", []), h.onResults); // below the minimum length
  await h.flush();
  assert.equal(h.fullCalls().length, 0);
});

test("full-mode failure/timeout and a failed instant response leave results alone", async () => {
  const failing = harness({ fail: true });
  failing.auto.consider("weak long query", response("instant", []), failing.onResults);
  await failing.flush();
  assert.equal(failing.fullCalls().length, 1);
  assert.deepEqual(failing.shown, []); // instant results stay visible
  const again = failing; // failures are not cached: a later retry is allowed
  again.auto.cancel();
  again.auto.consider("weak long query", response("instant", []), again.onResults);
  await again.flush();
  assert.equal(again.fullCalls().length, 2);

  const h = harness({ full: response("full", [item("condition", "c", "A", 1, "intent")]) });
  h.auto.consider("weak long query", { ...response("instant", []), success: false }, h.onResults);
  await h.flush();
  assert.equal(h.fullCalls().length, 0);
});

test("multiple full results are displayed (no navigation); a single one is also only displayed automatically", async () => {
  const multi = harness({ full: response("full", [item("condition", "c", "A", 1, "intent"), item("specialty", "s", "B", 2, "alias")]) });
  multi.auto.consider("weak long query", response("instant", []), multi.onResults);
  await multi.flush();
  assert.deepEqual(multi.shown, [["A", "B"]]);

  // The automatic path never navigates; a manual submit keeps the existing rules.
  const single = harness({ full: response("full", [item("condition", "c", "Only", 1, "intent")]) });
  single.auto.consider("weak long query", response("instant", []), single.onResults);
  await single.flush();
  assert.deepEqual(single.shown, [["Only"]]);
  assert.equal((await single.auto.join("weak long query")).action, "navigate"); // submit then navigates directly
});

test("generic across result types: doctor, blog and service results are replaced the same way", async () => {
  for (const type of ["doctor", "blog", "service", "category"]) {
    const h = harness({ full: response("full", [item(type, "1", `${type} A`, 1, "intent"), item("specialty", "s", "Spec", 2, "alias")]) });
    h.auto.consider("some natural language query", response("instant", [item(type, "9", "Weak", 1, "description")]), h.onResults);
    await h.flush();
    assert.deepEqual(h.shown, [[`${type} A`, "Spec"]], type);
  }
});

test("the automatic delay is exactly 1200 ms: nothing before it, one full search after it", async () => {
  assert.equal(AUTO_FULL_DELAY_MS, 1200);
  const h = harness({ full: response("full", [item("condition", "c", "Headache", 1, "intent"), item("specialty", "n", "Neurology", 2, "alias")]) });
  h.auto.consider("my head has been hurting since morning", response("instant", []), h.onResults);
  assert.equal(h.timers.length, 1);
  assert.equal(h.timers[0].ms, 1200); // the only timer is the 1200 ms one
  assert.equal(h.fullCalls().length, 0); // nothing has run before the delay elapses
  await h.flush(); // the 1200 ms timer fires
  assert.equal(h.fullCalls().length, 1);
  assert.deepEqual(h.shown, [["Headache", "Neurology"]]);
});

test("typing another character before the 1200 ms elapses supersedes the pending search", async () => {
  const h = harness({ full: (q) => response("full", [item("condition", "c", `Result for ${q}`, 1, "intent"), item("specialty", "s", "Spec", 2, "alias")]) });
  h.auto.consider("my head has been hurting", response("instant", []), h.onResults);
  h.auto.cancel(); // the next keystroke (Home's effect cleanup)
  h.auto.consider("my head has been hurting since", response("instant", []), h.onResults);
  assert.equal(h.timers.filter((t) => t.live).length, 1); // the first timer was dropped
  await h.flush();
  assert.deepEqual(h.fullCalls().map((c) => c.query), ["my head has been hurting since"]);
});

test("a strong exact result schedules no timer at all", () => {
  const h = harness();
  h.auto.consider("cardiology", response("instant", [item("specialty", "s", "Cardiology", 1, "name")]), h.onResults);
  assert.equal(h.timers.length, 0);
});
