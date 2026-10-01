const fs = require("fs");
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "..", process.env.NODE_ENV === "production" ? ".env.production" : ".env"),
});

const { PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const connectDB = require("../config/db");
const { s3Client, getBucketName } = require("../config/s3");
const Blog = require("../models/Blog");
const legacyBlogs = require("../data/legacyBlogs");
const { BLOG_IMAGE_URL_PREFIX } = require("../utils/blogSanitizer");

// Migrates the 15 original hand-built articles into the Blog collection
// (isLegacy: true) so they keep appearing on /blogs at their existing URLs.
//
//   node scripts/seedBlogs.js            # seed
//   node scripts/seedBlogs.js --dry-run  # show what would happen
//
// Idempotent: existing documents are never overwritten ($setOnInsert), so
// edits made later in the Super Admin panel survive a re-run. Cover images are
// uploaded once to S3 under blog-images/.
const IMAGE_DIR = path.resolve(__dirname, "../../frontend/src/assets/BlogImages");
const DRY_RUN = process.argv.includes("--dry-run");

async function objectExists(Key) {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: getBucketName(), Key }));
    return true;
  } catch (err) {
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

async function uploadCover(imageFile) {
  // Lowercased, flat filename that satisfies the image proxy's filename filter.
  const filename = `legacy-${imageFile.toLowerCase()}`;
  const Key = `blog-images/${filename}`;
  if (!DRY_RUN && !(await objectExists(Key))) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: getBucketName(),
        Key,
        Body: fs.readFileSync(path.join(IMAGE_DIR, imageFile)),
        ContentType: "image/webp",
      })
    );
    console.log(`  uploaded ${Key}`);
  }
  return `${BLOG_IMAGE_URL_PREFIX}${filename}`;
}

async function seed() {
  if (!DRY_RUN) await connectDB();
  const seededAt = new Date();
  let created = 0;
  let skipped = 0;

  for (const item of legacyBlogs) {
    const coverImage = await uploadCover(item.imageFile);
    // Entry 6 has no article page yet; publishing it would link to a 404.
    const status = item.noDetailPage ? "draft" : "published";
    console.log(`${DRY_RUN ? "[dry-run] " : ""}${item.legacyOrder}. /${item.slug} -> ${status}`);
    if (DRY_RUN) continue;

    const result = await Blog.updateOne(
      { slug: item.slug },
      {
        $setOnInsert: {
          slug: item.slug,
          title: item.title,
          excerpt: item.excerpt,
          coverImage,
          readTime: item.readTime,
          content: "",
          toc: [],
          category: "",
          tags: [],
          status,
          publishedAt: status === "published" ? seededAt : null,
          isLegacy: true,
          legacyOrder: item.legacyOrder,
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount) created += 1;
    else skipped += 1;
  }

  console.log(`Done. Created ${created}, already present ${skipped}.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
