// File bubbles in the chat: the link cache (4 minutes, one request at a time, forgotten on error), the kind labels, and
// the wiring on both sides. Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL_TTL_MS, createUrlCache, isImage, kindLabel, sizeLabel } from "../src/features/livechat/fileUrls.js";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...parts) => fs.readFileSync(path.join(src, ...parts), "utf8");

test("a link is reused for 4 minutes and then fetched again (the server's links last 5)", async () => {
  let t = 0;
  const cache = createUrlCache({ now: () => t });
  let calls = 0;
  const load = async () => `https://files.test/a?n=${++calls}`;
  assert.equal(URL_TTL_MS, 4 * 60 * 1000);
  assert.equal(await cache.resolve("f1:preview", load), "https://files.test/a?n=1");
  t += URL_TTL_MS - 1;
  assert.equal(await cache.resolve("f1:preview", load), "https://files.test/a?n=1", "still fresh");
  t += 2;
  assert.equal(await cache.resolve("f1:preview", load), "https://files.test/a?n=2", "expired: a new link");
  assert.equal(calls, 2);
});

test("two asks at the same moment make one request", async () => {
  const cache = createUrlCache();
  let calls = 0;
  const load = () => new Promise((resolve) => setTimeout(() => resolve(`u${++calls}`), 10));
  const [a, b] = await Promise.all([cache.resolve("k", load), cache.resolve("k", load)]);
  assert.equal(a, b);
  assert.equal(calls, 1);
});

test("a failed request is not cached; forget() drops a link that did not work", async () => {
  const cache = createUrlCache();
  let fail = true;
  const load = async () => {
    if (fail) throw new Error("storage down");
    return "https://files.test/ok";
  };
  await assert.rejects(cache.resolve("k", load), /storage down/);
  fail = false;
  assert.equal(await cache.resolve("k", load), "https://files.test/ok", "the next ask tries again");
  let n = 0;
  const next = async () => `fresh-${++n}`;
  cache.forget("k");
  assert.equal(await cache.resolve("k", next), "fresh-1");
  await assert.rejects(cache.resolve("empty", async () => ""), /no link/, "an empty answer is an error, never cached");
});

test("kinds: jpg/png are pictures with a thumbnail; PDF and anything else is a card", () => {
  assert.equal(isImage("image/png"), true);
  assert.equal(isImage("image/jpeg"), true);
  assert.equal(isImage("application/pdf"), false);
  assert.equal(isImage(undefined), false);
  assert.deepEqual(["application/pdf", "image/png", "image/jpeg", "text/plain"].map(kindLabel), ["PDF", "PNG", "JPG", "File"]);
  assert.equal(sizeLabel(1), "1 KB");
  assert.equal(sizeLabel(2048), "2 KB");
  assert.equal(sizeLabel(1.5 * 1024 * 1024), "1.5 MB");
});

test("one component serves both sides, with each page's own CSS prefix", () => {
  const widget = read("features", "livechat", "LiveChatWidget.jsx");
  const admin = read("pages", "admin", "livechat", "ChatConversation.jsx");
  assert.match(widget, /<FileBubble file=\{message\.file\}[^>]*prefix="lcw"/g);
  assert.equal((widget.match(/<FileBubble /g) || []).length, 2, "the patient's files and the team's files");
  assert.match(admin, /<FileBubble file=\{m\.file\}[^>]*prefix="wk"/);
  assert.doesNotMatch(widget, /lcw-file-open|function FileLine/);
  const bubble = read("features", "livechat", "FileBubble.jsx");
  assert.match(bubble, /getUrl\(file, "preview"\)/, "the thumbnail asks for a preview link (not logged)");
  assert.match(bubble, /IntersectionObserver/, "links are asked for lazily");
  assert.match(bubble, /alt="Image attachment"/, "the file name (which can reveal health information) is not the alt text");
  assert.match(bubble, /onError=\{onImageError\}/);
  assert.match(bubble, /retried\.current/, "an expired link gets one new link, then the card");
});

test("open and download are logged purposes; the Archive viewer and the live workspace both wire all three", () => {
  for (const file of ["ChatWorkspace.jsx", "AdminLiveArchive.jsx"]) {
    const page = read("pages", "admin", "livechat", file);
    assert.match(page, /params: \{ purpose \}/, file);
    assert.match(page, /purpose: "download"/, file);
    assert.match(page, /purpose: "open"/, file);
    assert.match(page, /onFileUrl=\{handlers\.fileUrl\}/, file);
    assert.match(page, /onDownloadFile=\{handlers\.downloadFile\}/, file);
  }
  const hook = read("features", "livechat", "useLiveChat.js");
  assert.match(hook, /files\/\$\{encodeURIComponent\(file\.id\)\}\/url\?purpose=/);
  assert.match(hook, /fileUrl,\s+openFile,\s+downloadFile/);
});

test("types and limits are unchanged: pdf, jpg, png, 10 MB (no HEIC)", () => {
  const hook = read("features", "livechat", "useLiveChat.js");
  assert.match(hook, /MAX_FILE_BYTES = 10 \* 1024 \* 1024/);
  assert.match(hook, /FILE_EXTENSIONS = \["pdf", "jpg", "jpeg", "png"\]/);
  assert.doesNotMatch(hook, /heic/i);
});

test("the bubble renders for the team too (wk- classes): picture, PDF card, and a file without an id has no buttons", async () => {
  const { createServer } = await import("vite");
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const server = await createServer({ root: path.resolve(src, ".."), server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  try {
    const { default: FileBubble } = await server.ssrLoadModule("/src/features/livechat/FileBubble.jsx");
    const render = (file) => renderToStaticMarkup(React.createElement(FileBubble, { file, getUrl: async () => "x", onOpen() {}, onDownload() {}, prefix: "wk" }));
    const picture = render({ id: "f1", name: "Scan.png", mime: "image/png", size: 2048 });
    assert.match(picture, /wk-fb wk-fb--image/);
    assert.match(picture, /wk-fb-thumb/);
    assert.match(picture, /Scan\.png/);
    assert.match(picture, />Download</);
    assert.doesNotMatch(picture, /lcw-/);
    const card = render({ id: "f2", name: "Blood test.pdf", mime: "application/pdf", size: 1536 * 1024 });
    assert.match(card, /wk-fb wk-fb--card/);
    assert.match(card, /PDF · 1\.5 MB/);
    assert.match(card, />Open</);
    assert.match(card, />Download</);
    const noId = render({ name: "old.pdf", mime: "application/pdf", size: 10 });
    assert.match(noId, /old\.pdf/);
    assert.doesNotMatch(noId, /<button/);
  } finally {
    await server.close();
  }
});
