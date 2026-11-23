import test from "node:test";
import assert from "node:assert/strict";
import {
  rate, initials, avatarColor, statusLabel, filterCounts, reportFilters, filterPeople, campaignStatusLabel,
  holdText, estimateText, insertAtCursor, formatDateTime, formatWhen, errorMessage, isEmail, mailboxLabel,
  signatureStatus, tabSwitchPlan, MY_SIGNATURE_PATH,
} from "./marketingUtils.js";

test("rates and initials", () => {
  assert.equal(rate(88, 139), "63%");
  assert.equal(rate(1, 0), "–");
  assert.equal(initials("Shifa Kazi"), "SK");
  assert.equal(initials("Dr. Nethaji N"), "NN");
  assert.equal(initials(""), "?");
  assert.equal(avatarColor("Shifa Kazi"), avatarColor("Shifa Kazi"));
});

test("the report chips: the main ones always, the rest only when someone is in them", () => {
  const people = [{ status: "opened" }, { status: "opened" }, { status: "bounced" }, { status: "uncertain" }, { status: "delivered" }];
  const chips = reportFilters(people);
  assert.deepEqual(chips.map((c) => c.key), ["all", "replied", "clicked", "opened", "delivered", "bounced", "unsub", "uncertain"]);
  assert.equal(chips.find((c) => c.key === "opened").count, 2);
  assert.equal(chips.find((c) => c.key === "replied").count, 0);
  assert.equal(chips.find((c) => c.key === "delivered").label, "Not opened");
  assert.equal(filterCounts(people).all, 5);
  assert.equal(filterPeople(people, "all").length, 5);
  assert.deepEqual(filterPeople(people, "bounced"), [{ status: "bounced" }]);
  assert.equal(statusLabel("unsub"), "Unsubscribed");
  assert.equal(statusLabel("something-new"), "something-new");
});

test("campaign status, hold reasons and the time estimate", () => {
  assert.equal(campaignStatusLabel("draft"), "Draft");
  assert.equal(campaignStatusLabel("stopped"), "Stopped");
  assert.match(holdText("daily_cap"), /tomorrow/);
  assert.match(holdText("ses_unavailable"), /try again/);
  assert.equal(holdText(""), "");
  assert.equal(estimateText({ minutes: 3, days: 1, dailyCap: 500 }), "About 3 min (sent steadily, not all at once)");
  assert.equal(estimateText({ minutes: 90, days: 4, dailyCap: 500 }), "About 4 days (up to 500 emails per day)");
  assert.equal(estimateText(null), "");
});

test("inserting a placeholder at the cursor or over a selection", () => {
  assert.deepEqual(insertAtCursor("Hello ,", 6, 6, "{{name}}"), { value: "Hello {{name}},", cursor: 14 });
  assert.deepEqual(insertAtCursor("Hello X", 6, 7, "{{name}}"), { value: "Hello {{name}}", cursor: 14 });
  assert.deepEqual(insertAtCursor("abc", undefined, undefined, "!"), { value: "abc!", cursor: 4 });
});

test("dates and messages", () => {
  const now = new Date("2026-11-19T12:00:00Z").getTime();
  assert.equal(formatWhen(null), "—");
  assert.equal(formatWhen("2026-11-19T11:59:40Z", now), "just now");
  assert.equal(formatWhen("2026-11-19T11:52:00Z", now), "8 min ago");
  assert.equal(formatWhen("2026-11-19T09:00:00Z", now), "3 hr ago");
  assert.match(formatWhen("2026-11-10T09:00:00Z", now), /^\d{1,2} Nov 2026, \d{1,2}:\d{2} (am|pm)$/);
  assert.equal(formatDateTime("not a date"), "");
  assert.equal(errorMessage({ response: { data: { msg: "Nope." } } }), "Nope.");
  assert.equal(errorMessage({}), "Something went wrong. Please try again.");
  assert.equal(isEmail("a@b.co"), true);
  assert.equal(isEmail("a b@c.co"), false);
  assert.equal(mailboxLabel({ displayName: "Updates", address: "u@h.co" }), "Updates — u@h.co");
});

test("signature status: off, added, or none when ticked but the sender has no signature", () => {
  assert.equal(signatureStatus({ add: false, hasImage: true }), "off");
  assert.equal(signatureStatus({ add: true, hasImage: true }), "added");
  assert.equal(signatureStatus({ add: true, hasImage: false }), "none");
  assert.equal(MY_SIGNATURE_PATH, "/admin-dashboard/email/settings/my-signature");
});

test("switching content tabs: warns before replacing HTML with text, offers convert-or-empty for typed text", () => {
  assert.equal(tabSwitchPlan({ from: "paste", to: "text", html: "<p>x</p>" }), "replace");
  assert.equal(tabSwitchPlan({ from: "file", to: "text", html: "<p>x</p>" }), "replace");
  assert.equal(tabSwitchPlan({ from: "paste", to: "text", html: "  " }), "none");
  assert.equal(tabSwitchPlan({ from: "text", to: "paste", sourceText: "Hello" }), "choose");
  assert.equal(tabSwitchPlan({ from: "text", to: "file", sourceText: "Hello" }), "choose");
  assert.equal(tabSwitchPlan({ from: "text", to: "paste", sourceText: " " }), "none");
  assert.equal(tabSwitchPlan({ from: "paste", to: "file", html: "<p>x</p>" }), "none");
  assert.equal(tabSwitchPlan({ from: "text", to: "text", sourceText: "x", html: "y" }), "none");
});
