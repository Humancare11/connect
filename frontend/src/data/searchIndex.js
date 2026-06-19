// src/data/searchIndex.js

const searchIndex = [
  // ── Everyday Urgent Care ──
  { id: "cold-flu", title: "Cold & Flu", category: "Everyday Urgent Care", route: "cold-flu",
    keywords: ["cold", "flu", "fever", "runny nose", "chills", "body ache"] },
  { id: "covid-19", title: "COVID-19", category: "Everyday Urgent Care", route: "covid-19",
    keywords: ["covid", "coronavirus", "covid19", "positive test"] },
  { id: "fever", title: "Fever", category: "Everyday Urgent Care", route: "fever",
    keywords: ["fever", "high temp", "temperature", "hot"] },
  { id: "sore-throat", title: "Sore Throat", category: "Everyday Urgent Care", route: "sore-throat",
    keywords: ["sore throat", "throat pain", "throat hurts", "scratchy throat"] },
  { id: "ear-infection", title: "Ear Infection", category: "Everyday Urgent Care", route: "ear-infection",
    keywords: ["ear infection", "ear pain", "earache", "ear hurts", "otitis"] },
  { id: "pink-eye", title: "Pink Eye", category: "Everyday Urgent Care", route: "pink-eye",
    keywords: ["pink eye", "conjunctivitis", "red eye", "eye discharge"] },
  { id: "headache", title: "Headache", category: "Everyday Urgent Care", route: "headache",
    keywords: ["headache", "head pain", "head hurts", "tension headache"] },
  { id: "migraine", title: "Migraine", category: "Everyday Urgent Care", route: "migraine",
    keywords: ["migraine", "severe headache", "migraine attack", "head throbbing"] },
  { id: "acid-reflux", title: "Acid Reflux / GERD", category: "Everyday Urgent Care", route: "acid-reflux",
    keywords: ["acid reflux", "gerd", "heartburn", "chest burn", "indigestion"] },

  // ── Skin Conditions ──
  { id: "acne", title: "Acne", category: "Skin Conditions", route: "acne",
    keywords: ["acne", "pimples", "breakout", "zits", "blackheads", "whiteheads"] },
  { id: "eczema", title: "Eczema", category: "Skin Conditions", route: "eczema",
    keywords: ["eczema", "dry skin", "itchy skin", "skin rash", "atopic dermatitis"] },
  { id: "psoriasis", title: "Psoriasis", category: "Skin Conditions", route: "psoriasis",
    keywords: ["psoriasis", "scaly skin", "skin plaques", "silver scales"] },
  { id: "hives", title: "Hives", category: "Skin Conditions", route: "hives",
    keywords: ["hives", "urticaria", "welts", "allergic rash", "itchy bumps"] },
  { id: "ringworm", title: "Ringworm", category: "Skin Conditions", route: "ringworm",
    keywords: ["ringworm", "fungal infection", "circular rash", "tinea"] },
  { id: "hair-loss", title: "Hair Loss", category: "Skin Conditions", route: "hair-loss",
    keywords: ["hair loss", "balding", "alopecia", "thinning hair", "hair fall"] },

  // ── Mental Health ──
  { id: "anxiety", title: "Anxiety", category: "Mental & Behavioral Health", route: "anxiety",
    keywords: ["anxiety", "anxious", "worry", "panic", "nervous", "stress", "fear"] },
  { id: "depression", title: "Depression", category: "Mental & Behavioral Health", route: "depression",
    keywords: ["depression", "depressed", "sad", "hopeless", "low mood", "not happy"] },
  { id: "stress", title: "Stress", category: "Mental & Behavioral Health", route: "stress",
    keywords: ["stress", "stressed", "overwhelmed", "burnout", "exhausted mentally"] },
  { id: "insomnia", title: "Insomnia", category: "Mental & Behavioral Health", route: "insomnia",
    keywords: ["insomnia", "can't sleep", "sleep problems", "sleepless", "trouble sleeping"] },
  { id: "adhd", title: "ADHD Evaluation", category: "Mental & Behavioral Health", route: "adhd",
    keywords: ["adhd", "attention deficit", "hyperactive", "focus problems", "concentration"] },
  { id: "ptsd", title: "PTSD", category: "Mental & Behavioral Health", route: "ptsd",
    keywords: ["ptsd", "trauma", "flashbacks", "post traumatic", "nightmares"] },
  { id: "panic-attacks", title: "Panic Attacks", category: "Mental & Behavioral Health", route: "panic-attacks",
    keywords: ["panic attack", "panic", "heart racing", "can't breathe", "sudden fear"] },

  // ── Joint & Muscle ──
  { id: "joint-pain", title: "Joint Pain", category: "Eye, Ear & Musculoskeletal", route: "joint-pain",
    keywords: ["joint", "joints", "arthritis", "stiffness", "swelling", "rheumatoid"] },
  { id: "back-pain", title: "Back Pain", category: "Eye, Ear & Musculoskeletal", route: "back-pain",
    keywords: ["back pain", "back ache", "lower back", "spine", "lumbar", "back hurts"] },
  { id: "knee-pain", title: "Knee Pain", category: "Eye, Ear & Musculoskeletal", route: "knee-pain",
    keywords: ["knee", "knee pain", "kni", "kne", "kneecap", "patella", "acl", "meniscus", "knee hurts"] },
  { id: "neck-pain", title: "Neck Pain", category: "Eye, Ear & Musculoskeletal", route: "neck-pain",
    keywords: ["neck pain", "stiff neck", "neck hurts", "cervical", "whiplash"] },
  { id: "muscle-strain", title: "Muscle Strain", category: "Eye, Ear & Musculoskeletal", route: "muscle-strain",
    keywords: ["muscle strain", "pulled muscle", "muscle pain", "spasm", "cramp"] },

  // ── Women's Health ──
  { id: "birth-control", title: "Birth Control Consultation", category: "Women's Health", route: "birth-control",
    keywords: ["birth control", "contraception", "pill", "iud", "contraceptive"] },
  { id: "pcos", title: "PCOS", category: "Women's Health", route: "pcos",
    keywords: ["pcos", "polycystic ovary", "irregular periods", "hormonal imbalance"] },
  { id: "menopause", title: "Menopause Symptoms", category: "Women's Health", route: "menopause",
    keywords: ["menopause", "hot flashes", "night sweats", "perimenopause", "mood changes"] },
  { id: "yeast-infection", title: "Vaginal Yeast Infection", category: "Women's Health", route: "yeast-infection",
    keywords: ["yeast infection", "vaginal itch", "discharge", "candida", "thrush"] },

  // ── Men's Health ──
  { id: "erectile-dysfunction", title: "Erectile Dysfunction", category: "Men's Health", route: "erectile-dysfunction",
    keywords: ["erectile dysfunction", "ed", "impotence", "can't get erection", "sexual performance"] },
  { id: "low-testosterone", title: "Low Testosterone Symptoms", category: "Men's Health", route: "low-testosterone",
    keywords: ["low testosterone", "low t", "low energy men", "libido", "fatigue men"] },

  // ── Urinary ──
  { id: "uti", title: "Urinary Tract Infection", category: "Urinary & Kidney Health", route: "uti",
    keywords: ["uti", "urinary tract infection", "burning urination", "frequent urination", "bladder infection"] },
  { id: "kidney-stones", title: "Kidney Stones", category: "Urinary & Kidney Health", route: "kidney-stones",
    keywords: ["kidney stones", "kidney pain", "renal stones", "blood in urine"] },

  // ── Pediatric ──
  { id: "pediatric-fever", title: "Pediatric Fever", category: "Pediatric Care", route: "pediatric-fever",
    keywords: ["child fever", "baby fever", "kids fever", "toddler temperature", "infant fever"] },
  { id: "pediatric-cold-flu", title: "Pediatric Cold & Flu", category: "Pediatric Care", route: "pediatric-cold-flu",
    keywords: ["child cold", "baby cold", "kids flu", "toddler sick", "infant cold"] },
  { id: "childhood-allergies", title: "Childhood Allergies", category: "Pediatric Care", route: "childhood-allergies",
    keywords: ["child allergy", "kids allergy", "baby allergy", "pediatric allergy"] },

  // ── Chronic Care ──
  { id: "diabetes", title: "Type 2 Diabetes", category: "Chronic Care", route: "diabetes",
    keywords: ["diabetes", "blood sugar", "type 2", "insulin", "glucose", "diabetic"] },
  { id: "hypertension", title: "High Blood Pressure", category: "Chronic Care", route: "hypertension",
    keywords: ["high blood pressure", "hypertension", "bp", "blood pressure", "hypertensive"] },
  { id: "cholesterol", title: "High Cholesterol", category: "Chronic Care", route: "cholesterol",
    keywords: ["high cholesterol", "cholesterol", "lipids", "triglycerides", "heart health"] },
  { id: "thyroid", title: "Thyroid Disorders", category: "Chronic Care", route: "thyroid",
    keywords: ["thyroid", "hypothyroid", "hyperthyroid", "tsh", "thyroid problem"] },

  // ── Sexual Health ──
  { id: "sti", title: "STI Consultation", category: "Sexual Health", route: "sti",
    keywords: ["sti", "std", "sexually transmitted", "chlamydia", "gonorrhea", "herpes"] },
  { id: "prep", title: "HIV Prevention / PrEP", category: "Sexual Health", route: "prep",
    keywords: ["prep", "hiv prevention", "hiv", "aids prevention", "truvada"] },

  // ── Travel Health ──
  { id: "travelers-diarrhea", title: "Traveler's Diarrhea", category: "Travel Health", route: "travelers-diarrhea",
    keywords: ["traveler diarrhea", "travel diarrhea", "delhi belly", "stomach travel", "food poisoning travel"] },
  { id: "motion-sickness", title: "Motion Sickness", category: "Travel Health", route: "motion-sickness",
    keywords: ["motion sickness", "travel sick", "car sick", "nausea travel", "sea sick"] },

  // ── Prescriptions ──
  { id: "prescription-refill", title: "Prescription Refill", category: "Prescription & Continuity Care", route: "prescription-refill",
    keywords: ["prescription refill", "refill medication", "renew prescription", "med refill"] },
  { id: "doctors-note", title: "Doctor's Note", category: "Prescription & Continuity Care", route: "doctors-note",
    keywords: ["doctor note", "sick note", "medical certificate", "work excuse", "school note"] },
];

export default searchIndex;