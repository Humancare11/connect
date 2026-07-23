import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "../api";

/**
 * Maps each public condition/specialty URL path to its parent category ID.
 */
const URL_CATEGORY_MAP = {
  "/dehydration": "general",
  "/vomiting": "general",
  "/weight-and-nurtrition/lifestyle-medicine/sleep-hygiene": "mental",
  "/child-and-family-care/adolescent-medicine/mood-anxiety-teens": "family",
  "/weight-and-nurtrition/nutrition-and-dietetics/pregnancy-nutrition": "women",
  "/childhood-allergies": "family",
  "/child-and-family-care/pediatrics/ear-pain-children": "family",
  "/child-and-family-care/pediatrics/feeding-concerns": "family",
  "/growth-development": "family",
  "/mild-asthma-symptoms": "family",
  "/child-and-family-care/pediatrics/pediatric-cold-flu": "family",
  "/child-and-family-care/pediatrics/pediatric-fever": "family",
  "/pink-eye-children": "family",
  "/child-and-family-care/adolescent-medicine/puberty-concerns": "family",
  "/child-and-family-care/pediatrics/skin-rash-in-children": "family",
  "/sore-throat-children": "family",
  "/stomach-pain-children": "family",
  "/vomiting-diarrhea-children": "family",
  "/child-family-care": "family",
  "/weight-and-nurtrition/weight-management/obesity": "weight",
  "/weight-and-nurtrition/weight-management/binge-eating": "weight",
  "/weight-and-nurtrition/nutrition-and-dietetics/cholesterol-lowering-diet": "weight",
  "/weight-and-nurtrition/nutrition-and-dietetics/diabetic-diet": "weight",
  "/weight-and-nurtrition/lifestyle-medicine/diet-and-exercise-planning": "weight",
  "/weight-and-nurtrition/nutrition-and-dietetics/food-intolerance-planning": "weight",
  "/glp-program-eligibility": "weight",
  "/weight-and-nurtrition/lifestyle-medicine/healthy-habit-coaching": "weight",
  "/metabolic-syndrome": "weight",
  "/weight-and-nurtrition/nutrition-and-dietetics/sports-nutrition": "weight",
  "/weight-and-nurtrition/weight-management/weight-loss-planning": "weight",
  "/online-second-medical-opinion/cancer-second-opinion": "chronic",
  "/chronic-care/cardiology/chest-pain": "chronic",
  "/chronic-kidney-disease": "chronic",
  "/chronic-care/neurology/chronic-migraine": "chronic",
  "/online-second-medical-opinion/complex-diagnosis-review": "chronic",
  "/chronic-care/gastroenterology/fatty-liver": "chronic",
  "/heart-disease": "chronic",
  "/chronic-care/cardiology/high-blood-pressure": "chronic",
  "/chronic-care/cardiology/high-cholesterol": "chronic",
  "/hormone-imblance": "chronic",
  "/chronic-care/neurology/memory-concerns": "chronic",
  "/chronic-care/neurology/numbness-and-tingling": "chronic",
  "/chronic-care/endocrinology/osteoporosis": "chronic",
  "/chronic-care/cardiology/palpitations": "chronic",
  "/chronic-care/pulmonology/post-covid-concerns": "chronic",
  "/chronic-care/cardiology/pre-op-cardiac-clearance": "chronic",
  "/chronic-care/neurology/seizures-epilepsy-follow-up": "chronic",
  "/chronic-care/pulmonology/sleep-apnea-screening": "chronic",
  "/online-second-medical-opinion/surgery-second-opinion": "chronic",
  "/chronic-care/endocrinology/thyroid-disorders": "chronic",
  "/online-second-medical-opinion/treatment-plan-review": "chronic",
  "/chronic-care/neurology/tremor": "chronic",
  "/chronic-care/endocrinology/type-2-diabetes": "chronic",
  "/chronic-care/gastroenterology/abdominal-pain": "chronic",
  "/chronic-care/gastroenterology/bloating": "chronic",
  "/gastritis": "chronic",
  "/hemorrhoids": "chronic",
  "/indigestion": "chronic",
  "/chronic-care/gastroenterology/irritable-bowel-syndrome": "chronic",
  "/eye-ear-bone/orthopedics/arthritis": "eeb",
  "/eye-ear-bone/orthopedics/back-pain": "eeb",
  "/eye-ear-bone/ophthalmology/dry-eyes": "eeb",
  "/eye-ear-bone/ear-nose-throat/ear-infection": "eeb",
  "/eye-ear-bone/ear-nose-throat/ear-pain": "eeb",
  "/eye-ear-bone/ophthalmology/eye-redness": "eeb",
  "/eye-ear-bone/ophthalmology/eye-strain": "eeb",
  "/eye-ear-bone/ear-nose-throat/hoarseness": "eeb",
  "/joint-pain": "eeb",
  "/eye-ear-bone/orthopedics/knee-pain": "eeb",
  "/eye-ear-bone/orthopedics/muscle-strain": "eeb",
  "/eye-ear-bone/ear-nose-throat/nasal-congestion": "eeb",
  "/eye-ear-bone/orthopedics/neck-pain": "eeb",
  "/eye-ear-bone/orthopedics/osteoarthritis": "eeb",
  "/rheumatoid-arthritis": "eeb",
  "/child-and-family-care/adolescent-medicine/sports-injuries": "eeb",
  "/eye-ear-bone/ophthalmology/stye": "eeb",
  "/swollen-feet-ankles": "eeb",
  "/eye-ear-bone/ear-nose-throat/tonsillitis": "eeb",
  "/eye-ear-bone/ophthalmology/vision-changes": "eeb",
  "/travel-and-global-care/travel-medicine/travelers-diarrhea": "travel",
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

  return price || 49;
}