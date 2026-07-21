// searchRoutes.js
const Fuse = require("fuse.js");

const CATEGORY_ALIASES = {
  // Mental Health
  "mental": "Mental & Behavioral Health",
  "mental health": "Mental & Behavioral Health",
  "anxiety": "Mental & Behavioral Health",
  "depression": "Mental & Behavioral Health",
  "stress": "Mental & Behavioral Health",
  "panic": "Mental & Behavioral Health",
  "ptsd": "Mental & Behavioral Health",
  "adhd": "Mental & Behavioral Health",
  "insomnia": "Mental & Behavioral Health",
  "sleep": "Mental & Behavioral Health",
  "burnout": "Mental & Behavioral Health",
  "therapy": "Mental & Behavioral Health",
  "mood": "Mental & Behavioral Health",

  // Skin
  "skin": "Skin Conditions",
  "acne": "Skin Conditions",
  "rash": "Skin Conditions",
  "eczema": "Skin Conditions",
  "psoriasis": "Skin Conditions",
  "hives": "Skin Conditions",
  "hair": "Skin Conditions",
  "dermatology": "Skin Conditions",

  // Joint & Muscle
  "joint": "Eye, Ear & Bone Care",
  "knee": "Eye, Ear & Bone Care",
  "kni": "Eye, Ear & Bone Care",   // ← partial "knee"
  "kne": "Eye, Ear & Bone Care",   // ← partial "knee"
  "back": "Eye, Ear & Bone Care",
  "neck": "Eye, Ear & Bone Care",
  "muscle": "Eye, Ear & Bone Care",
  "pain": "Eye, Ear & Bone Care",
  "bone": "Eye, Ear & Bone Care",
  "spine": "Eye, Ear & Bone Care",
  "ear pain": "Eye, Ear & Bone Care",
  "eye pain": "Eye, Ear & Bone Care",
  "musculoskeletal": "Eye, Ear & Bone Care",

  // Women's Health
  "women": "Women's Health",
  "womens": "Women's Health",
  "pcos": "Women's Health",
  "period": "Women's Health",
  "menopause": "Women's Health",
  "pregnancy": "Women's Health",
  "birth control": "Women's Health",
  "yeast": "Women's Health",
  "vaginal": "Women's Health",

  // Men's Health
  "men": "Men's Health",
  "mens": "Men's Health",
  "testosterone": "Men's Health",
  "erectile": "Men's Health",
  "prostate": "Men's Health",

  // Pediatric
  "child": "Pediatric Care",
  "children": "Pediatric Care",
  "baby": "Pediatric Care",
  "kids": "Pediatric Care",
  "pediatric": "Pediatric Care",
  "toddler": "Pediatric Care",
  "infant": "Pediatric Care",

  // Chronic Care
  "chronic": "Chronic Care",
  "diabetes": "Chronic Care",
  "blood pressure": "Chronic Care",
  "hypertension": "Chronic Care",
  "cholesterol": "Chronic Care",
  "thyroid": "Chronic Care",
  "heart": "Chronic Care",

  // Urinary
  "urinary": "Urinary & Kidney Health",
  "uti": "Urinary & Kidney Health",
  "kidney": "Urinary & Kidney Health",
  "bladder": "Urinary & Kidney Health",
  "urine": "Urinary & Kidney Health",

  // Sexual Health
  "sexual": "Sexual Health",
  "sti": "Sexual Health",
  "std": "Sexual Health",
  "hiv": "Sexual Health",
  "prep": "Sexual Health",

  // Travel
  "travel": "Travel Health",
  "traveler": "Travel Health",
  "motion sickness": "Travel Health",
  "altitude": "Travel Health",
  "jet lag": "Travel Health",

  // Respiratory
  "respiratory": "Respiratory Health",
  "asthma": "Respiratory Health",
  "breathing": "Respiratory Health",
  "copd": "Respiratory Health",
  "wheezing": "Respiratory Health",
  "lung": "Respiratory Health",

  // Digestive
  "digestive": "Digestive Health",
  "stomach": "Digestive Health",
  "gut": "Digestive Health",
  "ibs": "Digestive Health",
  "bloating": "Digestive Health",
  "bowel": "Digestive Health",

  // Everyday Urgent
  "urgent": "Everyday Urgent Care",
  "cold": "Everyday Urgent Care",
  "flu": "Everyday Urgent Care",
  "fever": "Everyday Urgent Care",
  "cough": "Everyday Urgent Care",
  "sore throat": "Everyday Urgent Care",
  "ear infection": "Everyday Urgent Care",
  "pink eye": "Everyday Urgent Care",

  // Prescriptions
  "prescription": "Prescription & Continuity Care",
  "refill": "Prescription & Continuity Care",
  "medication": "Prescription & Continuity Care",
  "doctor note": "Prescription & Continuity Care",
  "sick note": "Prescription & Continuity Care",
  "certificate": "Prescription & Continuity Care",
};

// ── Step 1: detect category from query ───────────────────────────────────────
function detectCategory(query) {
  const q = query.toLowerCase().trim();

  // Check longest aliases first to catch multi-word matches like "mental health"
  const sortedAliases = Object.keys(CATEGORY_ALIASES).sort(
    (a, b) => b.length - a.length
  );

  for (const alias of sortedAliases) {
    if (q.startsWith(alias) || q === alias || q.includes(alias)) {
      return CATEGORY_ALIASES[alias];
    }
  }

  return null;
}

// ── Main search ───────────────────────────────────────────────────────────────
function searchRoutes(query, routes) {
  if (!query || !query.trim()) return [];

  const detectedCategory = detectCategory(query);

  if (detectedCategory) {
    // Filter ONLY to that category
    const categoryRoutes = routes.filter(
      (r) => r.category === detectedCategory
    );

    // If very short/partial query (like "kni", "men", "ski")
    // just return all items from that category
    if (query.trim().length <= 4) {
      return categoryRoutes.slice(0, 6);
    }

    // Longer query → fuzzy search WITHIN that category only
    const fuse = new Fuse(categoryRoutes, {
      keys: [
        { name: "title", weight: 0.6 },
        { name: "keywords", weight: 0.4 },
      ],
      threshold: 0.5,
      ignoreLocation: true,
    });

    const results = fuse.search(query).map((r) => r.item);
    return results.length > 0 ? results.slice(0, 6) : categoryRoutes.slice(0, 6);
  }

  // ── No category detected → strict title-only search ──────────────────────
  // threshold 0.2 = very strict, only close matches
  const fuse = new Fuse(routes, {
    keys: [
      { name: "title", weight: 0.7 },
      { name: "keywords", weight: 0.3 },
    ],
    threshold: 0.2,   // ← strict, no random results
    ignoreLocation: true,
  });

  return fuse.search(query).map((r) => r.item).slice(0, 6);
}

module.exports = searchRoutes;