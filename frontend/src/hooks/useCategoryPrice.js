import { useLocation } from "react-router-dom";
import { usePrices } from "../context/PricingContext";

/**
 * Maps each public condition/specialty URL path to its parent category ID.
 * Category IDs match the keys in CategoryPricing (backend model).
 */
const URL_CATEGORY_MAP = {
  // ── General & Everyday Care ──────────────────────────────────
  "/dehydration": "general",
  "/vomiting": "general",

  // ── Mental Health ─────────────────────────────────────────────
  "/sleep-hygiene": "mental",
  "/mood-anxiety-teens": "mental",

  // ── Skin & Hair ───────────────────────────────────────────────
  // (no dedicated condition pages currently)

  // ── Women's Health ────────────────────────────────────────────
  "/pregnancy-nutrition": "women",

  // ── Children & Family ─────────────────────────────────────────
  "/childhood-allergies": "family",
  "/ear-pain-children": "family",
  "/feeding-concerns": "family",
  "/growth-development": "family",
  "/mild-asthma-symptoms": "family",
  "/pediatric-cold-flu": "family",
  "/pediatric-fever": "family",
  "/pink-eye-children": "family",
  "/puberty-concerns": "family",
  "/skin-rash-children": "family",
  "/sore-throat-children": "family",
  "/stomach-pain-children": "family",
  "/vomiting-diarrhea-children": "family",
  "/child-family-care": "family",

  // ── Weight & Nutrition ────────────────────────────────────────
  "/obesity": "weight",
  "/binge-eating": "weight",
  "/cholesterol-lowering-diet": "weight",
  "/diabetic-diet": "weight",
  "/diet-exercise-planning": "weight",
  "/food-intolerance-planning": "weight",
  "/glp-program-eligibility": "weight",
  "/healthy-habit-coaching": "weight",
  "/metabolic-syndrome": "weight",
  "/sports-nutrition": "weight",
  "/weight-loss-planning": "weight",

  // ── Chronic Care & Expert Opinion ─────────────────────────────
  "/cancer-second-opinion": "chronic",
  "/chest-pain": "chronic",
  "/chronic-kidney-disease": "chronic",
  "/chronic-migraine": "chronic",
  "/complex-diagnosis": "chronic",
  "/fatty-liver": "chronic",
  "/heart-disease": "chronic",
  "/high-blood-pressure": "chronic",
  "/high-cholesterol": "chronic",
  "/hormone-imblance": "chronic",
  "/memory-concerns": "chronic",
  "/numbness-tingling": "chronic",
  "/osteoporosis": "chronic",
  "/palpitations": "chronic",
  "/post-covid-concerns": "chronic",
  "/pre-op-cardiac-clearance": "chronic",
  "/seizures-epilepsy-follow-up": "chronic",
  "/sleep-apnea": "chronic",
  "/surgery-second-opinion": "chronic",
  "/thyroid-disorders": "chronic",
  "/treatment-plan-review": "chronic",
  "/tremor": "chronic",
  "/type-2-diabetes": "chronic",
  "/abdominal-pain": "chronic",
  "/bloating": "chronic",
  "/gastritis": "chronic",
  "/hemorrhoids": "chronic",
  "/indigestion": "chronic",
  "/irritable-bowel-syndrome": "chronic",

  // ── Eye, Ear & Bone ───────────────────────────────────────────
  "/arthritis": "eeb",
  "/back-pain": "eeb",
  "/dry-eyes": "eeb",
  "/ear-infection": "eeb",
  "/ear-pain": "eeb",
  "/eye-redness": "eeb",
  "/eye-strain": "eeb",
  "/hoarseness": "eeb",
  "/joint-pain": "eeb",
  "/knee-pain": "eeb",
  "/muscle-strain": "eeb",
  "/nasal-congestion": "eeb",
  "/neck-pain": "eeb",
  "/osteoarthritis": "eeb",
  "/rheumatoid-arthritis": "eeb",
  "/sports-injuries": "eeb",
  "/stye": "eeb",
  "/swollen-feet-ankles": "eeb",
  "/tonsillitis": "eeb",
  "/vision-changes": "eeb",

  // ── Travel & Global Care ──────────────────────────────────────
  "/travelers-diarrhea": "travel",

  // ── Specialty demos ───────────────────────────────────────────
  "/sp-demo": "general",
};

/**
 * Returns the price (number) for the current page's category,
 * or null while prices are still loading.
 *
 * For the AppointmentBooking tree, pass an explicit categoryId instead.
 */
export function useCategoryPrice(categoryId) {
  const location = useLocation();
  const prices = usePrices();

  const resolvedId = categoryId ?? URL_CATEGORY_MAP[location.pathname];
  if (!resolvedId || !prices) return null;
  return prices[resolvedId]?.price ?? null;
}
