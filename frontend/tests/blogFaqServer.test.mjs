// Tests for the no-DOM (build-time prerender) path of the blog FAQ helpers in src/utils/blogContent.js.
// Run: node --test tests/  (from frontend/). Node has no DOMParser, so these exercise the server path.
import test from "node:test";
import assert from "node:assert/strict";

import { prepareFaqAnswer, faqAnswerText, usableFaqs } from "../src/utils/blogContent.js";

assert.equal(typeof DOMParser, "undefined", "these tests must run without a DOM");

// Each pair is [FAQ HTML as saved by the backend, exactly what the browser path (DOMPurify + DOMParser.innerHTML)
// returns for it]. The expected strings were produced in real Chromium with the same DOMPurify config, so a
// match means server-rendered and client-rendered markup are identical (no hydration mismatch).
const CLIENT_OUTPUT = [
  [
    "<p>Telemedicine is <strong>convenient</strong> &amp; <em>safe</em>.</p><ul><li>Fast</li><li>Private</li></ul>",
    "<p>Telemedicine is <strong>convenient</strong> &amp; <em>safe</em>.</p><ul><li>Fast</li><li>Private</li></ul>",
  ],
  [
    '<p>Call us on <a href="https://humancareconnect.co/contact?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">our site</a>.<br />Or email <a href="mailto:support@humancareconnect.co" rel="noopener noreferrer">support</a>.</p>',
    '<p>Call us on <a href="https://humancareconnect.co/contact?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">our site</a>.<br>Or email <a href="mailto:support@humancareconnect.co" rel="noopener noreferrer">support</a>.</p>',
  ],
  [
    "<ol><li><p>Step <b>one</b></p></li><li>Step <i>two</i> &quot;quoted&quot; 5 &lt; 6</li></ol>",
    '<ol><li><p>Step <b>one</b></p></li><li>Step <i>two</i> "quoted" 5 &lt; 6</li></ol>',
  ],
];

test("server path gives the same markup as the browser path for normal FAQ HTML", () => {
  for (const [input, expected] of CLIENT_OUTPUT) assert.equal(prepareFaqAnswer(input), expected);
});

test("a malicious FAQ comes out harmless on the server path", () => {
  const evil =
    "<script>alert(1)</script>" +
    '<p onclick="steal()" style="x:y">Hello<img src=x onerror=alert(1)></p>' +
    '<a href="javascript:alert(1)">js link</a>' +
    '<a href=" JaVa&#9;script:alert(2)" onmouseover="x()">tab-obfuscated</a>' +
    '<a href="//evil.example/x" target="_self">protocol-relative</a>' +
    "<iframe src=//evil.example></iframe><style>*{display:none}</style>" +
    "<scr<script>ipt>alert(3)</script>" +
    "<!-- <script>alert(4)</script> -->";
  const out = prepareFaqAnswer(evil);
  assert.doesNotMatch(out, /<\s*(script|iframe|style|img)/i);
  assert.doesNotMatch(out, /\son\w+\s*=/i, "no event handler attributes");
  assert.doesNotMatch(out, /javascript:/i);
  assert.doesNotMatch(out, /style\s*=/i);
  assert.doesNotMatch(out, /evil\.example/);
  assert.doesNotMatch(out, /alert\(/, "script bodies are dropped, not shown");
  // Every tag left in the output is an allowed one with allowed attributes only.
  for (const [, , tag] of out.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>/gi)) assert.match(tag, /^(p|br|strong|b|em|i|ul|ol|li|a)$/);
  assert.match(out, /<p>Hello<\/p>/);
  assert.match(out, /js link/);
});

test("stray angle brackets and unclosed tags are escaped or closed, never passed through", () => {
  assert.equal(prepareFaqAnswer("1 < 2 and <b>bold"), "1 &lt; 2 and <b>bold</b>");
  assert.equal(prepareFaqAnswer("<scr"), "&lt;scr");
  assert.equal(prepareFaqAnswer("</p>text"), "text");
});

test("faqAnswerText and usableFaqs work on the server path", () => {
  assert.equal(faqAnswerText("<p>Hello <strong>there</strong></p><ul><li>one</li><li>two</li></ul>"), "Hello there one two");
  assert.equal(faqAnswerText('<p>5 &lt; 6 &amp; "ok"</p>'), '5 < 6 & "ok"');
  const faqs = usableFaqs([
    { question: "Is it safe?", answer: "<p>Yes.</p>" },
    { question: "Empty answer", answer: "<script>x()</script>" },
    { question: "", answer: "<p>No question</p>" },
  ]);
  assert.deepEqual(faqs.map((f) => f.question), ["Is it safe?"]);
});
