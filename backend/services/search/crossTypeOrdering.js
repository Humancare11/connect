// Cross-type result ordering (PR 9).
//
// The deterministic matcher scores every type independently and returns
// per-type lists; nothing orders ACROSS types. The client used to flatten the
// groups in a fixed order (categories, specialties, conditions, services,
// doctors, blogs), so a broad parent (General Physician) always opened before
// the specific page the patient asked for (Fever).
//
// This module produces the final flat order. It does NOT touch matcher scores:
//   1. start from the baseline order the client always used (group order,
//      relevance order inside each group);
//   2. apply one narrow parent/child specificity rule (below);
//   3. leave everything else - unrelated results, services, doctors, blogs -
//      exactly where the baseline put them.
//
// Rule 0 (weak parents): a category/specialty that matched ONLY through its
// description text (e.g. the "Chronic Care" category, whose description lists
// "Cardiology") or only partially (score < 70, e.g. one word of its name) goes
// behind the categories/specialties with a stronger name/alias/intent match, so
// searching "cardiology" opens Cardiology, not the category, and "I want an eye
// doctor" opens Ophthalmology, not "Eye, Ear & Bone". It only applies when a
// strong (>= 70) non-description match exists.
//
// Rule 0b (AI-chosen specialty): when the AI query-understanding layer chose a
// specialty (matchedOn "intent") and its own category matched only by the typed
// words with a lower score, the specialty the AI picked goes before that
// broader category. Ordinary typed searches are not affected.
//
// Rule 1: a CONDITION moves ahead of a specialty/category `a` when
//   - it is relevant in its own right (score >= MIN_PROMOTION_SCORE), and
//   - `a` is its parent specialty or that specialty's category, OR `a` is a
//     specialty that matched only through an alias (a symptom/abbreviation
//     alias such as "headache" on Neurology) or was chosen by the AI
//     query-understanding layer (matchedOn "intent"), and
//   - it is at least as strong as `a` (`>=` when `a` matched via an alias,
//     strictly `>` when `a` matched by its own name).
// The strictness for name matches means an exact specialty/category search
// ("cardiology", "women's health") can never be displaced by one of its
// conditions. Services are not conditions and are never promoted. When a
// condition is promoted over both its specialty and category, the specialty
// is placed before the category unless the category scores higher.

const GROUP_ORDER = ["category", "specialty", "condition", "service", "doctor", "blog"];
const MIN_PROMOTION_SCORE = 60;
// Below the whole-word-prefix level (70) a category/specialty match is partial
// (e.g. the word "eye" inside "Eye, Ear & Bone" for "I want an eye doctor").
const STRONG_PARENT_SCORE = 70;

// Chosen by the AI query-understanding layer (validated intent), either as the
// match itself or as a confirmation of an equally strong literal match.
const isAiChosen = (match) => match.matchedOn === "intent" || match.aiChosen === true;
const isTaxonomyParent = (match) => match.type === "specialty" || match.type === "category";

function isAncestor(condition, parent, catalog) {
  if (parent.type === "specialty") return condition.record.specialtyId === parent.record._id;
  const specialty = catalog.index?.specialtyById?.[condition.record.specialtyId];
  return Boolean(specialty) && specialty.categoryId === parent.record._id;
}

// Does `condition` deserve to precede the specialty/category match `parent`?
function outranks(condition, parent, catalog) {
  if (condition.score < MIN_PROMOTION_SCORE) return false;
  // A specialty that matched through an alias, or that the AI query-understanding layer
  // chose ("intent"), is a symptom-level / related specialty, not an exact name search.
  const relatedSpecialty = parent.type === "specialty" && (parent.matchedOn === "alias" || isAiChosen(parent));
  const related = isAncestor(condition, parent, catalog) || relatedSpecialty;
  if (!related) return false;
  return parent.matchedOn === "name" ? condition.score > parent.score : condition.score >= parent.score;
}

// Rule 0. Stable: relative order inside each part is unchanged.
function withWeakParentsLast(baseline) {
  const isWeak = (match) => isTaxonomyParent(match) && (match.matchedOn === "description" || match.score < STRONG_PARENT_SCORE);
  const hasStrong = baseline.some((match) => isTaxonomyParent(match) && !isWeak(match));
  if (!hasStrong) return baseline;
  const parents = baseline.filter(isTaxonomyParent);
  const rest = baseline.filter((match) => !isTaxonomyParent(match));
  return [...parents.filter((m) => !isWeak(m)), ...parents.filter(isWeak), ...rest];
}

// Rule 0b. Stable apart from moving each AI-chosen specialty ahead of its category.
function aiSpecialtiesBeforeCategory(list, catalog) {
  const out = [...list];
  for (const specialty of list.filter((m) => m.type === "specialty" && isAiChosen(m))) {
    const categoryId = catalog.index?.specialtyById?.[specialty.record._id]?.categoryId;
    const category = out.find((m) => m.type === "category" && m.record._id === categoryId);
    if (category && !isAiChosen(category) && specialty.score >= category.score && out.indexOf(category) < out.indexOf(specialty)) {
      out.splice(out.indexOf(specialty), 1);
      out.splice(out.indexOf(category), 0, specialty);
    }
  }
  return out;
}

// matches: { category: [...], specialty: [...], ... } (each already ranked).
// Returns the flat list of match objects in final order.
function orderAcrossTypes(matches, catalog) {
  const baseline = aiSpecialtiesBeforeCategory(withWeakParentsLast(GROUP_ORDER.flatMap((type) => matches[type] || [])), catalog);
  const parents = baseline.filter(isTaxonomyParent);
  if (!parents.length) return baseline;

  // Which parents each condition overtakes, and where it should be inserted.
  const promoted = new Map(); // condition match -> { overtaken, anchor }
  for (const condition of matches.condition || []) {
    const overtaken = parents.filter((parent) => outranks(condition, parent, catalog));
    if (overtaken.length) promoted.set(condition, { overtaken, anchor: Math.min(...overtaken.map((p) => baseline.indexOf(p))) });
  }
  if (!promoted.size) return baseline;

  // Rebuild: promoted conditions are emitted just before their earliest
  // overtaken parent (in their own relevance order); all else keeps its place.
  const ordered = [];
  baseline.forEach((match, index) => {
    for (const [condition, { anchor }] of promoted) if (anchor === index) ordered.push(condition);
    if (!promoted.has(match)) ordered.push(match);
  });

  // Specialty before its category when the specialty is at least as relevant.
  for (const { overtaken } of promoted.values()) {
    const specialty = overtaken.find((m) => m.type === "specialty");
    const category = overtaken.find((m) => m.type === "category");
    if (specialty && category && ordered.indexOf(category) < ordered.indexOf(specialty) && specialty.score >= category.score) {
      ordered.splice(ordered.indexOf(specialty), 1);
      ordered.splice(ordered.indexOf(category), 0, specialty);
    }
  }
  return ordered;
}

module.exports = { orderAcrossTypes, outranks, MIN_PROMOTION_SCORE, GROUP_ORDER };
