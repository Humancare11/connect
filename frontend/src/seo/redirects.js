// Permanent (301) redirects for retired / duplicate URLs.
//
// Source of truth for two consumers:
//   1. App.jsx renders each REDIRECTS entry as an in-app <Navigate replace> route
//      (safety net for dev and for hosts that do not apply render.yaml rules).
//   2. render.yaml carries the same entries as real HTTP 301s. The build check
//      (scripts/check-seo.mjs) fails if render.yaml drifts from this file.
//
// Approved winners/losers: SEO_CODE_REVIEW.md section 6.3.

export const REDIRECTS = [
  // Doctor's note
  { from: "/doctor-note-or-sick-notes", to: "/doctors-note" },
  { from: "/medical-certificate", to: "/doctors-note" },
  // Prescription refill
  { from: "/prescription-refill", to: "/online-prescription-refills" },
  // Second opinion
  { from: "/second-medical-opinion", to: "/online-second-medical-opinion" },
  { from: "/expert-medical-opinion", to: "/online-second-medical-opinion" },
  // Cardiology
  { from: "/chronic-care-and-expert-opinion/cardiology", to: "/chronic-care/cardiology" },
  // Mental health hub
  { from: "/mental-health-support", to: "/mental-health" },
  // ENT
  { from: "/ent", to: "/eye-ear-bone/ear-nose-throat" },
  // Asthma
  { from: "/mild-asthma-symptoms", to: "/chronic-care/pulmonology/asthma" },
  // Migraine
  { from: "/chronic-care/neurology/chronic-migraine", to: "/chronic-care/neurology/migraine" },
  // UTI (gender-neutral canonical)
  { from: "/mens-health/urology/urinary-tract-infection", to: "/urinary-tract-infection" },
  { from: "/bladder-infection", to: "/urinary-tract-infection" },
  // Old/mistyped paths that were linked from the UI
  { from: "/contact", to: "/contact-us" },
  { from: "/specialists", to: "/specialties" },
  { from: "/export-medical-opinion", to: "/online-second-medical-opinion" },
  { from: "/terms", to: "/terms-of-service" },
  { from: "/privacy", to: "/privacy-policy" },
  // Near-duplicate URLs (canonical = the one in the sitemap and internal links)
  { from: "/mens-health-men-health", to: "/mens-health/men-health" },
  // Misspelled category prefix "nurtrition" -> "nutrition"
  { from: "/weight-and-nurtrition", to: "/weight-and-nutrition" },
  { from: "/weight-and-nurtrition/lifestyle-medicine", to: "/weight-and-nutrition/lifestyle-medicine" },
  { from: "/weight-and-nurtrition/lifestyle-medicine/diet-and-exercise-planning", to: "/weight-and-nutrition/lifestyle-medicine/diet-and-exercise-planning" },
  { from: "/weight-and-nurtrition/lifestyle-medicine/healthy-habit-coaching", to: "/weight-and-nutrition/lifestyle-medicine/healthy-habit-coaching" },
  { from: "/weight-and-nurtrition/lifestyle-medicine/sleep-hygiene", to: "/weight-and-nutrition/lifestyle-medicine/sleep-hygiene" },
  { from: "/weight-and-nurtrition/nutrition-and-dietetics", to: "/weight-and-nutrition/nutrition-and-dietetics" },
  { from: "/weight-and-nurtrition/nutrition-and-dietetics/cholesterol-lowering-diet", to: "/weight-and-nutrition/nutrition-and-dietetics/cholesterol-lowering-diet" },
  { from: "/weight-and-nurtrition/nutrition-and-dietetics/diabetic-diet", to: "/weight-and-nutrition/nutrition-and-dietetics/diabetic-diet" },
  { from: "/weight-and-nurtrition/nutrition-and-dietetics/food-intolerance-planning", to: "/weight-and-nutrition/nutrition-and-dietetics/food-intolerance-planning" },
  { from: "/weight-and-nurtrition/nutrition-and-dietetics/pregnancy-nutrition", to: "/weight-and-nutrition/nutrition-and-dietetics/pregnancy-nutrition" },
  { from: "/weight-and-nurtrition/nutrition-and-dietetics/sports-nutrition", to: "/weight-and-nutrition/nutrition-and-dietetics/sports-nutrition" },
  { from: "/weight-and-nurtrition/weight-management", to: "/weight-and-nutrition/weight-management" },
  { from: "/weight-and-nurtrition/weight-management/binge-eating", to: "/weight-and-nutrition/weight-management/binge-eating" },
  { from: "/weight-and-nurtrition/weight-management/obesity", to: "/weight-and-nutrition/weight-management/obesity" },
  { from: "/weight-and-nurtrition/weight-management/weight-loss-planning", to: "/weight-and-nutrition/weight-management/weight-loss-planning" },
];

// Uppercase variants. React Router matches paths case-insensitively, so these
// MUST NOT be added as in-app redirect routes (they would loop). They only exist
// as host-level 301s in render.yaml, where source paths are case-sensitive.
export const CASE_REDIRECTS = [
  { from: "/Blogs", to: "/blogs" },
  { from: "/Specialties", to: "/specialties" },
  { from: "/mental-health/psychiatry/Ocd", to: "/mental-health/psychiatry/ocd" },
];
