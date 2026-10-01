const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const { randomBytes } = require("crypto");
const Blog = require("../models/Blog");
const reservedSlugs = require("../data/reservedBlogSlugs");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { uploadLimiter } = require("../middleware/rateLimiters");
const { storeUploadInS3 } = require("../utils/uploadStorage");
const {
  BLOG_IMAGE_URL_PREFIX,
  processBlogContent,
  estimateReadTime,
  isBlogImageUrl,
} = require("../utils/blogSanitizer");

const guard = [verifyAdminToken, superAdminOnly];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_EXT_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (IMAGE_EXT_MIME[ext]) return cb(null, true);
    cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed."));
  },
});

function validateSlug(slug) {
  if (!slug || typeof slug !== "string") return "Slug is required.";
  if (slug.length > 100 || !SLUG_RE.test(slug)) {
    return "Slug may contain only lowercase letters, numbers and single hyphens.";
  }
  if (reservedSlugs.has(slug)) return "This slug is reserved by an existing page. Choose another.";
  return null;
}

function cleanString(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((t) => cleanString(t, 50)).filter(Boolean))].slice(0, 20);
}

function readTimeFrom(value, content) {
  const n = parseInt(value, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 120) return n;
  return content ? estimateReadTime(content) : null;
}

// Returns an error message when the post is not complete enough to go live.
function publishProblem(blog) {
  if (!blog.title) return "Title is required to publish.";
  if (!blog.coverImage) return "A cover image is required to publish.";
  if (!blog.excerpt) return "A short description is required to publish.";
  if (!blog.isLegacy && !String(blog.content || "").replace(/<[^>]*>/g, "").trim()) {
    return "Content is required to publish.";
  }
  return null;
}

function adminItem(blog) {
  return {
    _id: blog._id,
    title: blog.title,
    slug: blog.slug,
    status: blog.status,
    isLegacy: !!blog.isLegacy,
    category: blog.category,
    publishedAt: blog.publishedAt,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
    coverImage: blog.coverImage,
  };
}

// GET /api/superadmin/blogs — all posts, newest first, legacy last.
router.get("/", ...guard, async (_req, res) => {
  try {
    const blogs = await Blog.find()
      .select("title slug status isLegacy category publishedAt createdAt updatedAt coverImage")
      .sort({ isLegacy: 1, legacyOrder: 1, createdAt: -1 })
      .lean();
    res.json(blogs.map(adminItem));
  } catch (err) {
    console.error("admin blogs list error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/superadmin/blogs/image — upload a cover or inline image.
router.post("/image", ...guard, uploadLimiter, (req, res) => {
  imageUpload.single("file")(req, res, async (uploadErr) => {
    if (uploadErr) {
      const msg = uploadErr.code === "LIMIT_FILE_SIZE" ? "Image is too large. Maximum size is 5 MB." : uploadErr.message;
      return res.status(400).json({ msg });
    }
    if (!req.file) return res.status(400).json({ msg: "No file uploaded." });
    try {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const { fileTypeFromBuffer } = await import("file-type");
      const detected = await fileTypeFromBuffer(req.file.buffer);
      if (!detected || detected.mime !== IMAGE_EXT_MIME[ext]) {
        return res.status(400).json({ msg: "File content does not match an allowed image type." });
      }
      const base =
        path
          .basename(req.file.originalname, ext)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "image";
      const filename = `${base}-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
      await storeUploadInS3(
        { buffer: req.file.buffer, filename, mimetype: detected.mime, size: req.file.size, originalname: req.file.originalname },
        { userId: req.user.id, role: req.user.role, folderKey: "blog-images" }
      );
      res.json({ url: `${BLOG_IMAGE_URL_PREFIX}${filename}`, name: req.file.originalname });
    } catch (err) {
      console.error("blog image upload error:", err.message);
      res.status(500).json({ msg: "Image could not be stored." });
    }
  });
});

// GET /api/superadmin/blogs/:id — full post for the editor.
router.get("/:id", ...guard, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ msg: "Blog not found." });
    const blog = await Blog.findById(req.params.id).lean();
    if (!blog) return res.status(404).json({ msg: "Blog not found." });
    res.json(blog);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/superadmin/blogs — create (draft by default; status "published" publishes).
router.post("/", ...guard, async (req, res) => {
  try {
    const slug = cleanString(req.body.slug, 100).toLowerCase();
    const slugError = validateSlug(slug);
    if (slugError) return res.status(400).json({ msg: slugError });
    if (await Blog.exists({ slug })) return res.status(409).json({ msg: "A blog with this slug already exists." });

    const title = cleanString(req.body.title, 300);
    if (!title) return res.status(400).json({ msg: "Title is required." });

    const coverImage = cleanString(req.body.coverImage, 500);
    if (coverImage && !isBlogImageUrl(coverImage)) return res.status(400).json({ msg: "Invalid cover image." });

    const { content, toc } = processBlogContent(req.body.content);
    const wantsPublish = req.body.status === "published";

    const blog = new Blog({
      title,
      slug,
      coverImage,
      excerpt: cleanString(req.body.excerpt, 1000),
      content,
      toc,
      category: cleanString(req.body.category, 80),
      tags: cleanTags(req.body.tags),
      readTime: readTimeFrom(req.body.readTime, content),
      metaTitle: cleanString(req.body.metaTitle, 200),
      metaDescription: cleanString(req.body.metaDescription, 400),
      status: "draft",
      isLegacy: false,
      createdBy: req.user.id,
    });

    if (wantsPublish) {
      const problem = publishProblem(blog);
      if (problem) return res.status(400).json({ msg: problem });
      blog.status = "published";
      blog.publishedAt = new Date();
    }

    await blog.save();
    res.status(201).json(blog);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ msg: "A blog with this slug already exists." });
    if (err.name === "ValidationError") return res.status(400).json({ msg: err.message });
    console.error("create blog error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// PUT /api/superadmin/blogs/:id — update; status "published" / "draft" may be sent too.
router.put("/:id", ...guard, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ msg: "Blog not found." });
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ msg: "Blog not found." });

    const body = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    if (blog.isLegacy) {
      // Code-rendered article: slug/body are fixed, only listing metadata is editable.
      if (has("slug") && cleanString(body.slug, 100).toLowerCase() !== blog.slug) {
        return res.status(400).json({ msg: "Legacy articles are managed in code: the slug cannot be changed." });
      }
    } else if (has("slug")) {
      const slug = cleanString(body.slug, 100).toLowerCase();
      if (slug !== blog.slug) {
        const slugError = validateSlug(slug);
        if (slugError) return res.status(400).json({ msg: slugError });
        if (await Blog.exists({ slug, _id: { $ne: blog._id } })) {
          return res.status(409).json({ msg: "A blog with this slug already exists." });
        }
        blog.slug = slug;
      }
    }

    if (has("title")) {
      const title = cleanString(body.title, 300);
      if (!title) return res.status(400).json({ msg: "Title is required." });
      blog.title = title;
    }
    if (has("excerpt")) blog.excerpt = cleanString(body.excerpt, 1000);
    if (has("coverImage")) {
      const coverImage = cleanString(body.coverImage, 500);
      if (coverImage && !isBlogImageUrl(coverImage)) return res.status(400).json({ msg: "Invalid cover image." });
      blog.coverImage = coverImage;
    }
    if (has("category")) blog.category = cleanString(body.category, 80);
    if (has("metaTitle")) blog.metaTitle = cleanString(body.metaTitle, 200);
    if (has("metaDescription")) blog.metaDescription = cleanString(body.metaDescription, 400);

    if (!blog.isLegacy) {
      if (has("tags")) blog.tags = cleanTags(body.tags);
      if (has("content")) {
        const { content, toc } = processBlogContent(body.content);
        blog.content = content;
        blog.toc = toc;
      }
    }
    if (has("readTime") || (!blog.isLegacy && has("content"))) {
      blog.readTime = readTimeFrom(body.readTime, blog.content);
    }

    if (has("status")) {
      if (!["draft", "published"].includes(body.status)) return res.status(400).json({ msg: "Invalid status." });
      if (body.status === "published" && blog.status !== "published") {
        const problem = publishProblem(blog);
        if (problem) return res.status(400).json({ msg: problem });
        blog.status = "published";
        if (!blog.publishedAt) blog.publishedAt = new Date();
      } else if (body.status === "draft") {
        blog.status = "draft";
      }
    } else if (blog.status === "published") {
      // Editing a live post must not leave it incomplete.
      const problem = publishProblem(blog);
      if (problem) return res.status(400).json({ msg: problem });
    }

    await blog.save();
    res.json(blog);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ msg: "A blog with this slug already exists." });
    if (err.name === "ValidationError") return res.status(400).json({ msg: err.message });
    console.error("update blog error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// PATCH /api/superadmin/blogs/:id/status — publish / unpublish toggle.
router.patch("/:id/status", ...guard, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ msg: "Blog not found." });
    const status = req.body?.status;
    if (!["draft", "published"].includes(status)) return res.status(400).json({ msg: "Invalid status." });
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ msg: "Blog not found." });

    if (status === "published") {
      const problem = publishProblem(blog);
      if (problem) return res.status(400).json({ msg: problem });
      if (!blog.publishedAt) blog.publishedAt = new Date();
    }
    blog.status = status;
    await blog.save();
    res.json(adminItem(blog));
  } catch (err) {
    console.error("blog status error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// DELETE /api/superadmin/blogs/:id — legacy articles cannot be deleted.
router.delete("/:id", ...guard, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ msg: "Blog not found." });
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ msg: "Blog not found." });
    if (blog.isLegacy) {
      return res.status(400).json({ msg: "Legacy articles are managed in code and cannot be deleted. Unpublish it instead." });
    }
    await blog.deleteOne();
    res.json({ msg: "Blog deleted." });
  } catch (err) {
    console.error("delete blog error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
