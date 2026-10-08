const express = require("express");
const router = express.Router();
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { Readable } = require("stream");
const Blog = require("../models/Blog");
const { s3Client, getBucketName } = require("../config/s3");
const { blogPublicLimiter, blogImageLimiter } = require("../middleware/rateLimiters");

const BLOG_IMAGE_S3_PREFIX = "blog-images/";
const DEFAULT_LIMIT = 9;
const MAX_LIMIT = 24;

// Flat filenames only: letters, digits, dot, dash, underscore. No slashes, so
// the S3 key can never leave the blog-images/ prefix (no path traversal, no
// access to any other upload). Extension must be a web image type.
const BLOG_IMAGE_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.(jpe?g|png|webp|gif)$/i;
const IMAGE_CONTENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function listItem(blog) {
  return {
    id: String(blog._id),
    slug: blog.slug,
    title: blog.title,
    description: blog.excerpt,
    image: blog.coverImage,
    path: `/${blog.slug}`,
    readTime: blog.readTime || undefined,
    category: blog.category || "",
    isLegacy: !!blog.isLegacy,
  };
}

// GET /api/blogs/image/:file — public proxy for blog images ONLY.
router.get("/image/:file", blogImageLimiter, async (req, res) => {
  const file = String(req.params.file || "");
  if (!BLOG_IMAGE_FILE_RE.test(file) || file.includes("..")) {
    return res.status(404).json({ msg: "Image not found." });
  }
  try {
    const object = await s3Client.send(
      new GetObjectCommand({ Bucket: getBucketName(), Key: `${BLOG_IMAGE_S3_PREFIX}${file}` })
    );
    const ext = file.split(".").pop().toLowerCase();
    res.setHeader("Content-Type", IMAGE_CONTENT_TYPES[ext] || "application/octet-stream");
    if (object.ContentLength) res.setHeader("Content-Length", object.ContentLength);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    // Overrides the blanket /api no-store and helmet's same-origin CORP: these
    // are public images embedded from the SPA origin.
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    const body = object.Body instanceof Readable ? object.Body : Readable.from(object.Body);
    body.on("error", () => res.destroy());
    body.pipe(res);
  } catch (err) {
    if (err?.name === "NoSuchKey" || err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ msg: "Image not found." });
    }
    console.error("blog image proxy error:", err.message);
    return res.status(500).json({ msg: "Could not load image." });
  }
});

// GET /api/blogs?page=&limit=&search= — published posts only.
router.get("/", blogPublicLimiter, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";

    const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 80) : "";

    const filter = { status: "published" };
    if (category) filter.category = category;
    if (search) {
      const rx = new RegExp(escapeRegExp(search), "i");
      filter.$or = [{ title: rx }, { excerpt: rx }];
    }

    const total = await Blog.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, totalPages);

    // New posts first (newest first), then the legacy articles in their
    // original list order.
    const blogs = await Blog.find(filter)
      .select("slug title excerpt coverImage readTime category isLegacy")
      .sort({ isLegacy: 1, legacyOrder: 1, publishedAt: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ blogs: blogs.map(listItem), page: currentPage, limit, total, totalPages });
  } catch (err) {
    console.error("blogs list error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// GET /api/blogs/:slug — published posts only.
router.get("/:slug", blogPublicLimiter, async (req, res) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase();
    const blog = await Blog.findOne({ slug, status: "published" }).lean();
    if (!blog) return res.status(404).json({ msg: "Blog not found." });
    res.json({
      ...listItem(blog),
      content: blog.isLegacy ? "" : blog.content,
      toc: blog.toc || [],
      tags: blog.tags || [],
      metaTitle: blog.metaTitle,
      metaDescription: blog.metaDescription,
      publishedAt: blog.publishedAt,
    });
  } catch (err) {
    console.error("blog detail error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
