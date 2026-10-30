import { slugify } from "./slug.js";

// Convert the database-owned appointment tree into the shape the booking UI uses.
export function normalizeAppointmentTree(tree) {
  return (Array.isArray(tree) ? tree : []).map((category) => ({
    id: category._id,
    pricingSlug: category.pricingSlug || "",
    icon: category.icon || "stethoscope",
    label: category.name || "Untitled Category",
    description: category.description || "",
    price: Number.isFinite(Number(category.price)) ? Number(category.price) : 0,
    currency: category.currency || "USD",
    specialties: (Array.isArray(category.specialties)
      ? category.specialties
      : []
    ).map((specialty) => ({
      id: specialty._id,
      name: specialty.name || "Untitled Specialty",
      icon: specialty.icon || "stethoscope",
      conditions: (Array.isArray(specialty.conditions)
        ? specialty.conditions
        : []
      ).map((condition) => [
        condition.name || "Untitled Condition",
        condition.icon || "stethoscope",
        condition._id,
        condition.description || "",
      ]),
    })),
  }));
}

// Whether a stored selection (from the router state or the sessionStorage booking) is the one the URL names. A stale selection left by
// an earlier booking must never be shown for another category / specialty / condition: the URL wins.
export function selectionMatchesRoute(selection, { categorySlug, specialtySlug, conditionSlug }) {
  if (!selection) return false;
  if (!categorySlug || !specialtySlug || !conditionSlug) return true; // not a URL-addressed page: nothing to compare
  if (selection.isServiceBooking) return false;
  return (
    slugify(selection.catLabel || "") === categorySlug &&
    slugify(selection.specName || "") === specialtySlug &&
    (slugify(selection.condName || "") === conditionSlug ||
      (conditionSlug === "general-consultation" && selection.condName === "General Consultation"))
  );
}

// The booking selection for a shared / refreshed /appointment-booking/:category/:specialty/:condition link, worked out from the
// normalized tree (null when a segment matches nothing). `cost` is the effective USD price the tree carries; `pricingSlug` is the key of
// the public price table, which is how the page finds the EUR / GBP / INR price for the visitor.
export function selectionFromUrl(tree, { categorySlug, specialtySlug, conditionSlug }) {
  const cat = (tree || []).find((c) => slugify(c.label) === categorySlug);
  const spec = cat?.specialties.find((s) => slugify(s.name) === specialtySlug);
  if (!cat || !spec) return null;
  let condName = null;
  let condIco = null;
  if (conditionSlug === "general-consultation") {
    condName = "General Consultation";
    condIco = "stethoscope";
  } else {
    const match = spec.conditions.find(([name]) => slugify(name) === conditionSlug);
    if (match) {
      condName = match[0];
      condIco = match[1];
    }
  }
  if (!condName) return null;
  const price = Number(cat.price);
  const priceAvailable = Number.isFinite(price) && price > 0;
  return {
    specName: spec.name,
    specIco: spec.icon,
    catId: cat.id,
    pricingSlug: cat.pricingSlug || "",
    catLabel: cat.label,
    cost: priceAvailable ? price : undefined,
    currency: cat.currency || "USD",
    condName,
    condIco,
  };
}
