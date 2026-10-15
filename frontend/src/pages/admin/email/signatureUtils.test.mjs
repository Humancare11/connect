import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIVIDER,
  dividerIndex,
  forceSwap,
  joinCompose,
  messageOf,
  pickSignature,
  previewMail,
  splitCompose,
  swapSignature,
} from "./signatureUtils.js";

const SIG = "Anita Rao\nCare Coordinator";

test("the divider is the standard '-- ' line", () => {
  assert.equal(DIVIDER, "-- ");
});

test("join and split are inverses", () => {
  const text = joinCompose("Dear client,\nThank you.", SIG);
  assert.equal(text, "Dear client,\nThank you.\n\n-- \nAnita Rao\nCare Coordinator");
  assert.deepEqual(splitCompose(text), { message: "Dear client,\nThank you.", signature: SIG, hasDivider: true });
});

test("an empty message leaves room above the signature", () => {
  assert.equal(joinCompose("", SIG), "\n\n-- \nAnita Rao\nCare Coordinator");
  assert.equal(messageOf(joinCompose("", SIG)), "");
});

test("an inserted signature alone is not a message", () => {
  assert.equal(messageOf(joinCompose("   ", SIG)), "");
  assert.equal(messageOf(joinCompose("Hi", SIG)), "Hi");
});

test("text without a divider has no signature", () => {
  assert.deepEqual(splitCompose("Hello"), { message: "Hello", signature: "", hasDivider: false });
  assert.equal(messageOf("Hello"), "Hello");
  assert.equal(dividerIndex("Hello -- world\n--- x"), -1);
});

test("the divider may have lost its trailing space; the last one counts", () => {
  assert.equal(splitCompose("Hi\n--\nAnita").signature, "Anita");
  assert.deepEqual(splitCompose("Hi\n-- \nquoted\n\n-- \nAnita"), { message: "Hi\n-- \nquoted", signature: "Anita", hasDivider: true });
});

test("switching signature replaces an untouched one and keeps the message", () => {
  const text = joinCompose("Dear client,", SIG);
  const r = swapSignature(text, SIG, "Short\n+91 1");
  assert.deepEqual(r, { text: "Dear client,\n\n-- \nShort\n+91 1", needsConfirm: false });
});

test("choosing No signature removes it and the divider", () => {
  const r = swapSignature(joinCompose("Dear client,", SIG), SIG, "");
  assert.deepEqual(r, { text: "Dear client,", needsConfirm: false });
});

test("adding a signature to a mail that has none", () => {
  const r = swapSignature("Dear client,", "", SIG);
  assert.deepEqual(r, { text: "Dear client,\n\n-- \nAnita Rao\nCare Coordinator", needsConfirm: false });
});

test("an edited signature is not replaced without asking", () => {
  const edited = joinCompose("Dear client,", "Anita Rao\nOut until Monday");
  const r = swapSignature(edited, SIG, "Short");
  assert.deepEqual(r, { text: edited, needsConfirm: true });
  assert.equal(forceSwap(edited, "Short"), "Dear client,\n\n-- \nShort");
});

test("an emptied signature area is replaced without asking", () => {
  const r = swapSignature("Dear client,\n\n-- \n", SIG, "Short");
  assert.equal(r.needsConfirm, false);
  assert.equal(r.text, "Dear client,\n\n-- \nShort");
});

test("the message typed by the admin is never touched by a swap", () => {
  const msg = "Line one\n\nLine three -- with dashes\n";
  const r = swapSignature(joinCompose(msg, SIG), SIG, "New");
  assert.equal(splitCompose(r.text).message, "Line one\n\nLine three -- with dashes");
});

test("pickSignature: the mailbox's own choice, else the default, else none", () => {
  const data = {
    signatures: [
      { id: "a", name: "Formal", content: "A", isDefault: true },
      { id: "b", name: "Short", content: "B", isDefault: false },
    ],
    mailboxDefaults: { m2: "b" },
  };
  assert.equal(pickSignature(data, "m1").id, "a");
  assert.equal(pickSignature(data, "m2").id, "b");
  assert.equal(pickSignature({ signatures: [{ id: "b", isDefault: false }], mailboxDefaults: {} }, "m1"), null, "no default, nothing inserted");
  assert.equal(pickSignature({ signatures: [], mailboxDefaults: {} }, "m1"), null);
  assert.equal(pickSignature(undefined, "m1"), null);
  assert.equal(pickSignature({ signatures: data.signatures, mailboxDefaults: { m3: "gone" } }, "m3").id, "a", "a stale mailbox default falls back");
});

test("preview: message, signature, company footer; one divider", () => {
  assert.equal(
    previewMail({ message: "Hello", signature: SIG, companyFooter: "Human Care Connect", withCompanyFooter: true }),
    "Hello\n\n-- \nAnita Rao\nCare Coordinator\n\nHuman Care Connect"
  );
  assert.equal(
    previewMail({ message: "Hello", signature: SIG, companyFooter: "Human Care Connect", withCompanyFooter: false }),
    "Hello\n\n-- \nAnita Rao\nCare Coordinator"
  );
  assert.equal(previewMail({ message: "Hello", signature: "", companyFooter: "Human Care Connect", withCompanyFooter: false }), "Hello\n\n-- \nHuman Care Connect");
});
