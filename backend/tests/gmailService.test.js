const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { buildRawMessage } = require("../services/gmail/mimeBuilder");
const { parseGmailMessage, decodeMimeWords, sanitizeEmailHtml } = require("../services/gmail/mimeParser");
const { createGmailClient, HistoryExpiredError, isRetryable } = require("../services/gmail/gmailClient");
const gmailAuth = require("../services/gmail/gmailAuth");
const { normalizeAddressList, EmailValidationError } = require("../utils/emailValidation");

const mailbox = { address: "support@humancareconnect.co", isActive: true, signature: "Human Care Connect" };
const b64 = (s) => Buffer.from(s).toString("base64url");
const noSleep = async () => {};

describe("emailValidation", () => {
  test("normalises, lowercases and de-duplicates addresses", () => {
    const list = normalizeAddressList("Anita <Anita@Gmail.com>; anita@gmail.com, b@x.co");
    assert.deepEqual(list.map((a) => a.address), ["anita@gmail.com", "b@x.co"]);
    assert.equal(list[0].name, "Anita");
  });

  test("rejects invalid addresses and enforces required", () => {
    assert.throws(() => normalizeAddressList("not-an-email"), EmailValidationError);
    assert.throws(() => normalizeAddressList("", { required: true }), EmailValidationError);
    assert.deepEqual(normalizeAddressList(""), []);
  });
});

describe("mimeBuilder", () => {
  const to = [{ name: "", address: "anita@gmail.com" }];

  test("builds a plain-text mail with the company footer and no admin name", async () => {
    const { raw, rfcMessageId, text } = await buildRawMessage({ mailbox, to, subject: "Hello", body: "Thanks Anita" });
    const s = raw.toString();
    assert.match(s, /^From: .*<support@humancareconnect\.co>/m);
    assert.match(s, /^To: anita@gmail\.com/m);
    assert.ok(rfcMessageId.endsWith("@humancareconnect.co>"));
    assert.ok(s.includes(rfcMessageId));
    assert.ok(text.endsWith("-- \nHuman Care Connect\n"));
  });

  test("sets In-Reply-To and References for replies", async () => {
    const { raw } = await buildRawMessage({
      mailbox, to, subject: "Re: Hello", body: "ok",
      inReplyTo: "<orig@x.co>", references: ["<a@x.co>", "<orig@x.co>"],
    });
    const s = raw.toString();
    assert.match(s, /^In-Reply-To: <orig@x\.co>/m);
    assert.match(s, /^References: <a@x\.co> <orig@x\.co>/m);
  });

  test("blocks header injection through the subject", async () => {
    const { raw } = await buildRawMessage({ mailbox, to, subject: "Hi\r\nBcc: evil@x.co", body: "x" });
    assert.doesNotMatch(raw.toString(), /^Bcc:/im);
  });

  test("attaches files and enforces size limits", async () => {
    const { raw } = await buildRawMessage({
      mailbox, to, subject: "S", body: "b",
      attachments: [{ filename: "slip.pdf", contentType: "application/pdf", content: Buffer.from("PDFDATA") }],
    });
    assert.match(raw.toString(), /filename=.?slip\.pdf/);
    await assert.rejects(
      buildRawMessage({ mailbox, to, subject: "S", body: "b", attachments: [{ filename: "big.bin", content: Buffer.alloc(11 * 1024 * 1024) }] }),
      EmailValidationError
    );
  });

  test("requires recipient, subject and body", async () => {
    await assert.rejects(buildRawMessage({ mailbox, to: [], subject: "S", body: "b" }), EmailValidationError);
    await assert.rejects(buildRawMessage({ mailbox, to, subject: " ", body: "b" }), EmailValidationError);
    await assert.rejects(buildRawMessage({ mailbox, to, subject: "S", body: "  " }), EmailValidationError);
  });
});

describe("mimeParser", () => {
  test("decodes RFC 2047 encoded words (base64 and Q)", () => {
    assert.equal(decodeMimeWords("=?UTF-8?B?QW5pdGEgSm9zaGk=?="), "Anita Joshi");
    assert.equal(decodeMimeWords("=?UTF-8?Q?Caf=C3=A9_menu?="), "Café menu");
  });

  const fixture = {
    id: "m1", threadId: "t1", labelIds: ["INBOX", "UNREAD"], internalDate: "1700000000000",
    payload: {
      mimeType: "multipart/mixed",
      headers: [
        { name: "From", value: "=?UTF-8?B?QW5pdGEgSm9zaGk=?= <Anita@Gmail.com>" },
        { name: "To", value: "support@humancareconnect.co" },
        { name: "Cc", value: "x@y.co, \"Doe, Jo\" <jo@y.co>" },
        { name: "Subject", value: "Re: Appointment" },
        { name: "Message-ID", value: "<abc@mail.gmail.com>" },
        { name: "In-Reply-To", value: "<orig@humancareconnect.co>" },
        { name: "References", value: "<orig@humancareconnect.co> <abc@mail.gmail.com>" },
      ],
      parts: [
        { mimeType: "multipart/alternative", parts: [
          { mimeType: "text/plain", body: { data: b64("Plain body") } },
          { mimeType: "text/html", body: { data: b64('<p onclick="x()">Hi</p><script>alert(1)</script><img src="https://t.co/p.gif">') } },
        ] },
        { mimeType: "application/pdf", filename: "slip.pdf", partId: "1", body: { attachmentId: "ATT1", size: 1234 } },
        { mimeType: "image/png", filename: "logo.png", partId: "2",
          headers: [{ name: "Content-Disposition", value: "inline" }, { name: "Content-ID", value: "<logo1>" }],
          body: { attachmentId: "ATT2", size: 10 } },
      ],
    },
  };

  test("parses headers, addresses, threading and date", () => {
    const m = parseGmailMessage(fixture);
    assert.equal(m.from.name, "Anita Joshi");
    assert.equal(m.from.address, "anita@gmail.com");
    assert.deepEqual(m.cc.map((a) => a.address), ["x@y.co", "jo@y.co"]);
    assert.equal(m.cc[1].name, "Doe, Jo");
    assert.equal(m.rfcMessageId, "<abc@mail.gmail.com>");
    assert.equal(m.inReplyTo, "<orig@humancareconnect.co>");
    assert.equal(m.references.length, 2);
    assert.equal(m.gmailThreadId, "t1");
    assert.equal(m.messageDate.getTime(), 1700000000000);
    assert.equal(m.isSpam, false);
  });

  test("extracts text, sanitised html, snippet and attachments", () => {
    const m = parseGmailMessage(fixture);
    assert.equal(m.text, "Plain body");
    assert.doesNotMatch(m.html, /script|onclick/);
    assert.match(m.html, /<p>Hi<\/p>/);
    assert.equal(m.snippet, "Plain body");
    assert.equal(m.attachments.length, 2);
    assert.equal(m.attachments[0].gmailAttachmentId, "ATT1");
    assert.equal(m.attachments[1].isInline, true);
    assert.equal(m.attachments[1].contentId, "logo1");
    // inline images don't count as "has attachment"
    assert.equal(m.hasAttachments, true);
    assert.equal(m.attachmentCount, 1);
  });

  test("flags spam from the SPAM label", () => {
    assert.equal(parseGmailMessage({ ...fixture, labelIds: ["SPAM"] }).isSpam, true);
  });

  test("falls back to text derived from html when there is no text part", () => {
    const m = parseGmailMessage({ id: "m2", payload: { mimeType: "text/html", headers: [], body: { data: b64("<b>Only</b> html") } } });
    assert.equal(m.text, "Only html");
  });

  test("html sanitiser strips dangerous markup and hardens links", () => {
    const out = sanitizeEmailHtml('<a href="javascript:alert(1)">x</a><a href="https://ok.co">y</a><style>p{}</style><iframe src="x"></iframe>');
    assert.doesNotMatch(out, /javascript:|<style|iframe/);
    assert.match(out, /rel="noopener noreferrer nofollow"/);
  });

  test("returns null for a message without an id", () => {
    assert.equal(parseGmailMessage({}), null);
  });
});

describe("gmailClient", () => {
  const apiErr = (code, reason) => Object.assign(new Error("api"), { code, errors: reason ? [{ reason }] : [] });

  test("retries rate-limit errors, then succeeds", async () => {
    let calls = 0;
    const client = createGmailClient({ users: { getProfile: async () => {
      calls += 1;
      if (calls < 3) throw apiErr(429);
      return { data: { emailAddress: "support@humancareconnect.co", historyId: 99 } };
    } } }, { sleepFn: noSleep });
    assert.deepEqual(await client.getProfile(), { emailAddress: "support@humancareconnect.co", historyId: "99" });
    assert.equal(calls, 3);
  });

  test("does not retry client errors", async () => {
    let calls = 0;
    const client = createGmailClient({ users: { getProfile: async () => { calls += 1; throw apiErr(400); } } }, { sleepFn: noSleep });
    await assert.rejects(client.getProfile());
    assert.equal(calls, 1);
    assert.equal(isRetryable(apiErr(403, "rateLimitExceeded")), true);
    assert.equal(isRetryable(apiErr(403, "forbidden")), false);
  });

  test("never retries a send", async () => {
    let calls = 0;
    const client = createGmailClient({ users: { messages: { send: async () => { calls += 1; throw apiErr(503); } } } }, { sleepFn: noSleep });
    await assert.rejects(client.sendRaw(Buffer.from("x")));
    assert.equal(calls, 1);
  });

  test("sendRaw base64url-encodes the message and passes the threadId", async () => {
    let body;
    const client = createGmailClient({ users: { messages: { send: async (a) => { body = a.requestBody; return { data: { id: "g1", threadId: "t9" } }; } } } });
    const res = await client.sendRaw(Buffer.from("hello"), "t9");
    assert.deepEqual(res, { id: "g1", threadId: "t9" });
    assert.equal(Buffer.from(body.raw, "base64url").toString(), "hello");
    assert.equal(body.threadId, "t9");
  });

  test("history: pages, dedupes, and splits added vs label-changed ids", async () => {
    const pages = [
      { data: { history: [{ messagesAdded: [{ message: { id: "a" } }] }, { labelsAdded: [{ message: { id: "a" } }, { message: { id: "b" } }] }], nextPageToken: "p2", historyId: "10" } },
      { data: { history: [{ labelsRemoved: [{ message: { id: "c" } }] }], historyId: "12" } },
    ];
    const client = createGmailClient({ users: { history: { list: async () => pages.shift() } } });
    const res = await client.listHistory("5");
    assert.deepEqual(res.addedIds, ["a"]);
    assert.deepEqual(res.labelChangedIds.sort(), ["b", "c"]);
    assert.equal(res.historyId, "12");
  });

  test("history 404 raises HistoryExpiredError", async () => {
    const client = createGmailClient({ users: { history: { list: async () => { throw apiErr(404); } } } });
    await assert.rejects(client.listHistory("1"), HistoryExpiredError);
  });

  test("listMessageIds paginates and honours includeSpamTrash", async () => {
    const seen = [];
    const pages = [{ data: { messages: [{ id: "1" }, { id: "2" }], nextPageToken: "n" } }, { data: { messages: [{ id: "3" }] } }];
    const client = createGmailClient({ users: { messages: { list: async (a) => { seen.push(a.includeSpamTrash); return pages.shift(); } } } });
    assert.deepEqual(await client.listMessageIds({ includeSpamTrash: true }), ["1", "2", "3"]);
    assert.deepEqual(seen, [true, true]);
  });

  test("getMessage returns null on 404; getAttachment decodes data", async () => {
    const client = createGmailClient({ users: { messages: {
      get: async () => { throw apiErr(404); },
      attachments: { get: async () => ({ data: { data: b64("file-bytes") } }) },
    } } });
    assert.equal(await client.getMessage("gone"), null);
    assert.equal((await client.getAttachment("m", "a")).toString(), "file-bytes");
  });

  test("setSpam swaps SPAM and INBOX labels", async () => {
    const calls = [];
    const client = createGmailClient({ users: { messages: { modify: async (a) => { calls.push(a.requestBody); return {}; } } } });
    await client.setSpam("m", true);
    await client.setSpam("m", false);
    assert.deepEqual(calls[0], { addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] });
    assert.deepEqual(calls[1], { addLabelIds: ["INBOX"], removeLabelIds: ["SPAM"] });
  });
});

describe("gmailAuth", () => {
  const saved = { b64: process.env.GOOGLE_SA_JSON_B64, path: process.env.GOOGLE_SA_JSON_PATH };
  const restore = () => {
    for (const [k, v] of [["GOOGLE_SA_JSON_B64", saved.b64], ["GOOGLE_SA_JSON_PATH", saved.path]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    gmailAuth.resetGmailAuthCache();
  };
  beforeEach(() => {
    delete process.env.GOOGLE_SA_JSON_B64;
    delete process.env.GOOGLE_SA_JSON_PATH;
    gmailAuth.resetGmailAuthCache();
  });

  test("refuses to impersonate inactive or out-of-domain mailboxes", () => {
    assert.throws(() => gmailAuth.assertImpersonable({ address: "ceo@gmail.com", isActive: true }));
    assert.throws(() => gmailAuth.assertImpersonable({ address: "support@humancareconnect.co", isActive: false }));
    assert.throws(() => gmailAuth.assertImpersonable(null));
    assert.equal(gmailAuth.assertImpersonable(mailbox), "support@humancareconnect.co");
  });

  test("reports clear errors for missing or bad credentials", () => {
    assert.throws(() => gmailAuth.loadCredentials(), /not configured/);
    process.env.GOOGLE_SA_JSON_B64 = Buffer.from("not json").toString("base64");
    assert.throws(() => gmailAuth.loadCredentials(), /not valid JSON/);
    gmailAuth.resetGmailAuthCache();
    process.env.GOOGLE_SA_JSON_B64 = Buffer.from(JSON.stringify({ client_email: "a@b" })).toString("base64");
    assert.throws(() => gmailAuth.loadCredentials(), /missing/);
    restore();
  });

  test("loads a valid key and fixes escaped newlines", () => {
    process.env.GOOGLE_SA_JSON_B64 = Buffer.from(JSON.stringify({ client_email: "sa@p.iam", private_key: "A\\nB" })).toString("base64");
    assert.deepEqual(gmailAuth.loadCredentials(), { email: "sa@p.iam", key: "A\nB" });
    restore();
  });
});
