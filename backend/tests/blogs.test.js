const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sanitizeBlogHtml, processBlogContent, isBlogImageUrl, estimateReadTime } = require("../utils/blogSanitizer");
const reserved = require("../data/reservedBlogSlugs");

test("sanitizer strips scripts, handlers, iframes and foreign images", () => {
  const out = sanitizeBlogHtml(
    '<h2 onclick="x()">Hi</h2><script>alert(1)</script><iframe src="//e.com"></iframe>' +
      '<p style="color:red">t <a href="javascript:alert(1)">bad</a> <a href="https://ok.com" target="_blank">ok</a></p>' +
      '<img src="https://evil.com/a.png"><img src="/api/blogs/image/a-1.webp" onerror="x()">'
  );
  assert.ok(!/script|iframe|onclick|onerror|style=|javascript:|evil\.com/i.test(out), out);
  assert.match(out, /<a href="https:\/\/ok\.com" target="_blank" rel="noopener noreferrer">ok<\/a>/);
  assert.match(out, /<img src="\/api\/blogs\/image\/a-1\.webp" \/>/);
});

test("h2 ids are generated deterministically with duplicate suffixes", () => {
  const { content, toc } = processBlogContent("<h2>What is it?</h2><p>a</p><h2>What is it?</h2><h2>Cost &amp; Care</h2><h3>sub</h3>");
  assert.deepEqual(toc, [
    { id: "what-is-it", label: "What is it?" },
    { id: "what-is-it-2", label: "What is it?" },
    { id: "cost-care", label: "Cost & Care" },
  ]);
  assert.match(content, /<h2 id="what-is-it">/);
  assert.match(content, /<h2 id="cost-care">/);
  assert.ok(!/<h3 id/.test(content));
  assert.equal(processBlogContent(content).content, content, "re-saving is stable");
});

test("blog image url validation", () => {
  assert.ok(isBlogImageUrl("/api/blogs/image/x.webp"));
  assert.ok(isBlogImageUrl("https://api.site.com/api/blogs/image/x.webp"));
  assert.ok(!isBlogImageUrl("/api/uploads/patients/x.webp"));
  assert.ok(!isBlogImageUrl("/api/blogs/image/../x.webp"));
  assert.ok(!isBlogImageUrl("https://evil.com/a.png"));
});

test("read time estimate", () => {
  assert.equal(estimateReadTime("<p>" + "word ".repeat(400) + "</p>"), 2);
  assert.equal(estimateReadTime(""), 1);
});

test("reserved slugs cover every static single-segment route in App.jsx", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../frontend/src/App.jsx"), "utf8");
  const routes = [...app.matchAll(/path="\/([^"\/*:]+)"/g)].map((m) => m[1].toLowerCase());
  const missing = routes.filter((r) => !reserved.has(r));
  assert.deepEqual(missing, [], "add new App.jsx routes to data/reservedBlogSlugs.js");
});

test("image proxy filename filter blocks traversal and non-images", () => {
  const re = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.(jpe?g|png|webp|gif)$/i;
  for (const bad of ["../uploads/x.png", "..%2fx.png", "a/b.png", "x.svg", "x.png.exe", ".htaccess", "x"]) {
    assert.ok(!re.test(bad), bad);
  }
  assert.ok(re.test("cover-1700000-ab12cd34.webp"));
});

test("search catalog reads only published blogs from the Blog model", async () => {
  const { buildSearchCatalog } = require("../services/search/searchCatalog");
  let seenFilter = null;
  const rows = [
    { _id: "b1", slug: "new-post", title: "New Post", excerpt: "About sleep", readTime: 3 },
    { _id: "b2", slug: "what-is-telemedicine", title: "What Is Telemedicine?", excerpt: "Remote care", readTime: 5 },
  ];
  const chain = (data) => ({ select: () => chain(data), sort: () => chain(data), lean: async () => data });
  const emptyModel = { find: () => chain([]), aggregate: async () => [], collection: { name: "x" } };
  const catalog = await buildSearchCatalog({
    HealthcareCategory: emptyModel,
    HealthcareSpecialty: emptyModel,
    HealthcareCondition: emptyModel,
    Enrollment: emptyModel,
    Doctor: emptyModel,
    Blog: { find: (filter) => { seenFilter = filter; return chain(rows); } },
  });
  assert.deepEqual(seenFilter, { status: "published" });
  assert.deepEqual(catalog.blogs.map((b) => b.path), ["/new-post", "/what-is-telemedicine"]);
  assert.equal(catalog.blogs[0].description, "About sleep");
});

test("legacy seed data: unique slugs, entry 6 has its own slug and is not published", () => {
  const legacy = require("../data/legacyBlogs");
  assert.equal(legacy.length, 15);
  assert.equal(new Set(legacy.map((b) => b.slug)).size, 15);
  const six = legacy.find((b) => b.legacyOrder === 6);
  assert.equal(six.slug, "how-to-choose-the-best-telemedicine-provider");
  assert.ok(six.noDetailPage);
  assert.ok(legacy.every((b) => b.title && b.excerpt && b.imageFile));
});
