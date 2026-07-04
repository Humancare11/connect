// src/utils/search.js
import Fuse from "fuse.js";
import searchIndex, { conditions } from "../data/searchIndex.js";

// Configure Fuse.js for fuzzy matching with spelling mistakes
const fuse = new Fuse(searchIndex, {
  keys: [
    { name: "title", weight: 0.4 },
    { name: "keywords", weight: 0.6 },
  ],
  threshold: 0.5, // Increased from 0.38 to allow more fuzzy matches (0.0 = perfect match, 1.0 = match anything)
  distance: 200, // Increased from 100 to allow matches further apart in longer strings
  ignoreLocation: true, // match anywhere in the string, not just near the start
  includeScore: true,
  minMatchCharLength: 2, // Reduced from 3 to allow shorter query terms
  shouldSort: true, // Sort results by relevance score
  findAllMatches: false, // Stop at first match to improve performance
  isCaseSensitive: false, // Case-insensitive matching (already default, but explicit)
  ignoreFieldNorm: false, // Consider field length in scoring
});

export function searchTreatments(query) {
  const q = query.trim();
  if (!q) return { directHits: [], conditions: [] };

  const fuseResults = fuse.search(q);

  const directHits = [];
  const resultConditions = new Map();

  fuseResults.forEach(({ item }) => {
    if (item.type === "condition") {
      resultConditions.set(item.id, item);
    } else {
      directHits.push(item);
      const children = conditions.filter((c) =>
        item.type === "category"
          ? c.category === item.id
          : c.specialty === item.id,
      );
      children.forEach((c) => resultConditions.set(c.id, c));
    }
  });

  return { directHits, conditions: Array.from(resultConditions.values()) };
}