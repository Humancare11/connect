const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { parseRecipientInput, parseDelimited, isValidEmail } = require("../services/marketing/recipientParser");
const { sanitizeEmailHtml } = require("../services/marketing/sanitizer");
const render = require("../services/marketing/render");
const { createUnsubscribeToken, verifyUnsubscribeToken } = require("../services/marketing/unsubscribe");
const { formatFrom, classifySesError, createSesSender } = require("../services/marketing/sesSender");
const { verifySnsMessage, stringToSign, SnsVerifyError } = require("../services/marketing/snsVerify");
const { marketingConfig, sendReadiness } = require("../services/marketing/config");
const { idsIn, displayStatus } = require("../services/marketing/report");

const SECRET = "x".repeat(40);

describe("recipient parsing", () => {
  test("plain addresses: commas, semicolons, new lines, angle brackets; duplicates are case-insensitive", () => {
    const r = parseRecipientInput({ mode: "emails", text: "a@example.com, B@Example.com; a@EXAMPLE.com\nPriya <p@example.com>\nnot-an-email, x@y" });
    assert.deepEqual(r.recipients.map((x) => x.email), ["a@example.com", "b@example.com", "p@example.com"]);
    assert.equal(r.recipients[2].name, "Priya");
    assert.equal(r.duplicates, 1);
    assert.equal(r.invalidCount, 2);
    assert.deepEqual(r.invalid, ["not-an-email", "x@y"]);
  });

  test('"Name, email" and "Name, Company, email" lines', () => {
    const r = parseRecipientInput({ mode: "lines", text: 'Anil Sharma, anil@example.com\nSara Thomas, Bluewave Travels, hr@bluewave.example\n"Rao, K", k@example.com\nsolo@example.com' });
    assert.deepEqual(r.recipients, [
      { name: "Anil Sharma", company: "", email: "anil@example.com" },
      { name: "Sara Thomas", company: "Bluewave Travels", email: "hr@bluewave.example" },
      { name: "Rao, K", company: "", email: "k@example.com" },
      { name: "", company: "", email: "solo@example.com" },
    ]);
  });

  test("CSV: header columns in any order, quotes, BOM, CRLF, semicolon files, optional company", () => {
    const csv = '﻿Email,Name,Company\r\nana@example.com,"Ana, Jr.",Acme\r\n\r\nbad,Bob,\r\nana@example.com,Dup,\r\n';
    const r = parseRecipientInput({ mode: "csv", text: csv });
    assert.deepEqual(r.recipients, [{ name: "Ana, Jr.", company: "Acme", email: "ana@example.com" }]);
    assert.equal(r.invalidCount, 1);
    assert.equal(r.duplicates, 1);
    const semi = parseRecipientInput({ mode: "csv", text: "name;email\nTom;tom@example.com" });
    assert.equal(semi.recipients[0].email, "tom@example.com");
    assert.throws(() => parseRecipientInput({ mode: "csv", text: "name,phone\nx,1" }), /email column/);
  });

  test("limit, bad mode, control characters and address rules", () => {
    const many = Array.from({ length: 6 }, (_, i) => `u${i}@example.com`).join(",");
    assert.throws(() => parseRecipientInput({ mode: "emails", text: many }, { max: 5 }), /at most 5/);
    assert.throws(() => parseRecipientInput({ mode: "nope", text: "" }), /Choose how/);
    const r = parseRecipientInput({ mode: "lines", text: "Bad\u0000Name\u0007, ok@example.com" });
    assert.equal(r.recipients[0].name, "Bad Name");
    assert.ok(isValidEmail("a.b+c@sub.example.co"));
    for (const bad of ["a..b@example.com", ".a@example.com", "a@@example.com", "a@example", "a b@example.com", `${"x".repeat(65)}@example.com`]) {
      assert.equal(isValidEmail(bad), false, bad);
    }
    assert.deepEqual(parseDelimited('a,"b""c",d\n'), [["a", 'b"c', "d"]]);
  });
});

describe("HTML sanitiser", () => {
  const VECTORS = [
    '<script>alert(1)</script><p>hi</p>',
    '<img src="x" onerror="alert(1)">',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href=" javascript:alert(1)">x</a>',
    '<iframe src="https://evil.example"></iframe>',
    '<form action="https://evil.example"><input name="p"></form>',
    '<svg onload="alert(1)"></svg>',
    '<object data="x"></object><embed src="x">',
    '<base href="https://evil.example/">',
    '<meta http-equiv="refresh" content="0;url=https://evil.example">',
    '<link rel="stylesheet" href="https://evil.example/x.css">',
    '<div style="background:url(javascript:alert(1))">x</div>',
    '<div style="width:expression(alert(1))">x</div>',
    '<p onclick="alert(1)" onmouseover="x()">x</p>',
    '<img src="data:text/html;base64,PHNjcmlwdD4=">',
  ];

  test("none of the unsafe constructs survive", () => {
    for (const v of VECTORS) {
      const { html } = sanitizeEmailHtml(v);
      assert.doesNotMatch(html, /<script|<iframe|<form|<input|<svg|<object|<embed|<base|<meta http|<link|onerror|onclick|onmouseover|onload/i, v);
      assert.doesNotMatch(html, /javascript\s*:/i, v);
      assert.doesNotMatch(html, /expression\s*\(/i, v);
      assert.doesNotMatch(html, /data:text/i, v);
    }
  });

  test("it counts what it removed", () => {
    const { removed } = sanitizeEmailHtml('<script>1</script><script>2</script><p onclick="x">a</p><iframe></iframe><a href="javascript:x">y</a>');
    assert.equal(removed.scripts, 2);
    assert.equal(removed.eventHandlers, 1);
    assert.ok(removed.otherUnsafe >= 2);
  });

  test("safe email markup is kept: tables, inline styles, https images and links, <style> with unsafe CSS stripped", () => {
    const input =
      '<!doctype html><html><head><title>t</title><style>@import url(https://evil.example/a.css);.btn{color:red;background:url(https://cdn.example/x.png)} td{behavior:url(x.htc)} @media (max-width:600px){.w{width:100%}}</style></head>' +
      '<body style="margin:0"><table width="600" cellpadding="0" style="background:#fff"><tr><td align="center"><img src="https://cdn.example/logo.png" width="120" alt="Logo"><a href="https://humancareconnect.co/x?a=1&b=2" target="_blank">Go</a></td></tr></table></body></html>';
    const { html } = sanitizeEmailHtml(input);
    assert.match(html, /^<!doctype html><html><head>/i);
    assert.match(html, /<table width="600" cellpadding="0" style="background:#fff">/);
    assert.match(html, /<img src="https:\/\/cdn\.example\/logo\.png"/);
    assert.match(html, /href="https:\/\/humancareconnect\.co\/x\?a=1&amp;b=2"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(html, /<style>/);
    assert.doesNotMatch(html, /@import|behavior/i);
    assert.match(html, /@media \(max-width:600px\)/);
    assert.match(html, /url\(https:\/\/cdn\.example\/x\.png\)/);
    assert.doesNotMatch(html, /<title>/i);
  });

  test("a fragment without <body> is wrapped, and the result is a complete document", () => {
    const { html, bytes } = sanitizeEmailHtml("<p>Hello {{name}}</p>");
    assert.match(html, /<body><p>Hello \{\{name\}\}<\/p><\/body><\/html>$/);
    assert.equal(bytes, Buffer.byteLength(html));
  });
});

describe("rendering one recipient's mail", () => {
  const campaign = { subject: "Hello {{name}}\r\nBcc: evil@example.com", html: sanitizeEmailHtml('<p>Hi {{name}} from {{ company }}! {{nmae}}</p><a href="https://example.com/p?u={{name}}">Link</a><a href="https://example.com/p?u={{name}}">Again</a><a href="mailto:a@b.co">m</a>').html, fallbackName: "there", fallbackCompany: "" };

  test("placeholders: fallback for a missing name, empty company, escaping, URL-encoding inside links, no header injection", () => {
    const m = render.renderMail({ campaign, recipient: { name: '<b>"Dr" O\'Neil & Co</b>', company: "A&B" }, footerAddress: "Addr 1", unsubscribeUrl: "https://h.example/api/u/T" });
    assert.match(m.html, /Hi &lt;b&gt;&quot;Dr&quot; O&#39;Neil &amp; Co&lt;\/b&gt; from A&amp;B!/);
    assert.match(m.html, /\{\{nmae\}\}/);
    assert.match(m.html, /href="https:\/\/example\.com\/p\?u=%3Cb%3E%22Dr%22%20O'Neil%20%26%20Co%3C%2Fb%3E"/);
    assert.equal(m.subject.includes("\n"), false);
    assert.equal(m.subject.includes("\r"), false);

    const anon = render.renderMail({ campaign, recipient: { name: "", company: "" }, footerAddress: "Addr 1", unsubscribeUrl: "https://h.example/api/u/T" });
    assert.match(anon.html, /Hi there from !/);
    assert.match(anon.subject, /^Hello there Bcc: evil@example\.com$/);
  });

  test("footer with the company line and unsubscribe link, plain-text twin, tracking only when asked", () => {
    const plain = render.renderMail({ campaign, recipient: { name: "Ana" }, footerAddress: "Humancare Connect, Inc. · 4 Peddlers Row", unsubscribeUrl: "https://h.example/api/u/T" });
    assert.match(plain.html, /<a style="color:inherit;text-decoration:none;pointer-events:none;">Humancare Connect, Inc\. · 4 Peddlers Row<\/a><br>You received this email from Humancare Connect\. <a href="https:\/\/h\.example\/api\/u\/T"[^>]*>Unsubscribe<\/a>/);
    assert.doesNotMatch(plain.html, /api\/e\/|api\/l\//);
    assert.match(plain.text, /Hi Ana from !/);
    assert.match(plain.text, /Unsubscribe: https:\/\/h\.example\/api\/u\/T$/);

    const seen = [];
    const tracked = render.renderMail({
      campaign,
      recipient: { name: "Ana" },
      footerAddress: "x",
      unsubscribeUrl: "https://h.example/api/u/T",
      trackLink: (url) => {
        seen.push(url);
        return `https://h.example/api/l/tok${seen.length}`;
      },
      pixelUrl: "https://h.example/api/e/pix.gif",
    });
    assert.deepEqual(seen, ["https://example.com/p?u=Ana", "https://example.com/p?u=Ana"]); // mailto is never tracked; the unsubscribe link never is
    assert.match(tracked.html, /<img src="https:\/\/h\.example\/api\/e\/pix\.gif" width="1" height="1"/);
    assert.match(tracked.html, /href="https:\/\/h\.example\/api\/u\/T"/);
    assert.doesNotMatch(tracked.html, /tracking|track your|pixel/i); // never announced
  });

  test("placeholder checks", () => {
    assert.deepEqual(render.unknownPlaceholders("Hi {{name}} {{nmae}}", "{{ Foo }}"), ["nmae", "Foo"]);
    assert.equal(render.usesPlaceholder("no placeholder here"), false);
    assert.equal(render.usesPlaceholder("x", "Hello {{ NAME }}"), true);
  });
});

describe("unsubscribe tokens", () => {
  test("round trip, tamper, wrong secret, shape", () => {
    const id = "64b64c7f2f1d3a0a1c2b3d4e";
    const token = createUnsubscribeToken(id, SECRET);
    assert.equal(verifyUnsubscribeToken(token, SECRET), id);
    assert.equal(verifyUnsubscribeToken(token, "y".repeat(40)), null);
    assert.equal(verifyUnsubscribeToken(token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"), SECRET), null);
    assert.equal(verifyUnsubscribeToken(`64b64c7f2f1d3a0a1c2b3d4f.${token.split(".")[1]}`, SECRET), null);
    for (const bad of ["", "test", "a.b", null, undefined, 5, `${id}.`]) assert.equal(verifyUnsubscribeToken(bad, SECRET), null);
    assert.throws(() => createUnsubscribeToken(id, "short"));
    assert.doesNotMatch(token, /@/); // carries no address
  });
});

describe("SES helpers", () => {
  test("From header: quoted name, no injection, non-ASCII encoded", () => {
    assert.equal(formatFrom("Humancare Updates", "u@h.co"), '"Humancare Updates" <u@h.co>');
    assert.equal(formatFrom('Evil"\r\nBcc: x@y.z', "u@h.co"), '"Evil Bcc: x@y.z" <u@h.co>');
    assert.match(formatFrom("Zoë", "u@h.co"), /^=\?UTF-8\?B\?.+\?= <u@h\.co>$/);
    assert.equal(formatFrom("", "u@h.co"), "u@h.co");
  });

  test("one recipient in To, Reply-To = From, unsubscribe headers, configuration set, tags", async () => {
    let input;
    const sender = createSesSender({ cfg: { configurationSet: "cs", region: "ap-south-1" }, client: { send: async (c) => ((input = c.input), { MessageId: "mid-1" }) } });
    const res = await sender.send({ fromAddress: "u@h.co", fromName: "U", to: "a@example.com", replyTo: "u@h.co", subject: "S", html: "<p>x</p>", text: "x", unsubscribeUrl: "https://h.example/api/u/T", tags: { campaign: "c1", recipient: "r1", empty: "" } });
    assert.equal(res.messageId, "mid-1");
    assert.deepEqual(input.Destination, { ToAddresses: ["a@example.com"] });
    assert.deepEqual(input.ReplyToAddresses, ["u@h.co"]);
    assert.equal(input.ConfigurationSetName, "cs");
    assert.deepEqual(input.Content.Simple.Headers, [
      { Name: "List-Unsubscribe", Value: "<https://h.example/api/u/T>" },
      { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
    ]);
    assert.deepEqual(input.EmailTags, [{ Name: "campaign", Value: "c1" }, { Name: "recipient", Value: "r1" }]);
    assert.ok(!("CcAddresses" in input.Destination) && !("BccAddresses" in input.Destination));
  });

  test("error classes decide what is safe to retry", () => {
    const e = (name, status) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode: status } });
    assert.equal(classifySesError(e("ThrottlingException", 400)).kind, "retry");
    assert.equal(classifySesError(e("X", 429)).kind, "retry");
    assert.equal(classifySesError(e("AccountSuspendedException", 400)).kind, "hold");
    assert.equal(classifySesError(e("MessageRejected", 400)).kind, "fail");
    assert.equal(classifySesError(e("ServiceUnavailable", 503)).kind, "uncertain");
    assert.equal(classifySesError(new Error("socket hang up")).kind, "uncertain");
  });
});

describe("SNS signature check", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = publicKey.export({ type: "spki", format: "pem" });
  const TOPIC = "arn:aws:sns:ap-south-1:123456789012:ses-events";
  const CERT = "https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-abc.pem";

  const signed = (over = {}) => {
    const msg = { Type: "Notification", MessageId: "m1", TopicArn: TOPIC, Message: '{"eventType":"Delivery"}', Timestamp: "2026-11-19T10:00:00.000Z", SignatureVersion: "2", SigningCertURL: CERT, ...over };
    msg.Signature = crypto.createSign("RSA-SHA256").update(stringToSign(msg), "utf8").sign(privateKey, "base64");
    return msg;
  };
  const opts = { topicArn: TOPIC, fetchCert: async () => pem };

  test("a correctly signed message for our topic passes", async () => {
    const msg = signed();
    assert.equal((await verifySnsMessage(JSON.stringify(msg), opts)).MessageId, "m1");
  });

  test("tampered body, wrong topic, foreign certificate host, garbage and unsupported types are all refused", async () => {
    const good = signed();
    await assert.rejects(verifySnsMessage(JSON.stringify({ ...good, Message: "changed" }), opts), SnsVerifyError);
    await assert.rejects(verifySnsMessage(JSON.stringify(signed({ TopicArn: "arn:aws:sns:ap-south-1:1:other" })), opts), /Wrong topic/);
    await assert.rejects(verifySnsMessage(JSON.stringify(signed({ SigningCertURL: "https://evil.example.com/cert.pem" })), opts), /certificate URL/);
    await assert.rejects(verifySnsMessage(JSON.stringify(signed({ SigningCertURL: "http://sns.ap-south-1.amazonaws.com/c.pem" })), opts), /certificate URL/);
    await assert.rejects(verifySnsMessage("not json", opts), SnsVerifyError);
    await assert.rejects(verifySnsMessage(JSON.stringify({ ...good, Type: "Other" }), opts), SnsVerifyError);
    await assert.rejects(verifySnsMessage(JSON.stringify(good), { topicArn: "", fetchCert: async () => pem }), /No topic/);
    const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "pem" });
    await assert.rejects(verifySnsMessage(JSON.stringify(good), { topicArn: TOPIC, fetchCert: async () => other }), /Bad signature/);
  });
});

describe("settings and report helpers", () => {
  test("defaults and readiness list names only", () => {
    const c = marketingConfig({});
    assert.equal(c.enabled, false);
    assert.equal(c.region, "ap-south-1");
    assert.equal(c.dailyCap, 500);
    assert.equal(c.maxRecipients, 2000);
    assert.equal(c.sendRatePerSecond, 1);
    const missing = sendReadiness(c);
    assert.ok(missing.length === 4 && missing.every((m) => /^[A-Z_]+/.test(m)));
    const ok = marketingConfig({ MARKETING_UNSUB_SECRET: SECRET, MARKETING_FOOTER_ADDRESS: "A", SES_CONFIGURATION_SET: "cs", PUBLIC_TRACKING_BASE_URL: "https://h.example" });
    assert.deepEqual(sendReadiness(ok), []);
    assert.equal(marketingConfig({ MARKETING_ENABLED: "true" }).enabled, true);
  });

  test("a reply's In-Reply-To / References ids are read from <id@host> form", () => {
    assert.deepEqual(idsIn("<0109abc-def@ap-south-1.amazonses.com>"), ["0109abc-def"]);
    assert.deepEqual(idsIn("<a@x> <b@y>"), ["a", "b"]);
    assert.deepEqual(idsIn(""), []);
  });

  test("the status shown on a report row", () => {
    const base = { status: "delivered", openCount: 0, clickCount: 0, repliedAt: null, unsubscribedAt: null };
    assert.equal(displayStatus(base), "delivered");
    assert.equal(displayStatus({ ...base, openCount: 1 }), "opened");
    assert.equal(displayStatus({ ...base, openCount: 1, clickCount: 2 }), "clicked");
    assert.equal(displayStatus({ ...base, clickCount: 2, repliedAt: new Date() }), "replied");
    assert.equal(displayStatus({ ...base, repliedAt: new Date(), unsubscribedAt: new Date() }), "unsub");
    assert.equal(displayStatus({ ...base, status: "bounced", openCount: 3 }), "bounced");
    assert.equal(displayStatus({ ...base, status: "uncertain" }), "uncertain");
  });
});
