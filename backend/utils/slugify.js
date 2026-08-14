// Converts a string into a URL/key-safe slug: lowercase letters, digits,
// and hyphens only, with no leading/trailing or duplicate hyphens.
function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

module.exports = { slugify };
