// Tests for the hero search submit flow (src/api/searchSubmit.js) together with
// the real createSearchSession. No DOM, backend or network: `search` is a stub.
// Run: node --test tests/  (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";

import { createSearchSession, toSuggestions, SEARCH_GROUPS } from "../src/api/searchApi.js";
import { runSubmitSearch } from "../src/api/searchSubmit.js";

const QUERY = "my stomach has been hurting after eating";
const empty = () => Object.fromEntries(SEARCH_GROUPS.map((g) => [g, []]));
const condition = { type: "condition", id: "c1", title: "Abdominal Pain", rank: 1, matchedOn: "intent", navigation: { path: "/chronic-care/gastroenterology/abdominal-pain" } };
const specialty = { type: "specialty", id: "s1", title: "Gastroenterology", rank: 2, matchedOn: "alias", navigation: { path: "/chronic-care/gastroenterology" } };
const body = (mode, results) => ({ success: true, query: { normalized: QUERY }, results: { ...empty(), ...results }, meta: { mode } });

const fullBoth = body("full", { specialties: [specialty], conditions: [condition] }); // group order != rank order
const instantOnly = body("instant", { specialties: [specialty] });

// Stub search that answers by mode and records every call.
function stub(responses) {
  const calls = [];
  const search = async (query, { mode }) => { calls.push({ query, mode }); return responses[mode]; };
  return { calls, session: createSearchSession({ search }) };
}

test("multiple full-mode results are shown in backend rank order, with no navigation", async () => {
  const { session, calls } = stub({ full: fullBoth });
  const out = await runSubmitSearch(session, QUERY);
  assert.equal(out.action, "show");
  assert.deepEqual(out.suggestions.map((s) => s.title), ["Abdominal Pain", "Gastroenterology"]);
  assert.equal(out.suggestions[0].route, "/chronic-care/gastroenterology/abdominal-pain");
  assert.deepEqual(calls, [{ query: QUERY, mode: "full" }]);
});

test("a single full-mode result still navigates directly", async () => {
  const { session } = stub({ full: body("full", { conditions: [condition] }) });
  const out = await runSubmitSearch(session, QUERY);
  assert.equal(out.action, "navigate");
  assert.equal(out.suggestions[0].route, "/chronic-care/gastroenterology/abdominal-pain");
});

test("no results (and failures) keep the no-results behaviour", async () => {
  const { session } = stub({ full: body("full", {}) });
  assert.equal((await runSubmitSearch(session, QUERY)).action, "empty");
  const failing = createSearchSession({ search: async () => { throw new Error("boom"); } });
  assert.equal((await runSubmitSearch(failing, QUERY)).action, "empty");
});

test("Enter and the Search button share one path and use full-mode results, not the stale instant result", async () => {
  const { session, calls } = stub({ instant: instantOnly, full: fullBoth });
  const stale = toSuggestions(await session.run(QUERY, { mode: "instant" })); // what the dropdown showed while typing
  assert.deepEqual(stale.map((s) => s.title), ["Gastroenterology"]);
  const out = await runSubmitSearch(session, QUERY); // submitSearch is the only handler for both triggers
  assert.equal(out.action, "show");
  assert.equal(out.suggestions[0].title, "Abdominal Pain");
  assert.deepEqual(calls.map((c) => c.mode), ["instant", "full"]);
});

test("an in-flight instant request cannot overwrite the full-mode results", async () => {
  let releaseInstant;
  const search = (query, { mode, signal }) => mode === "instant"
    ? new Promise((resolve, reject) => { releaseInstant = () => resolve(instantOnly); signal.addEventListener("abort", () => reject(new Error("aborted"))); })
    : Promise.resolve(fullBoth);
  const session = createSearchSession({ search });
  const instant = session.run(QUERY, { mode: "instant" });
  const out = await runSubmitSearch(session, QUERY);
  assert.equal(out.action, "show");
  assert.equal(await instant, null); // superseded: the page ignores it
  releaseInstant?.();
});

test("a submit superseded by newer typing does nothing", async () => {
  let release;
  const search = () => new Promise((resolve) => { release = () => resolve(fullBoth); });
  const session = createSearchSession({ search });
  const pending = runSubmitSearch(session, QUERY);
  session.cancel();
  release();
  assert.equal((await pending).action, "superseded");
});

test("clicking a displayed result uses the backend navigation path unchanged", async () => {
  const { session } = stub({ full: fullBoth });
  const { suggestions } = await runSubmitSearch(session, QUERY);
  // Home.jsx handleSearch(item) navigates to item.route.
  assert.deepEqual(suggestions.map((s) => s.route), ["/chronic-care/gastroenterology/abdominal-pain", "/chronic-care/gastroenterology"]);
});

test("typing only uses instant mode; full mode runs solely on submit", async () => {
  const { session, calls } = stub({ instant: instantOnly, full: fullBoth });
  for (const q of ["my", "my stomach", QUERY]) await session.run(q, { mode: "instant" });
  assert.ok(calls.every((c) => c.mode === "instant"));
  await runSubmitSearch(session, QUERY);
  assert.equal(calls.filter((c) => c.mode === "full").length, 1);
});
