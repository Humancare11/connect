// Lay words (English, Hindi / Hinglish, Spanish) -> the titles of the site pages they usually mean. The AI is shown the
// whole page list and picks the best match; this map only adds a hint to the prompt and a server-side fallback when the
// model names no page. A target is matched against the real page list by title (a title that starts with it counts), so a
// target that the site does not have is simply skipped. Pure words-to-titles: nothing medical is said to the patient.
const GROUPS = [
  { terms: ["leg", "legs", "leg pain", "pain in my leg", "pain in my legs", "calf", "thigh", "taang", "taangon", "pair dard", "pairon mein dard", "pair me dard", "pierna", "piernas", "dolor de pierna", "dolor en las piernas", "पैर", "पैरों", "टांग"], targets: ["Joint Pain", "Knee Pain", "Orthopedics"] },
  { terms: ["knee", "knees", "ghutna", "ghutne", "ghutnon", "rodilla", "rodillas", "घुटना", "घुटने"], targets: ["Knee Pain", "Joint Pain", "Orthopedics"] },
  { terms: ["joint", "joints", "hip", "ankle", "elbow", "shoulder", "jod", "jodon", "articulacion", "articulaciones", "cadera", "tobillo", "hombro", "जोड़", "जोड़ों"], targets: ["Joint Pain", "Arthritis", "Orthopedics"] },
  { terms: ["back pain", "backache", "lower back", "spine", "kamar", "kamar dard", "peeth dard", "espalda", "dolor de espalda", "कमर", "पीठ"], targets: ["Back Pain", "Orthopedics"] },
  { terms: ["neck", "neck pain", "gardan", "gardan dard", "cuello", "dolor de cuello", "गर्दन"], targets: ["Neck Pain", "Orthopedics"] },
  { terms: ["muscle", "muscles", "body ache", "body aches", "body pain", "sprain", "badan dard", "badan mein dard", "dolor muscular", "dolor de cuerpo", "बदन दर्द", "शरीर दर्द"], targets: ["Body Aches", "Muscle Strain", "Orthopedics"] },
  { terms: ["headache", "head ache", "head pain", "sar dard", "sir dard", "sardard", "sar me dard", "sir me dard", "dolor de cabeza", "cefalea", "सिर दर्द", "सर दर्द", "सिरदर्द"], targets: ["Headache", "Migraine", "Neurology"] },
  { terms: ["migraine", "migrana", "माइग्रेन"], targets: ["Migraine", "Headache", "Neurology"] },
  { terms: ["sugar", "diabetes", "diabetic", "blood sugar", "madhumeh", "sugar badh", "sugar high", "azucar", "diabetes tipo 2", "शुगर", "डायबिटीज", "मधुमेह"], targets: ["Type 2 Diabetes", "Endocrinology"] },
  { terms: ["thyroid", "tiroides", "थायराइड"], targets: ["Thyroid Disorders", "Endocrinology"] },
  { terms: ["bp", "blood pressure", "hypertension", "high bp", "presion", "presion alta", "ब्लड प्रेशर", "बीपी"], targets: ["High Blood Pressure", "Cardiology"] },
  { terms: ["cholesterol", "colesterol", "कोलेस्ट्रॉल"], targets: ["High Cholesterol", "Cardiology"] },
  { terms: ["fever", "temperature", "bukhar", "bukhaar", "fiebre", "बुखार"], targets: ["Fever", "Cold & Flu"] },
  { terms: ["cough", "coughing", "khansi", "khasi", "tos", "खांसी", "खाँसी"], targets: ["Cough", "Persistent Cough"] },
  { terms: ["cold", "flu", "runny nose", "zukam", "jukam", "resfriado", "gripe", "सर्दी", "जुकाम"], targets: ["Cold & Flu", "Upper Respiratory Infection"] },
  { terms: ["sore throat", "throat pain", "gala dard", "gale me dard", "dolor de garganta", "garganta", "गला"], targets: ["Sore Throat", "ENT (Ear, Nose & Throat)"] },
  { terms: ["stomach", "stomach pain", "belly", "tummy", "pet dard", "pet me dard", "estomago", "dolor de estomago", "dolor abdominal", "पेट दर्द", "पेट"], targets: ["Abdominal Pain", "Gastroenterology"] },
  { terms: ["acidity", "acid reflux", "heartburn", "gas", "indigestion", "reflujo", "acidez", "एसिडिटी"], targets: ["Acid Reflux / GERD", "Indigestion", "Gastroenterology"] },
  { terms: ["diarrhea", "diarrhoea", "loose motion", "loose motions", "dast", "diarrea", "दस्त"], targets: ["Diarrhea", "Gastroenterology"] },
  { terms: ["constipation", "kabz", "estrenimiento", "कब्ज"], targets: ["Constipation", "Gastroenterology"] },
  { terms: ["vomiting", "nausea", "ulti", "vomito", "nauseas", "उल्टी"], targets: ["Nausea & Vomiting", "Vomiting"] },
  { terms: ["rash", "itching", "itchy", "skin", "allergy", "khujli", "kharish", "sarpullido", "picazon", "piel", "खुजली", "त्वचा"], targets: ["Itchy Skin", "Skin & Hair Care"] },
  { terms: ["hair loss", "hair fall", "baal jhadna", "baal", "caida del cabello", "बाल झड़ना"], targets: ["Skin & Hair Care"] },
  { terms: ["anxiety", "stress", "depression", "sad", "panic", "tension", "ansiedad", "depresion", "estres", "तनाव", "डिप्रेशन"], targets: ["Behavioral Medicine", "Mental Health"] },
  { terms: ["sleep", "insomnia", "cant sleep", "neend", "neend nahi", "sueno", "insomnio", "नींद"], targets: ["Sleep Apnea", "Behavioral Medicine"] },
  { terms: ["urine", "urinary", "uti", "burning urination", "peshab", "peshab me jalan", "orina", "infeccion urinaria", "पेशाब"], targets: ["Urinary Tract Infection", "Burning Urination", "Urology"] },
  { terms: ["period", "periods", "pregnancy", "pregnant", "menstrual", "mahwari", "embarazo", "regla", "माहवारी"], targets: ["Women's Health"] },
  { terms: ["eye", "eyes", "vision", "aankh", "aankhon", "ojo", "ojos", "vista", "आंख", "आँख"], targets: ["Eye Strain", "Ophthalmology"] },
  { terms: ["ear", "ears", "earache", "kaan", "kaan dard", "oido", "dolor de oido", "कान"], targets: ["Ear Pain", "ENT (Ear, Nose & Throat)"] },
  { terms: ["dizzy", "dizziness", "vertigo", "chakkar", "mareo", "चक्कर"], targets: ["Dizziness", "Vertigo"] },
  { terms: ["tired", "fatigue", "weakness", "thakan", "kamzori", "cansancio", "debilidad", "थकान", "कमज़ोरी", "कमजोरी"], targets: ["Fatigue", "General Physician (GP)"] },
  { terms: ["asthma", "wheezing", "breathless", "asma", "दमा", "अस्थमा"], targets: ["Asthma", "Pulmonology"] },
];

// Lower case, accents removed, punctuation to spaces; Devanagari letters are kept.
const foldHint = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, (m) => (/[ऀ-ॿ]/.test(m) ? m : ""))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();

const prepared = GROUPS.map((g) => ({ terms: g.terms.map(foldHint).filter(Boolean), targets: g.targets }));

// Titles (best first, no duplicates) that the patient's words point at.
function titlesFor(text, limit = 4) {
  const hay = ` ${foldHint(text)} `;
  const out = [];
  for (const group of prepared) {
    if (!group.terms.some((t) => hay.includes(` ${t} `) || hay.includes(` ${t}s `))) continue; // also the plural (headaches)
    for (const title of group.targets) if (!out.includes(title)) out.push(title);
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

module.exports = { titlesFor, GROUPS, foldHint };
