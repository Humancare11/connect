// src/data/searchIndex.js
//
// Built directly from the real routes in App.jsx (not the marketing/category
// page copy) so every search result lands on a page that actually exists.
// See the NOTES block at the bottom of this file for known gaps and route
// conflicts you should fix in App.jsx.

export const categories = [
  {
    id: "child-and-family-care", title: "Children & Family Care", type: "category", route: "/child-and-family-care",
    keywords: ["children", "family", "kids", "pediatric", "baby", "toddler"]
  },
  {
    id: "chronic-care", title: "Chronic Care & Expert Opinion", type: "category", route: "/chronic-care",
    keywords: ["chronic care"]
  },
  {
    id: "eye-ear-bone", title: "Eye, Ear & Bone", type: "category", route: "/eye-ear-bone",
    keywords: ["eye", "ear", "bone", "joint", "musculoskeletal", "vision", "hearing"]
  },
  {
    id: "general-and-everyday-care", title: "General & Everyday Care", type: "category", route: "/general-and-everyday-care",
    keywords: ["general care", "everyday care", "primary care", "common illness"]
  },
  {
    id: "men-health", title: "Men's Health", type: "category", route: "/men-health",
    keywords: ["men's health", "male health", "urology", "testosterone"]
  },
  {
    id: "mental-health", title: "Mental Health", type: "category", route: "/mental-health",
    keywords: ["mental health", "psychiatry", "psychology", "emotional health", "therapy", "counseling"]
  },
  {
    id: "categories-sexual-health", title: "Sexual Health", type: "category", route: "/categories-sexual-health",
    keywords: ["sexual health", "sti", "std", "contraception"]
  },
  {
    id: "skin-and-hair-care", title: "Skin & Hair Care", type: "category", route: "/skin-and-hair-care",
    keywords: ["skin", "hair", "dermatology", "rash", "acne"]
  },
  {
    id: "travel-global-care", title: "Travel & Global Care", type: "category", route: "/travel-global-care",
    keywords: ["travel", "global", "international", "expat", "abroad"]
  },
  {
    id: "weight-and-nurtrition", title: "Weight & Nutrition", type: "category", route: "/weight-and-nurtrition",
    keywords: ["weight", "nutrition", "diet", "obesity", "weight loss"]
  },
  {
    id: "women-health", title: "Women's Health", type: "category", route: "/women-health",
    keywords: ["women's health", "gynaecology", "pregnancy", "menopause", "period"]
  },
];

export const specialties = [
  // Children & Family Care
  {
    id: "adolescent-medicine", title: "Adolescent Medicine", type: "specialty", category: "child-and-family-care", route: "/child-and-family-care/adolescent-medicine",
    keywords: ["adolescent", "teen", "teenager"]
  },
  {
    id: "pediatrics", title: "Pediatrics", type: "specialty", category: "child-and-family-care", route: "/child-and-family-care/pediatrics",
    keywords: ["pediatrics", "pediatrician", "child health", "baby"]
  },

  // Chronic Care & Expert Opinion
  { id: "cardiology", title: "Cardiology", type: "specialty", category: "chronic-care-and-expert-opinion", route: "/chronic-care-and-expert-opinion/cardiology",
    keywords: ["cardiology", "heart", "cardiac"] },
  { id: "export-medical-opinion", title: "Expert Medical Opinion", type: "specialty", category: "chronic-care", route: "/export-medical-opinion",
    keywords: ["expert opinion", "second opinion", "specialist review"] },
  { id: "gastroenterology", title: "Gastroenterology", type: "specialty", category: "chronic-care", route: "/chronic-care/gastroenterology",
    keywords: ["gastroenterology", "digestive", "stomach", "gi"] },
  { id: "neurology", title: "Neurology", type: "specialty", category: "chronic-care", route: "/chronic-care/neurology",
    keywords: ["neurology", "brain", "nerve", "neurological"] },
  { id: "pulmonology", title: "Pulmonology", type: "specialty", category: "chronic-care", route: "/chronic-care/pulmonology",
    keywords: ["pulmonology", "lungs", "breathing", "respiratory"] },
  { id: "endocrinology", title: "Endocrinology", type: "specialty", category: "chronic-care", route: "/chronic-care/endocrinology",
    keywords: ["endocrinology", "hormones", "thyroid", "diabetes"] },

  // Eye, Ear & Bone
  {
    id: "ear-nose-throat", title: "ENT (Ear, Nose & Throat)", type: "specialty", category: "eye-ear-bone", route: "/eye-ear-bone/ear-nose-throat",
    keywords: ["ent", "ear nose throat", "sinus", "throat"]
  },
  {
    id: "ophthalmology", title: "Ophthalmology", type: "specialty", category: "eye-ear-bone", route: "/eye-ear-bone/ophthalmology",
    keywords: ["ophthalmology", "eye doctor", "vision"]
  },
  {
    id: "orthopedics", title: "Orthopedics", type: "specialty", category: "eye-ear-bone", route: "/eye-ear-bone/orthopedics",
    keywords: ["orthopedics", "bone", "joint", "musculoskeletal"]
  },

  // General & Everyday Care
  {
    id: "family-medicine", title: "Family Medicine", type: "specialty", category: "general-and-everyday-care", route: "/general-and-everyday-care/family-medicine",
    keywords: ["family medicine", "family doctor"]
  },
  {
    id: "general-physician", title: "General Physician (GP)", type: "specialty", category: "general-and-everyday-care", route: "/general-and-everyday-care/general-physician",
    keywords: ["general physician", "gp", "family doctor"]
  },
  {
    id: "internal-medicine", title: "Internal Medicine", type: "specialty", category: "general-and-everyday-care", route: "/general-and-everyday-care/internal-medicine",
    keywords: ["internal medicine", "internist"]
  },

  // Men's Health
  {
    id: "mens-health-specialty", title: "Men's Health", type: "specialty", category: "men-health", route: "/mens-health/men-health",
    keywords: ["men's health", "male wellness"]
  },
  {
    id: "urology", title: "Urology", type: "specialty", category: "men-health", route: "/mens-health/urology",
    keywords: ["urology", "urologist", "bladder", "kidney"]
  },

  // Mental Health
  {
    id: "behavioral-health", title: "Behavioral Medicine", type: "specialty", category: "mental-health", route: "/mental-health/behavioral-health",
    keywords: ["behavioral medicine", "behavioral health", "stress", "burnout"]
  },
  {
    id: "psychiatry", title: "Psychiatry", type: "specialty", category: "mental-health", route: "/psychiatry",
    keywords: ["psychiatry", "psychiatrist", "medication management"]
  },
  {
    id: "psychology-counseling", title: "Psychology Counseling", type: "specialty", category: "mental-health", route: "/psychology-counseling",
    keywords: ["psychology", "counseling", "talk therapy"]
  },

  // Sexual Health
  {
    id: "speciality-sexual-health", title: "Sexual Health", type: "specialty", category: "categories-sexual-health", route: "/speciality-sexual-health",
    keywords: ["sexual health", "sti", "std"]
  },

  // Skin & Hair Care
  {
    id: "dermatology", title: "Dermatology", type: "specialty", category: "skin-and-hair-care", route: "/dermatology",
    keywords: ["dermatology", "skin doctor", "skin"]
  },

  // Travel & Global Care
  {
    id: "global-cross-border-care", title: "Global Cross-Border Care", type: "specialty", category: "travel-global-care", route: "/global-cross-border-care",
    keywords: ["cross border", "international care", "expat"]
  },
  {
    id: "travel-medicine", title: "Travel Medicine", type: "specialty", category: "travel-global-care", route: "/travel-medicine",
    keywords: ["travel medicine", "travel health", "vaccinations"]
  },

  // Weight & Nutrition
  {
    id: "weight-management", title: "Weight Management", type: "specialty", category: "weight-and-nurtrition", route: "/weight-management",
    keywords: ["weight management", "weight loss"]
  },
  {
    id: "lifestyle-medicine", title: "Lifestyle Medicine", type: "specialty", category: "weight-and-nurtrition", route: "/lifestyle-medicine",
    keywords: ["lifestyle medicine", "healthy habits"]
  },
  {
    id: "nutrition-and-dietetics", title: "Nutrition & Dietetics", type: "specialty", category: "weight-and-nurtrition", route: "/nutrition-and-dietetics",
    keywords: ["nutrition", "dietetics", "dietitian", "diet"]
  },

  // Women's Health
  {
    id: "menopause-care", title: "Menopause Care", type: "specialty", category: "women-health", route: "/menopause-care",
    keywords: ["menopause", "perimenopause", "hot flashes"]
  },
  {
    id: "obstetrics-and-gynaecology", title: "Obstetrics & Gynaecology (OB-GYN)", type: "specialty", category: "women-health", route: "/obstetrics-and-gynaecology",
    keywords: ["obstetrics", "gynaecology", "ob-gyn", "pregnancy"]
  },
  {
    id: "women-mental-health", title: "Women's Mental Health", type: "specialty", category: "women-health", route: "/women-mental-health",
    keywords: ["women's mental health", "postpartum", "perinatal"]
  },
  {
    id: "lactation-consulting", title: "Lactation Consulting", type: "specialty", category: "women-health", route: "/lactation-consulting",
    keywords: ["lactation", "breastfeeding", "nursing"]
  },
];

export const conditions = [
  // ── Chronic Care & Expert Opinion ──────────────────────────────────────
  {
    id: "arthritis", title: "Arthritis", type: "condition", category: "chronic-care", route: "/eye-ear-bone/orthopedics/arthritis",
    keywords: ["arthritis", "joint inflammation"]
  },
  {
    id: "cancer-second-opinion", title: "Cancer Second Opinion", type: "condition", category: "chronic-care", specialty: "export-medical-opinion", route: "/cancer-second-opinion",
    keywords: ["cancer", "oncology", "second opinion"]
  },
  {
    id: "chest-pain", title: "Chest Pain", type: "condition", category: "chronic-care", specialty: "cardiology", route: "/chronic-care/cardiology/chest-pain",
    keywords: ["chest pain", "chest tightness"]
  },
  {
    id: "chronic-kidney-disease", title: "Chronic Kidney Disease", type: "condition", category: "chronic-care", route: "/chronic-kidney-disease",
    keywords: ["chronic kidney disease", "ckd", "renal disease"]
  },
  {
    id: "chronic-migraine", title: "Chronic Migraine", type: "condition", category: "chronic-care", specialty: "neurology", route: "/chronic-care/neurology/chronic-migraine",
    keywords: ["chronic migraine", "migraine", "severe headache"]
  },
  {
    id: "complex-diagnosis", title: "Complex Diagnosis Review", type: "condition", category: "chronic-care", specialty: "export-medical-opinion", route: "/complex-diagnosis",
    keywords: ["complex diagnosis", "diagnosis review"]
  },
  {
    id: "fatty-liver", title: "Fatty Liver", type: "condition", category: "chronic-care", specialty: "gastroenterology", route: "/chronic-care/gastroenterology/fatty-liver",
    keywords: ["fatty liver", "liver disease", "nafld"]
  },
  {
    id: "heart-disease", title: "Heart Disease", type: "condition", category: "chronic-care", specialty: "cardiology", route: "/heart-disease",
    keywords: ["heart disease", "cardiac disease"]
  },
  {
    id: "high-blood-pressure", title: "High Blood Pressure", type: "condition", category: "chronic-care", specialty: "cardiology", route: "/chronic-care/cardiology/high-blood-pressure",
    keywords: ["high blood pressure", "hypertension", "bp"]
  },
  {
    id: "high-cholesterol", title: "High Cholesterol", type: "condition", category: "chronic-care", specialty: "cardiology", route: "/chronic-care/cardiology/high-cholesterol",
    keywords: ["high cholesterol", "cholesterol", "lipids"]
  },
  {
    id: "hormone-imblance", title: "Hormone Imbalance", type: "condition", category: "chronic-care", specialty: "endocrinology", route: "/hormone-imblance",
    keywords: ["hormone imbalance", "hormonal"]
  },
  {
    id: "memory-concerns", title: "Memory Concerns", type: "condition", category: "chronic-care", specialty: "neurology", route: "/chronic-care/neurology/memory-concerns",
    keywords: ["memory concerns", "memory loss", "forgetfulness"]
  },
  {
    id: "obesity", title: "Obesity", type: "condition", category: "chronic-care", route: "/obesity",
    keywords: ["obesity", "overweight"]
  },
  {
    id: "osteoarthritis", title: "Osteoarthritis", type: "condition", category: "chronic-care", route: "/eye-ear-bone/orthopedics/osteoarthritis",
    keywords: ["osteoarthritis", "joint wear"]
  },
  {
    id: "osteoporosis", title: "Osteoporosis", type: "condition", category: "chronic-care", route: "/chronic-care/endocrinology/osteoporosis",
    keywords: ["osteoporosis", "bone density", "weak bones"]
  },
  {
    id: "palpitations", title: "Palpitations", type: "condition", category: "chronic-care", specialty: "cardiology", route: "/chronic-care/cardiology/palpitations",
    keywords: ["palpitations", "heart racing", "irregular heartbeat"]
  },
  {
    id: "post-covid-concerns", title: "Post-COVID Concerns", type: "condition", category: "chronic-care", route: "/chronic-care/pulmonology/post-covid-concerns",
    keywords: ["post-covid", "long covid"]
  },
  {
    id: "pre-op-cardiac-clearance", title: "Pre-Op Cardiac Clearance", type: "condition", category: "chronic-care", specialty: "cardiology", route: "/chronic-care/cardiology/pre-op-cardiac-clearance",
    keywords: ["pre-op clearance", "cardiac clearance", "surgery clearance"]
  },
  {
    id: "rheumatoid-arthritis", title: "Rheumatoid Arthritis", type: "condition", category: "chronic-care", route: "/rheumatoid-arthritis",
    keywords: ["rheumatoid arthritis", "ra"]
  },
  {
    id: "seizures-epilepsy-follow-up", title: "Seizures / Epilepsy Follow-Up", type: "condition", category: "chronic-care", specialty: "neurology", route: "/chronic-care/neurology/seizures-epilepsy-follow-up",
    keywords: ["seizures", "epilepsy"]
  },
  {
    id: "sleep-apnea", title: "Sleep Apnea", type: "condition", category: "chronic-care", specialty: "pulmonology", route: "/chronic-care/pulmonology/sleep-apnea-screening",
    keywords: ["sleep apnea", "snoring", "breathing during sleep"]
  },
  {
    id: "surgery-second-opinion", title: "Surgery Second Opinion", type: "condition", category: "chronic-care", specialty: "export-medical-opinion", route: "/surgery-second-opinion",
    keywords: ["surgery second opinion", "surgical opinion"]
  },
  {
    id: "thyroid-disorders", title: "Thyroid Disorders", type: "condition", category: "chronic-care", specialty: "endocrinology", route: "/chronic-care/endocrinology/thyroid-disorders",
    keywords: ["thyroid", "hypothyroid", "hyperthyroid"]
  },
  {
    id: "treatment-plan-review", title: "Treatment Plan Review", type: "condition", category: "chronic-care", specialty: "export-medical-opinion", route: "/treatment-plan-review",
    keywords: ["treatment plan review"]
  },
  {
    id: "tremor", title: "Tremor", type: "condition", category: "chronic-care", specialty: "neurology", route: "/chronic-care/neurology/tremor",
    keywords: ["tremor", "shaking", "hand tremor"]
  },
  {
    id: "type-2-diabetes", title: "Type 2 Diabetes", type: "condition", category: "chronic-care", specialty: "endocrinology", route: "/chronic-care/endocrinology/type-2-diabetes",
    keywords: ["type 2 diabetes", "diabetes", "blood sugar"]
  },

  // ── Respiratory (grouped under Chronic Care / Pulmonology) ─────────────
  {
    id: "allergic-rhinitis", title: "Allergic Rhinitis", type: "condition", category: "chronic-care", specialty: "pulmonology", route: "/allergic-rhinitis",
    keywords: ["allergic rhinitis", "hay fever", "nasal allergy"]
  },
  {
    id: "asthma", title: "Asthma", type: "condition", category: "chronic-care", specialty: "pulmonology", route: "/chronic-care/pulmonology/asthma",
    keywords: ["asthma", "wheezing", "inhaler"]
  },
  {
    id: "asthma-flare-up", title: "Asthma Flare-Up", type: "condition", category: "chronic-care", specialty: "pulmonology", route: "/asthma-flare-up",
    keywords: ["asthma flare-up", "asthma attack"]
  },
  {
    id: "copd", title: "COPD", type: "condition", category: "chronic-care", specialty: "pulmonology", route: "/chronic-care/pulmonology/copd",
    keywords: ["copd", "chronic obstructive pulmonary disease"]
  },
  {
    id: "persistent-cough", title: "Persistent Cough", type: "condition", category: "chronic-care", specialty: "pulmonology", route: "/chronic-care/pulmonology/persistent-cough",
    keywords: ["persistent cough", "chronic cough"]
  },
  {
    id: "pneumonia-follow-up", title: "Pneumonia Follow-Up", type: "condition", category: "chronic-care", specialty: "pulmonology", route: "/pneumonia-follow-up",
    keywords: ["pneumonia", "pneumonia follow-up"]
  },
  {
    id: "shortness-of-breath", title: "Shortness of Breath", type: "condition", category: "chronic-care", specialty: "pulmonology", route: "/chronic-care/pulmonology/shortness-of-breath",
    keywords: ["shortness of breath", "breathlessness"]
  },
  {
    id: "upper-respiratory-infection", title: "Upper Respiratory Infection", type: "condition", category: "chronic-care", specialty: "pulmonology", route: "/upper-respiratory-infection",
    keywords: ["upper respiratory infection", "uri"]
  },
  {
    id: "wheezing", title: "Wheezing", type: "condition", category: "chronic-care", specialty: "pulmonology", route: "/wheezing",
    keywords: ["wheezing"]
  },

  // ── Weight & Nutrition ──────────────────────────────────────────────────
  {
    id: "abdominal-pain", title: "Abdominal Pain", type: "condition", category: "weight-and-nurtrition", route: "/chronic-care/gastroenterology/abdominal-pain",
    keywords: ["abdominal pain", "stomach pain", "belly pain"]
  },
  {
    id: "binge-eating", title: "Binge Eating", type: "condition", category: "weight-and-nurtrition", specialty: "lifestyle-medicine", route: "/binge-eating",
    keywords: ["binge eating"]
  },
  {
    id: "bloating", title: "Bloating", type: "condition", category: "weight-and-nurtrition", route: "/chronic-care/gastroenterology/bloating",
    keywords: ["bloating", "gas", "distension"]
  },
  {
    id: "cholesterol-lowering-diet", title: "Cholesterol-Lowering Diet", type: "condition", category: "weight-and-nurtrition", specialty: "nutrition-and-dietetics", route: "/cholesterol-lowering-diet",
    keywords: ["cholesterol diet", "heart healthy diet"]
  },
  {
    id: "dehydration", title: "Dehydration", type: "condition", category: "weight-and-nurtrition", route: "/dehydration",
    keywords: ["dehydration", "fluid loss"]
  },
  {
    id: "diabetic-diet", title: "Diabetic Diet", type: "condition", category: "weight-and-nurtrition", specialty: "nutrition-and-dietetics", route: "/diabetic-diet",
    keywords: ["diabetic diet", "diabetes nutrition"]
  },
  {
    id: "diet-exercise-planning", title: "Diet & Exercise Planning", type: "condition", category: "weight-and-nurtrition", specialty: "lifestyle-medicine", route: "/diet-exercise-planning",
    keywords: ["diet planning", "exercise planning"]
  },
  {
    id: "food-intolerance-planning", title: "Food Intolerance Planning", type: "condition", category: "weight-and-nurtrition", specialty: "nutrition-and-dietetics", route: "/food-intolerance-planning",
    keywords: ["food intolerance", "food sensitivity"]
  },
  {
    id: "gastritis", title: "Gastritis", type: "condition", category: "weight-and-nurtrition", specialty: "gastroenterology", route: "/gastritis",
    keywords: ["gastritis", "stomach lining inflammation"]
  },
  {
    id: "glp-program-eligibility", title: "GLP-1 Program Eligibility", type: "condition", category: "weight-and-nurtrition", specialty: "weight-management", route: "/glp-program-eligibility",
    keywords: ["glp-1", "weight loss medication", "ozempic", "wegovy"]
  },
  {
    id: "healthy-habit-coaching", title: "Healthy Habit Coaching", type: "condition", category: "weight-and-nurtrition", specialty: "lifestyle-medicine", route: "/healthy-habit-coaching",
    keywords: ["healthy habits", "coaching"]
  },
  {
    id: "hemorrhoids", title: "Hemorrhoids", type: "condition", category: "weight-and-nurtrition", specialty: "gastroenterology", route: "/hemorrhoids",
    keywords: ["hemorrhoids", "piles"]
  },
  {
    id: "indigestion", title: "Indigestion", type: "condition", category: "weight-and-nurtrition", route: "/indigestion",
    keywords: ["indigestion", "dyspepsia"]
  },
  {
    id: "irritable-bowel-syndrome", title: "Irritable Bowel Syndrome", type: "condition", category: "weight-and-nurtrition", specialty: "gastroenterology", route: "/chronic-care/gastroenterology/irritable-bowel-syndrome",
    keywords: ["ibs", "irritable bowel syndrome"]
  },
  {
    id: "pregnancy-nutrition", title: "Pregnancy Nutrition", type: "condition", category: "weight-and-nurtrition", specialty: "nutrition-and-dietetics", route: "/pregnancy-nutrition",
    keywords: ["pregnancy nutrition", "prenatal diet"]
  },
  {
    id: "sleep-hygiene", title: "Sleep Hygiene", type: "condition", category: "weight-and-nurtrition", specialty: "lifestyle-medicine", route: "/sleep-hygiene",
    keywords: ["sleep hygiene", "sleep habits"]
  },
  {
    id: "sports-nutrition", title: "Sports Nutrition", type: "condition", category: "weight-and-nurtrition", specialty: "nutrition-and-dietetics", route: "/sports-nutrition",
    keywords: ["sports nutrition", "athletic diet"]
  },
  {
    id: "metabolic-syndrome", title: "Metabolic Syndrome", type: "condition", category: "weight-and-nurtrition", route: "/metabolic-syndrome",
    keywords: ["metabolic syndrome"]
  },
  {
    id: "vomiting", title: "Vomiting", type: "condition", category: "weight-and-nurtrition", route: "/vomiting",
    keywords: ["vomiting", "throwing up"]
  },
  {
    id: "weight-loss-planning", title: "Weight-Loss Planning", type: "condition", category: "weight-and-nurtrition", specialty: "weight-management", route: "/weight-loss-planning",
    keywords: ["weight loss planning", "weight loss program"]
  },

  // ── Eye, Ear & Bone ─────────────────────────────────────────────────────
  {
    id: "back-pain", title: "Back Pain", type: "condition", category: "eye-ear-bone", specialty: "orthopedics", route: "/eye-ear-bone/orthopedics/back-pain",
    keywords: ["back pain", "spine", "lumbar"]
  },
  {
    id: "dry-eyes", title: "Dry Eyes", type: "condition", category: "eye-ear-bone", specialty: "ophthalmology", route: "/eye-ear-bone/ophthalmology/dry-eyes",
    keywords: ["dry eyes", "eye dryness"]
  },
  {
    id: "ear-infection", title: "Ear Infection", type: "condition", category: "eye-ear-bone", specialty: "ear-nose-throat", route: "/eye-ear-bone/ear-nose-throat/ear-infection",
    keywords: ["ear infection", "earache", "otitis"]
  },
  {
    id: "ear-pain", title: "Ear Pain", type: "condition", category: "eye-ear-bone", specialty: "ear-nose-throat", route: "/eye-ear-bone/ear-nose-throat/ear-pain",
    keywords: ["ear pain", "earache"]
  },
  {
    id: "eye-redness", title: "Eye Redness", type: "condition", category: "eye-ear-bone", specialty: "ophthalmology", route: "/eye-ear-bone/ophthalmology/eye-redness",
    keywords: ["eye redness", "red eye"]
  },
  {
    id: "eye-strain", title: "Eye Strain", type: "condition", category: "eye-ear-bone", specialty: "ophthalmology", route: "/eye-ear-bone/ophthalmology/eye-strain",
    keywords: ["eye strain", "tired eyes", "screen fatigue"]
  },
  {
    id: "hoarseness", title: "Hoarseness", type: "condition", category: "eye-ear-bone", specialty: "ear-nose-throat", route: "/eye-ear-bone/ear-nose-throat/hoarseness",
    keywords: ["hoarseness", "hoarse voice"]
  },
  {
    id: "knee-pain", title: "Knee Pain", type: "condition", category: "eye-ear-bone", specialty: "orthopedics", route: "/eye-ear-bone/orthopedics/knee-pain",
    keywords: ["knee pain", "knee", "kneecap", "patella", "acl", "meniscus"]
  },
  {
    id: "muscle-strain", title: "Muscle Strain", type: "condition", category: "eye-ear-bone", specialty: "orthopedics", route: "/eye-ear-bone/orthopedics/muscle-strain",
    keywords: ["muscle strain", "pulled muscle"]
  },
  {
    id: "nasal-congestion", title: "Nasal Congestion", type: "condition", category: "eye-ear-bone", specialty: "ear-nose-throat", route: "/eye-ear-bone/ear-nose-throat/nasal-congestion",
    keywords: ["nasal congestion", "stuffy nose"]
  },
  {
    id: "neck-pain", title: "Neck Pain", type: "condition", category: "eye-ear-bone", specialty: "orthopedics", route: "/eye-ear-bone/orthopedics/neck-pain",
    keywords: ["neck pain", "stiff neck", "cervical"]
  },
  {
    id: "numbness-tingling", title: "Numbness & Tingling", type: "condition", category: "eye-ear-bone", route: "/chronic-care/neurology/numbness-and-tingling",
    keywords: ["numbness", "tingling", "pins and needles"]
  },
  {
    id: "stye", title: "Stye", type: "condition", category: "eye-ear-bone", specialty: "ophthalmology", route: "/eye-ear-bone/ophthalmology/stye",
    keywords: ["stye", "eyelid bump"]
  },
  {
    id: "swollen-feet-ankles", title: "Swollen Feet & Ankles", type: "condition", category: "eye-ear-bone", specialty: "orthopedics", route: "/swollen-feet-ankles",
    keywords: ["swollen feet", "swollen ankles", "edema"]
  },
  {
    id: "tonsillitis", title: "Tonsillitis", type: "condition", category: "eye-ear-bone", specialty: "ear-nose-throat", route: "/eye-ear-bone/ear-nose-throat/tonsillitis",
    keywords: ["tonsillitis", "swollen tonsils"]
  },
  {
    id: "joint-pain", title: "Joint Pain", type: "condition", category: "eye-ear-bone", specialty: "orthopedics", route: "/joint-pain",
    keywords: ["joint pain", "joints", "stiffness"]
  },
  {
    id: "vision-changes", title: "Vision Changes", type: "condition", category: "eye-ear-bone", specialty: "ophthalmology", route: "/eye-ear-bone/ophthalmology/vision-changes",
    keywords: ["vision changes", "blurry vision"]
  },
  {
    id: "vertigo", title: "Vertigo", type: "condition", category: "eye-ear-bone", specialty: "ear-nose-throat", route: "/eye-ear-bone/ear-nose-throat/vertigo",
    keywords: ["vertigo", "dizziness", "balance"]
  },

  // ── Children & Family Care ──────────────────────────────────────────────
  {
    id: "childhood-allergies", title: "Childhood Allergies", type: "condition", category: "child-and-family-care", specialty: "pediatrics", route: "/childhood-allergies",
    keywords: ["childhood allergies", "kids allergy", "baby allergy"]
  },
  {
    id: "ear-pain-children", title: "Ear Pain in Children", type: "condition", category: "child-and-family-care", specialty: "pediatrics", route: "/child-and-family-care/pediatrics/ear-pain-children",
    keywords: ["child ear pain", "kids earache"]
  },
  {
    id: "feeding-concerns", title: "Feeding Concerns", type: "condition", category: "child-and-family-care", specialty: "pediatrics", route: "/child-and-family-care/pediatrics/feeding-concerns",
    keywords: ["feeding concerns", "baby feeding"]
  },
  {
    id: "mild-asthma-symptoms", title: "Mild Asthma Symptoms", type: "condition", category: "child-and-family-care", specialty: "pediatrics", route: "/mild-asthma-symptoms",
    keywords: ["child asthma", "kids wheezing"]
  },
  {
    id: "mood-anxiety-teens", title: "Mood & Anxiety in Teens", type: "condition", category: "child-and-family-care", specialty: "adolescent-medicine", route: "/child-and-family-care/adolescent-medicine/mood-anxiety-teens",
    keywords: ["teen anxiety", "teen mood", "adolescent mental health"]
  },
  {
    id: "pediatric-cold-flu", title: "Pediatric Cold & Flu", type: "condition", category: "child-and-family-care", specialty: "pediatrics", route: "/child-and-family-care/pediatrics/pediatric-cold-flu",
    keywords: ["child cold", "kids flu", "baby cold"]
  },
  {
    id: "pediatric-fever", title: "Pediatric Fever", type: "condition", category: "child-and-family-care", specialty: "pediatrics", route: "/child-and-family-care/pediatrics/pediatric-fever",
    keywords: ["child fever", "baby fever", "kids temperature"]
  },
  {
    id: "pink-eye-children", title: "Pink Eye in Children", type: "condition", category: "child-and-family-care", specialty: "pediatrics", route: "/pink-eye-children",
    keywords: ["child pink eye", "kids conjunctivitis"]
  },
  {
    id: "puberty-concerns", title: "Puberty Concerns", type: "condition", category: "child-and-family-care", specialty: "adolescent-medicine", route: "/child-and-family-care/adolescent-medicine/puberty-concerns",
    keywords: ["puberty", "puberty concerns"]
  },
  {
    id: "skin-rash-children", title: "Skin Rash in Children", type: "condition", category: "child-and-family-care", specialty: "pediatrics", route: "/child-and-family-care/pediatrics/skin-rash-in-children",
    keywords: ["child skin rash", "kids rash", "baby rash"]
  },
  {
    id: "sore-throat-children", title: "Sore Throat in Children", type: "condition", category: "child-and-family-care", specialty: "pediatrics", route: "/sore-throat-children",
    keywords: ["child sore throat", "kids throat pain"]
  },
  {
    id: "sports-injuries", title: "Sports Injuries", type: "condition", category: "child-and-family-care", specialty: "adolescent-medicine", route: "/child-and-family-care/adolescent-medicine/sports-injuries",
    keywords: ["sports injuries", "youth sports injury"]
  },
  {
    id: "stomach-pain-children", title: "Stomach Pain in Children", type: "condition", category: "child-and-family-care", specialty: "pediatrics", route: "/stomach-pain-children",
    keywords: ["child stomach pain", "kids belly ache"]
  },
  {
    id: "growth-development", title: "Growth & Development", type: "condition", category: "child-and-family-care", specialty: "pediatrics", route: "/growth-development",
    keywords: ["growth", "development milestones"]
  },
  {
    id: "vomiting-diarrhea-children", title: "Vomiting & Diarrhea in Children", type: "condition", category: "child-and-family-care", specialty: "pediatrics", route: "/vomiting-diarrhea-children",
    keywords: ["child vomiting", "kids diarrhea"]
  },

  // ── Prescription & Continuity Care (General & Everyday Care) ────────────
  {
    id: "doctors-note", title: "Doctor's Note", type: "condition", category: "general-and-everyday-care", route: "/doctors-note",
    keywords: ["doctor's note", "sick note", "medical certificate", "work excuse"]
  },
  {
    id: "follow-up-consultation", title: "Follow-Up Consultation", type: "condition", category: "general-and-everyday-care", route: "/follow-up-consultation",
    keywords: ["follow-up consultation", "follow up visit"]
  },
  {
    id: "lab-results-review", title: "Lab Results Review", type: "condition", category: "general-and-everyday-care", route: "/lab-results-review",
    keywords: ["lab results", "blood test review"]
  },
  {
    id: "medical-certificate", title: "Medical Certificate", type: "condition", category: "general-and-everyday-care", route: "/medical-certificate",
    keywords: ["medical certificate"]
  },
  {
    id: "medication-review", title: "Medication Review", type: "condition", category: "general-and-everyday-care", route: "/medication-review",
    keywords: ["medication review", "medicine review"]
  },
  {
    id: "prescription-refill", title: "Prescription Refill", type: "condition", category: "general-and-everyday-care", route: "/prescription-refill",
    keywords: ["prescription refill", "refill medication", "renew prescription"]
  },
  {
    id: "return-to-work-clearance", title: "Return-to-Work Clearance", type: "condition", category: "general-and-everyday-care", route: "/return-to-work-clearance",
    keywords: ["return to work", "work clearance"]
  },
  {
    id: "second-medical-opinion", title: "Second Medical Opinion", type: "condition", category: "general-and-everyday-care", specialty: "export-medical-opinion", route: "/second-medical-opinion",
    keywords: ["second opinion"]
  },
  {
    id: "specialist-referral", title: "Specialist Referral", type: "condition", category: "general-and-everyday-care", route: "/specialist-referral",
    keywords: ["specialist referral", "referral"]
  },

  // ── Sexual Health ────────────────────────────────────────────────────────
  {
    id: "chlamydia", title: "Chlamydia", type: "condition", category: "categories-sexual-health", specialty: "speciality-sexual-health", route: "/sexual-health/sexual-health-and-wellness/chlamydia",
    keywords: ["chlamydia", "sti"]
  },
  {
    id: "genital-itching", title: "Genital Itching", type: "condition", category: "categories-sexual-health", specialty: "speciality-sexual-health", route: "/genital-itching",
    keywords: ["genital itching"]
  },
  {
    id: "genital-rash", title: "Genital Rash", type: "condition", category: "categories-sexual-health", specialty: "speciality-sexual-health", route: "/genital-rash",
    keywords: ["genital rash"]
  },
  {
    id: "gonorrhea", title: "Gonorrhea", type: "condition", category: "categories-sexual-health", specialty: "speciality-sexual-health", route: "/sexual-health/sexual-health-and-wellness/gonorrhea",
    keywords: ["gonorrhea", "sti"]
  },
  {
    id: "herpes", title: "Herpes", type: "condition", category: "categories-sexual-health", specialty: "speciality-sexual-health", route: "/sexual-health/sexual-health-and-wellness/herpes",
    keywords: ["herpes", "sti", "cold sores genital"]
  },
  {
    id: "hiv-prevention-guidance", title: "HIV Prevention Guidance", type: "condition", category: "categories-sexual-health", specialty: "speciality-sexual-health", route: "/sexual-health/sexual-health-and-wellness/hiv-prevention-guidance",
    keywords: ["hiv prevention", "prep", "truvada"]
  },
  {
    id: "partner-exposure-concerns", title: "Partner Exposure Concerns", type: "condition", category: "categories-sexual-health", specialty: "speciality-sexual-health", route: "/sexual-health/sexual-health-and-wellness/partner-exposure-concerns",
    keywords: ["partner exposure", "sti exposure"]
  },
  {
    id: "safe-sex-counseling", title: "Safe Sex Counseling", type: "condition", category: "categories-sexual-health", specialty: "speciality-sexual-health", route: "/sexual-health/sexual-health-and-wellness/safe-sex-counseling",
    keywords: ["safe sex", "sexual health counseling"]
  },
  {
    id: "sti-consultation", title: "STI Consultation", type: "condition", category: "categories-sexual-health", specialty: "speciality-sexual-health", route: "/sexual-health/sexual-health-and-wellness/sti-consultation",
    keywords: ["sti consultation", "std consultation"]
  },

  // ── Skin & Hair Care ─────────────────────────────────────────────────────
  {
    id: "acne", title: "Acne", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/acne",
    keywords: ["acne", "pimples", "breakout", "blackheads"]
  },
  {
    id: "athletes-foot", title: "Athlete's Foot", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/athletes-foot",
    keywords: ["athlete's foot", "fungal foot infection"]
  },
  {
    id: "cellulitis", title: "Cellulitis", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/cellulitis",
    keywords: ["cellulitis", "skin infection"]
  },
  {
    id: "cold-sores", title: "Cold Sores", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/cold-sores",
    keywords: ["cold sores", "fever blisters"]
  },
  {
    id: "contact-dermatitis", title: "Contact Dermatitis", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/contact-dermatitis",
    keywords: ["contact dermatitis", "skin allergy"]
  },
  {
    id: "eczema", title: "Eczema", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/eczema",
    keywords: ["eczema", "dry skin", "itchy skin", "atopic dermatitis"]
  },
  {
    id: "fungal-skin-infection", title: "Fungal Skin Infection", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/fungal-skin-infection",
    keywords: ["fungal infection", "tinea"]
  },
  {
    id: "hives", title: "Hives", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/hives",
    keywords: ["hives", "urticaria", "welts"]
  },
  {
    id: "itchy-skin", title: "Itchy Skin", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/itchy-skin",
    keywords: ["itchy skin", "pruritus"]
  },
  {
    id: "mole-skin-checks", title: "Mole & Skin Checks", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/mole-skin-checks",
    keywords: ["mole check", "skin check", "skin cancer screening"]
  },
  {
    id: "nail-problems", title: "Nail Problems", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/nail-problems",
    keywords: ["nail problems", "fungal nail"]
  },
  {
    id: "psoriasis", title: "Psoriasis", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/psoriasis",
    keywords: ["psoriasis", "scaly skin", "plaques"]
  },
  {
    id: "ringworm", title: "Ringworm", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/ringworm",
    keywords: ["ringworm", "circular rash"]
  },
  {
    id: "rosacea", title: "Rosacea", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/rosacea",
    keywords: ["rosacea", "facial redness"]
  },
  {
    id: "shingles", title: "Shingles", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/shingles",
    keywords: ["shingles", "herpes zoster"]
  },
  {
    id: "skin-rash", title: "Skin Rash", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/skin-rash",
    keywords: ["skin rash", "rash"]
  },
  {
    id: "warts", title: "Warts", type: "condition", category: "skin-and-hair-care", specialty: "dermatology", route: "/warts",
    keywords: ["warts"]
  },

  // ── Travel & Global Care ─────────────────────────────────────────────────
  {
    id: "altitude-sickness", title: "Altitude Sickness", type: "condition", category: "travel-global-care", specialty: "travel-medicine", route: "/altitude-sickness",
    keywords: ["altitude sickness"]
  },
  {
    id: "cross-border-consultation", title: "Cross-Border Consultation", type: "condition", category: "travel-global-care", specialty: "global-cross-border-care", route: "/cross-border-consultation",
    keywords: ["cross-border consultation"]
  },
  {
    id: "emergency-teleconsultation-abroad", title: "Emergency Teleconsultation Abroad", type: "condition", category: "travel-global-care", specialty: "global-cross-border-care", route: "/emergency-teleconsultation-abroad",
    keywords: ["emergency abroad", "teleconsultation abroad"]
  },
  {
    id: "fitness-travel-evaluation", title: "Fitness-to-Travel Evaluation", type: "condition", category: "travel-global-care", specialty: "travel-medicine", route: "/fitness-travel-evaluation",
    keywords: ["fit to fly", "fitness to travel"]
  },
  {
    id: "food-poisoning-while-traveling", title: "Food Poisoning While Traveling", type: "condition", category: "travel-global-care", specialty: "travel-medicine", route: "/food-poisoning-while-traveling",
    keywords: ["travel food poisoning"]
  },
  {
    id: "international-medical-assistance", title: "International Medical Assistance", type: "condition", category: "travel-global-care", specialty: "global-cross-border-care", route: "/international-medical-assistance",
    keywords: ["international medical assistance"]
  },
  {
    id: "malaria-prevention", title: "Malaria Prevention", type: "condition", category: "travel-global-care", specialty: "travel-medicine", route: "/malaria-prevention",
    keywords: ["malaria prevention", "antimalarial"]
  },
  {
    id: "jet-lag", title: "Jet Lag", type: "condition", category: "travel-global-care", specialty: "travel-medicine", route: "/jet-lag",
    keywords: ["jet lag"]
  },
  {
    id: "medication-refills-traveling", title: "Medication Refills While Traveling", type: "condition", category: "travel-global-care", specialty: "travel-medicine", route: "/travel-and-global-care/global-cross-border-care/medication-refill-while-traveling",
    keywords: ["travel medication refill"]
  },
  {
    id: "motion-sickness", title: "Motion Sickness", type: "condition", category: "travel-global-care", specialty: "travel-medicine", route: "/motion-sickness",
    keywords: ["motion sickness", "car sick", "sea sick"]
  },
  {
    id: "post-travel-symptoms", title: "Post-Travel Symptoms", type: "condition", category: "travel-global-care", specialty: "travel-medicine", route: "/post-travel-symptoms",
    keywords: ["post-travel symptoms"]
  },
  {
    id: "pre-travel-vaccinations", title: "Pre-Travel Vaccinations", type: "condition", category: "travel-global-care", specialty: "travel-medicine", route: "/pre-travel-vaccinations",
    keywords: ["pre-travel vaccination", "travel vaccine"]
  },
  {
    id: "referral-coordination-overseas", title: "Referral Coordination Overseas", type: "condition", category: "travel-global-care", specialty: "global-cross-border-care", route: "/referral-coordination-overseas",
    keywords: ["referral coordination overseas"]
  },
  {
    id: "travel-medical-certification", title: "Travel Medical Certificate", type: "condition", category: "travel-global-care", specialty: "travel-medicine", route: "/travel-medical-certification",
    keywords: ["travel medical certificate"]
  },
  {
    id: "travel-related-fever", title: "Travel-Related Fever", type: "condition", category: "travel-global-care", specialty: "travel-medicine", route: "/travel-related-fever",
    keywords: ["travel fever"]
  },
  {
    id: "travelers-diarrhea", title: "Traveler's Diarrhea", type: "condition", category: "travel-global-care", specialty: "travel-medicine", route: "/travelers-diarrhea",
    keywords: ["traveler's diarrhea", "delhi belly"]
  },

  // ── General & Everyday Care ──────────────────────────────────────────────
  {
    id: "acid-reflux-gerd", title: "Acid Reflux / GERD", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/chronic-care/gastroenterology/acid-reflux-gerd",
    keywords: ["acid reflux", "gerd", "heartburn"]
  },
  {
    id: "body-aches", title: "Body Aches", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/general-physician/body-aches",
    keywords: ["body aches", "muscle aches"]
  },
  {
    id: "bronchitis", title: "Bronchitis", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/bronchitis",
    keywords: ["bronchitis"]
  },
  {
    id: "cold-and-flu", title: "Cold & Flu", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/general-physician/cold-and-flu",
    keywords: ["cold", "flu", "fever", "runny nose"]
  },
  {
    id: "constipation", title: "Constipation", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/chronic-care/gastroenterology/constipation",
    keywords: ["constipation"]
  },
  {
    id: "cough", title: "Cough", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/general-physician/cough",
    keywords: ["cough"]
  },
  {
    id: "covid-19", title: "COVID-19", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/covid-19",
    keywords: ["covid", "coronavirus", "covid19"]
  },
  {
    id: "diarrhea", title: "Diarrhea", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/diarrhea",
    keywords: ["diarrhea"]
  },
  {
    id: "dizziness", title: "Dizziness", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/chronic-care/neurology/dizziness",
    keywords: ["dizziness", "lightheaded"]
  },
  {
    id: "fatigue", title: "Fatigue", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/general-physician/fatigue",
    keywords: ["fatigue", "tiredness", "low energy"]
  },
  {
    id: "fever", title: "Fever", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/general-physician/fever",
    keywords: ["fever", "high temperature"]
  },
  {
    id: "food-poisoning", title: "Food Poisoning", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/food-poisoning",
    keywords: ["food poisoning"]
  },
  {
    id: "headache", title: "Headache", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/general-physician/headache",
    keywords: ["headache", "head pain"]
  },
  {
    id: "insect-bite", title: "Insect Bites", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/insect-bite",
    keywords: ["insect bites", "bug bites"]
  },
  {
    id: "migraines", title: "Migraine", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/chronic-care/neurology/migraine",
    keywords: ["migraine", "severe headache"]
  },
  {
    id: "minor-burns", title: "Minor Burns", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/minor-burns",
    keywords: ["minor burns"]
  },
  {
    id: "minor-infections", title: "Minor Infections", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/general-physician/minor-infections",
    keywords: ["minor infections"]
  },
  {
    id: "multi-system-complaints", title: "Multi-System Complaints", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/internal-medicine/multi-system-complaints",
    keywords: ["multi-system complaints", "undiagnosed general symptoms"]
  },
  {
    id: "nausea-and-vomiting", title: "Nausea & Vomiting", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/general-physician/nausea-and-vomiting",
    keywords: ["nausea", "vomiting"]
  },
  {
    id: "pink-eye", title: "Pink Eye", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/general-physician/pink-eye",
    keywords: ["pink eye", "conjunctivitis"]
  },
  {
    id: "preventive-screening", title: "Preventive Screening", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/internal-medicine/preventive-screening",
    keywords: ["preventive screening", "health screening"]
  },
  {
    id: "routine-check-ups", title: "Routine Check-Ups", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/family-medicine/routine-check-ups",
    keywords: ["routine check-up", "annual physical"]
  },
  {
    id: "seasonal-allergies", title: "Seasonal Allergies", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/seasonal-allergies",
    keywords: ["seasonal allergies", "hay fever"]
  },
  {
    id: "sinus-infection", title: "Sinus Infection", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/general-physician/sinus-infection",
    keywords: ["sinus infection", "sinusitis"]
  },
  {
    id: "sore-throat", title: "Sore Throat", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/eye-ear-bone/ear-nose-throat/sore-throat",
    keywords: ["sore throat"]
  },
  {
    id: "strep-throat", title: "Strep Throat", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/strep-throat",
    keywords: ["strep throat"]
  },
  {
    id: "undiagnosed-symptoms", title: "Undiagnosed Symptoms", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/internal-medicine/undiagnosed-symptoms",
    keywords: ["undiagnosed symptoms"]
  },
  {
    id: "vaccination-advice", title: "Vaccination Advice", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/family-medicine/vaccination-advice",
    keywords: ["vaccination advice", "immunization"]
  },
  {
    id: "whole-family-illnesses", title: "Whole-Family Illnesses", type: "condition", category: "general-and-everyday-care", specialty: "general-physician", route: "/general-and-everyday-care/family-medicine/whole-family-illnesses",
    keywords: ["whole family illness", "family sick"]
  },

  // ── Urinary & Kidney (grouped under Men's Health / Urology) ──────────────
  {
    id: "bladder-infection", title: "Bladder Infection", type: "condition", category: "men-health", specialty: "urology", route: "/bladder-infection",
    keywords: ["bladder infection"]
  },
  {
    id: "blood-in-urine", title: "Blood in Urine", type: "condition", category: "men-health", specialty: "urology", route: "/mens-health/urology/blood-in-urine",
    keywords: ["blood in urine", "hematuria"]
  },
  {
    id: "burning-urination", title: "Burning Urination", type: "condition", category: "men-health", specialty: "urology", route: "/burning-urination",
    keywords: ["burning urination"]
  },
  {
    id: "frequent-urination", title: "Frequent Urination", type: "condition", category: "men-health", specialty: "urology", route: "/frequent-urination",
    keywords: ["frequent urination"]
  },
  {
    id: "kidney-stones", title: "Kidney Stones", type: "condition", category: "men-health", specialty: "urology", route: "/mens-health/urology/kidney-stones",
    keywords: ["kidney stones", "renal stones"]
  },
  {
    id: "urinary-incontinence", title: "Urinary Incontinence", type: "condition", category: "men-health", specialty: "urology", route: "/mens-health/urology/urinary-incontinence",
    keywords: ["urinary incontinence"]
  },
  {
    id: "urinary-tract-infection", title: "Urinary Tract Infection", type: "condition", category: "men-health", specialty: "urology", route: "/mens-health/urology/urinary-tract-infection",
    keywords: ["uti", "urinary tract infection", "bladder infection"]
  },

  // ── Women's Health ───────────────────────────────────────────────────────
  {
    id: "bacterial-vaginosis", title: "Bacterial Vaginosis", type: "condition", category: "women-health", specialty: "obstetrics-and-gynaecology", route: "/bacterial-vaginosis",
    keywords: ["bacterial vaginosis", "bv"]
  },
  {
    id: "birth-control-consultation", title: "Birth Control Consultation", type: "condition", category: "women-health", specialty: "obstetrics-and-gynaecology", route: "/birth-control-consultation",
    keywords: ["birth control", "contraception", "iud"]
  },
  {
    id: "emergency-contraception-guidance", title: "Emergency Contraception Guidance", type: "condition", category: "women-health", specialty: "obstetrics-and-gynaecology", route: "/emergency-contraception-guidance",
    keywords: ["emergency contraception", "morning after pill"]
  },
  {
    id: "heavy-periods", title: "Heavy Periods", type: "condition", category: "women-health", specialty: "obstetrics-and-gynaecology", route: "/heavy-periods",
    keywords: ["heavy periods", "menorrhagia"]
  },
  {
    id: "irregular-periods", title: "Irregular Periods", type: "condition", category: "women-health", specialty: "obstetrics-and-gynaecology", route: "/irregular-periods",
    keywords: ["irregular periods"]
  },
  {
    id: "latch-problems", title: "Latch Problems", type: "condition", category: "women-health", specialty: "lactation-consulting", route: "/latch-problems",
    keywords: ["latch problems", "breastfeeding latch"]
  },
  {
    id: "low-milk-supply", title: "Low Milk Supply", type: "condition", category: "women-health", specialty: "lactation-consulting", route: "/low-milk-supply",
    keywords: ["low milk supply", "breastfeeding supply"]
  },
  {
    id: "menopause-symptoms", title: "Menopause Symptoms", type: "condition", category: "women-health", specialty: "menopause-care", route: "/menopause-symptoms",
    keywords: ["menopause", "hot flashes", "night sweats", "perimenopause"]
  },
  {
    id: "menstrual-cramps", title: "Menstrual Cramps", type: "condition", category: "women-health", specialty: "obstetrics-and-gynaecology", route: "/menstrual-cramps",
    keywords: ["menstrual cramps", "period cramps"]
  },
  {
    id: "nipple-pain", title: "Nipple Pain", type: "condition", category: "women-health", specialty: "lactation-consulting", route: "/nipple-pain",
    keywords: ["nipple pain", "breastfeeding pain"]
  },
  {
    id: "pcos", title: "PCOS", type: "condition", category: "women-health", specialty: "obstetrics-and-gynaecology", route: "/pcos",
    keywords: ["pcos", "polycystic ovary"]
  },
  {
    id: "pelvic-pain", title: "Pelvic Pain", type: "condition", category: "women-health", specialty: "obstetrics-and-gynaecology", route: "/pelvic-pain",
    keywords: ["pelvic pain"]
  },
  {
    id: "perinatal-anxiety", title: "Perinatal Anxiety", type: "condition", category: "women-health", specialty: "women-mental-health", route: "/perinatal-anxiety",
    keywords: ["perinatal anxiety", "pregnancy anxiety"]
  },
  {
    id: "pmdd", title: "PMDD", type: "condition", category: "women-health", specialty: "women-mental-health", route: "/pmdd",
    keywords: ["pmdd", "premenstrual dysphoric disorder"]
  },
  {
    id: "postnatal-depression", title: "Postnatal Depression", type: "condition", category: "women-health", specialty: "women-mental-health", route: "/postnatal-depression",
    keywords: ["postnatal depression", "postpartum depression"]
  },
  {
    id: "postpartum-concerns", title: "Postpartum Concerns", type: "condition", category: "women-health", specialty: "obstetrics-and-gynaecology", route: "/postpartum-concerns",
    keywords: ["postpartum concerns"]
  },
  {
    id: "pregnancy-related-questions", title: "Pregnancy-Related Questions", type: "condition", category: "women-health", specialty: "obstetrics-and-gynaecology", route: "/pregnancy-related-questions",
    keywords: ["pregnancy questions"]
  },
  {
    id: "prenatal-consultation", title: "Prenatal Consultation", type: "condition", category: "women-health", specialty: "obstetrics-and-gynaecology", route: "/prenatal-consultation",
    keywords: ["prenatal consultation"]
  },
  {
    id: "vaginal-yeast-infection", title: "Vaginal Yeast Infection", type: "condition", category: "women-health", specialty: "obstetrics-and-gynaecology", route: "/vaginal-yeast-infection",
    keywords: ["yeast infection", "vaginal itch", "candida", "thrush"]
  },
  {
    id: "weaning-guidance", title: "Weaning Guidance", type: "condition", category: "women-health", specialty: "lactation-consulting", route: "/weaning-guidance",
    keywords: ["weaning guidance"]
  },

  // ── Men's Health ─────────────────────────────────────────────────────────
  {
    id: "bladder-problems", title: "Bladder Problems", type: "condition", category: "men-health", specialty: "urology", route: "/mens-health/urology/bladder-problems",
    keywords: ["bladder problems"]
  },
  {
    id: "erectile-dysfunction", title: "Erectile Dysfunction", type: "condition", category: "men-health", specialty: "mens-health-specialty", route: "/mens-health/men-health/erectile-dysfunction",
    keywords: ["erectile dysfunction", "ed", "impotence"]
  },
  {
    id: "hair-loss-mens-health", title: "Hair Loss (Men's Health)", type: "condition", category: "men-health", specialty: "mens-health-specialty", route: "/mens-health/men-health/hair-loss",
    keywords: ["hair loss", "balding", "male pattern baldness"]
  },
  {
    id: "low-libido", title: "Low Libido", type: "condition", category: "men-health", specialty: "mens-health-specialty", route: "/mens-health/men-health/low-libido",
    keywords: ["low libido", "low sex drive"]
  },
  {
    id: "low-testosterone-symptoms", title: "Low Testosterone Symptoms", type: "condition", category: "men-health", specialty: "mens-health-specialty", route: "/mens-health/men-health/low-testosterone-symptoms",
    keywords: ["low testosterone", "low t"]
  },
  {
    id: "mens-wellness-consultation", title: "Men's Wellness Consultation", type: "condition", category: "men-health", specialty: "mens-health-specialty", route: "/mens-wellness-consultation",
    keywords: ["men's wellness"]
  },
  {
    id: "premature-ejaculation", title: "Premature Ejaculation", type: "condition", category: "men-health", specialty: "mens-health-specialty", route: "/premature-ejaculation",
    keywords: ["premature ejaculation"]
  },
  {
    id: "prostate-health", title: "Prostate Health", type: "condition", category: "men-health", specialty: "urology", route: "/mens-health/men-health/prostate-health",
    keywords: ["prostate health", "prostate"]
  },
  {
    id: "urinary-symptoms-in-men", title: "Urinary Symptoms in Men", type: "condition", category: "men-health", specialty: "urology", route: "/urinary-symptoms-in-men",
    keywords: ["urinary symptoms men"]
  },
];

const searchIndex = [...categories, ...specialties, ...conditions];
export default searchIndex;

