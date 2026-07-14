import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "../api";

/**
 * Maps each public condition/specialty URL path to its parent category ID.
 */
const URL_CATEGORY_MAP = {
  "/dehydration": "general",
  "/vomiting": "general",
  "/sleep-hygiene": "mental",
  "/mood-anxiety-teens": "family",
  "/pregnancy-nutrition": "women",
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
  "/travelers-diarrhea": "travel",
  "/sp-demo": "general",
};

/** categoryId → exact HealthcareCategory.name in the DB (must match appointment-tree's `name` field) */
const CATEGORY_ID_TO_NAME = {
  general: "General & Everyday Care",
  mental: "Mental Health",
  skin: "Skin & Hair",
  women: "Women's Health",
  men: "Men's Health",
  family: "Children & Family",
  weight: "Weight & Nutrition",
  chronic: "Chronic Care & Expert Opinion",
  eeb: "Eye, Ear & Bone",
  sexual: "Sexual Health",
  travel: "Travel & Global Care",
};

/**
 * Returns the live price (number) for the current page's category,
 * fetched directly from /api/appointment-tree — the same source
 * the category pages already use. Self-contained: no provider needed.
 */
export function useCategoryPrice(categoryId) {
  const location = useLocation();
  const [price, setPrice] = useState(null);

  const resolvedId = categoryId ?? URL_CATEGORY_MAP[location.pathname];

  useEffect(() => {
    if (!resolvedId) return;
    let cancelled = false;

    const fetchPrice = async () => {
      try {
        const res = await api.get("/api/appointment-tree");
        const categoryName = CATEGORY_ID_TO_NAME[resolvedId];
        const category = res.data.find((item) => item.name === categoryName);
        if (!cancelled && category && category.price !== undefined) {
          setPrice(category.price);
        }
      } catch (err) {
        console.error("Failed to fetch pricing:", err);
      }
    };

    fetchPrice();
    const intervalId = window.setInterval(fetchPrice, 30000);
    window.addEventListener("focus", fetchPrice);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", fetchPrice);
    };
  }, [resolvedId]);

  return price;
}