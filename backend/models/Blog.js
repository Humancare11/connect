const mongoose = require("mongoose");

// A blog post. Posts created in the Super Admin panel carry sanitized HTML in
// `content`. The original hand-built articles are `isLegacy: true`: only their
// listing metadata lives here, the article body stays in its React component
// and keeps its original URL (/<slug>).
const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    coverImage: { type: String, default: "" },
    excerpt: { type: String, default: "", trim: true, maxlength: 1000 },
    // Sanitized HTML (see utils/blogSanitizer.js). h2 elements carry stable ids.
    content: { type: String, default: "" },
    // Table of contents derived from the h2 headings at save time.
    toc: [{ _id: false, id: String, label: String }],
    category: { type: String, default: "", trim: true, maxlength: 80 },
    tags: [{ type: String, trim: true, maxlength: 50 }],
    // FAQ accordion shown below the article. `answer` is sanitized simple HTML
    // (see sanitizeFaqs in utils/blogSanitizer.js), `question` is plain text.
    faqs: [{ _id: false, question: { type: String, maxlength: 300 }, answer: { type: String, maxlength: 6000 } }],
    readTime: { type: Number, default: null, min: 1, max: 120 },
    metaTitle: { type: String, default: "", trim: true, maxlength: 200 },
    metaDescription: { type: String, default: "", trim: true, maxlength: 400 },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    publishedAt: { type: Date, default: null },
    isLegacy: { type: Boolean, default: false, index: true },
    // Legacy list order (the original array position); null for new posts.
    legacyOrder: { type: Number, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

blogSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model("Blog", blogSchema);
