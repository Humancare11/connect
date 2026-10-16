// Lay phrases (English, Hindi / Hinglish, Spanish) -> the titles of the site pages they clearly mean. The AI is shown the
// whole page list and picks the best match; this map only adds a hint to the prompt and a server-side fallback when the
// model names no page. A target is matched against the real page list by title (a title that starts with it counts), so a
// target that the site does not have is simply skipped. Pure words-to-titles: nothing medical is said to the patient.
//
// Rules for this list: whole phrases only, no weak single words ("gas", "skin", "sad", "sleep", "cold" ...) that also
// appear in other sentences. `not` lists phrases that cancel a group ("cold sore" is not a cold). A message that matches
// no group gets no page (the chat then shows only the Book button).
const GROUPS = [
  { terms: ["leg pain", "leg ache", "pain in my leg", "pain in my legs", "my leg hurts", "my legs hurt", "legs hurt", "pair dard", "pairon mein dard", "pair me dard", "taang dard", "dolor de pierna", "dolor en las piernas", "dolor de piernas", "पैर दर्द", "पैरों में दर्द", "टांग में दर्द"], targets: ["Joint Pain", "Knee Pain", "Orthopedics"] },
  { terms: ["knee pain", "knee hurts", "knees hurt", "my knees hurt", "my knee hurts", "duelen las rodillas", "me duele la rodilla", "pain in my knee", "pain in my knees", "sore knee", "sore knees", "ghutne mein dard", "ghutne me dard", "ghutnon mein dard", "ghutna dard", "dolor de rodilla", "dolor en la rodilla", "घुटने में दर्द", "घुटनों में दर्द", "घुटना दर्द"], targets: ["Knee Pain", "Joint Pain", "Orthopedics"] },
  { terms: ["joint pain", "joint pains", "joints hurt", "pain in my joints", "pain in my hip", "hip pain", "ankle pain", "elbow pain", "shoulder pain", "pain in my shoulder", "jodon mein dard", "jodo me dard", "jod dard", "dolor articular", "dolor de articulaciones", "dolor de cadera", "dolor de hombro", "जोड़ों में दर्द", "जोड़ दर्द"], targets: ["Joint Pain", "Arthritis", "Orthopedics"] },
  { terms: ["back pain", "backache", "back ache", "lower back pain", "pain in my back", "my back hurts", "kamar dard", "kamar me dard", "kamar mein dard", "peeth dard", "dolor de espalda", "dolor de la espalda", "कमर दर्द", "कमर में दर्द", "पीठ दर्द", "पीठ में दर्द"], targets: ["Back Pain", "Orthopedics"] },
  { terms: ["neck pain", "stiff neck", "pain in my neck", "gardan dard", "gardan me dard", "dolor de cuello", "गर्दन दर्द", "गर्दन में दर्द"], targets: ["Neck Pain", "Orthopedics"] },
  { terms: ["body ache", "body aches", "body pain", "muscle pain", "muscle pains", "muscle ache", "muscle aches", "muscle strain", "pulled muscle", "badan dard", "badan mein dard", "badan me dard", "dolor muscular", "dolor de cuerpo", "बदन दर्द", "शरीर दर्द"], targets: ["Body Aches", "Muscle Strain", "Orthopedics"] },
  { terms: ["headache", "headaches", "head ache", "head pain", "my head hurts", "sar dard", "sir dard", "sardard", "sar me dard", "sir me dard", "dolor de cabeza", "cefalea", "सिर दर्द", "सर दर्द", "सिरदर्द"], targets: ["Headache", "Migraine", "Neurology"] },
  { terms: ["migraine", "migraines", "migrana", "माइग्रेन"], targets: ["Migraine", "Headache", "Neurology"] },
  { terms: ["diabetes", "diabetic", "blood sugar", "high sugar", "sugar badh", "sugar high", "sugar problem", "madhumeh", "azucar alta", "diabetes tipo 2", "शुगर बढ़", "डायबिटीज", "मधुमेह"], targets: ["Type 2 Diabetes", "Endocrinology"] },
  { terms: ["thyroid", "thyroid problem", "tiroides", "थायराइड"], targets: ["Thyroid Disorders", "Endocrinology"] },
  { terms: ["high blood pressure", "high bp", "blood pressure", "hypertension", "presion alta", "presion arterial", "ब्लड प्रेशर", "हाई बीपी"], targets: ["High Blood Pressure", "Cardiology"] },
  { terms: ["high cholesterol", "cholesterol", "colesterol alto", "colesterol", "कोलेस्ट्रॉल"], targets: ["High Cholesterol", "Cardiology"] },
  { terms: ["fever", "high fever", "running a fever", "have a temperature", "bukhar", "bukhaar", "fiebre", "बुखार"], targets: ["Fever", "Cold & Flu"] },
  { terms: ["cough", "coughing", "dry cough", "khansi", "khasi", "tengo tos", "tos seca", "खांसी", "खाँसी"], targets: ["Cough", "Persistent Cough"] },
  { terms: ["common cold", "have a cold", "caught a cold", "the flu", "have the flu", "runny nose", "zukam", "jukam", "resfriado", "gripe", "सर्दी जुकाम", "जुकाम"], not: ["cold sore", "cold sores", "cold feet", "cold weather", "cold pack"], targets: ["Cold & Flu", "Upper Respiratory Infection"] },
  { terms: ["sore throat", "throat pain", "throat hurts", "gala dard", "gale me dard", "dolor de garganta", "गले में दर्द", "गला दर्द"], targets: ["Sore Throat", "ENT (Ear, Nose & Throat)"] },
  { terms: ["stomach pain", "stomach ache", "stomachache", "stomach hurts", "belly pain", "tummy ache", "abdominal pain", "pet dard", "pet me dard", "pet mein dard", "dolor de estomago", "dolor abdominal", "पेट दर्द", "पेट में दर्द"], targets: ["Abdominal Pain", "Gastroenterology"] },
  { terms: ["acidity", "acid reflux", "heartburn", "indigestion", "bloated and gassy", "gas problem", "gas and bloating", "reflujo", "acidez", "एसिडिटी"], not: ["gas card", "gas station", "gas bill"], targets: ["Acid Reflux / GERD", "Indigestion", "Gastroenterology"] },
  { terms: ["diarrhea", "diarrhoea", "loose motion", "loose motions", "dast", "diarrea", "दस्त"], targets: ["Diarrhea", "Gastroenterology"] },
  { terms: ["constipation", "constipated", "kabz", "estrenimiento", "कब्ज"], targets: ["Constipation", "Gastroenterology"] },
  { terms: ["vomiting", "nausea", "feel nauseous", "throwing up", "ulti", "vomito", "nauseas", "उल्टी"], targets: ["Nausea & Vomiting", "Vomiting"] },
  { terms: ["itchy skin", "skin rash", "skin itching", "itching", "i have a rash", "rash on my", "khujli", "kharish", "sarpullido", "picazon", "खुजली"], targets: ["Itchy Skin", "Skin & Hair Care", "Skin & Hair"] },
  { terms: ["hair loss", "hair fall", "hair falling", "hair is falling", "hair is falling out", "losing hair", "losing my hair", "falling hair", "baal jhadna", "baal jhad", "caida del cabello", "perdida de cabello", "बाल झड़ना", "बाल झड़"], targets: ["Skin & Hair Care", "Skin & Hair"] },
  { terms: ["anxiety", "anxious", "depression", "depressed", "panic attack", "panic attacks", "stressed", "stress", "feeling low", "ansiedad", "depresion", "estres", "तनाव", "डिप्रेशन"], not: ["stress test", "stress fracture"], targets: ["Behavioral Medicine", "Mental Health"] },
  { terms: ["sleep apnea", "sleep apnoea", "snoring", "apnea del sueno"], targets: ["Sleep Apnea"] },
  { terms: ["urinary tract infection", "uti", "burning urination", "burning when i pee", "burning while urinating", "peshab me jalan", "peshab mein jalan", "infeccion urinaria", "पेशाब में जलन"], targets: ["Urinary Tract Infection", "Burning Urination", "Urology"] },
  { terms: ["period problems", "irregular periods", "painful periods", "missed period", "pregnancy", "pregnant", "menstrual cramps", "mahwari", "embarazo", "regla irregular", "माहवारी"], targets: ["Women's Health"] },
  { terms: ["eye strain", "eye pain", "my eyes hurt", "blurry vision", "aankh dard", "aankhon mein dard", "dolor de ojos", "आंख दर्द", "आँख दर्द"], targets: ["Eye Strain", "Ophthalmology"] },
  { terms: ["earache", "ear ache", "ear pain", "pain in my ear", "kaan dard", "kaan me dard", "dolor de oido", "कान दर्द", "कान में दर्द"], targets: ["Ear Pain", "ENT (Ear, Nose & Throat)"] },
  { terms: ["dizzy", "dizziness", "vertigo", "chakkar", "mareo", "चक्कर"], targets: ["Dizziness", "Vertigo"] },
  { terms: ["fatigue", "always tired", "feel tired all the time", "constant fatigue", "thakan", "kamzori", "cansancio", "थकान", "कमज़ोरी", "कमजोरी"], targets: ["Fatigue", "General Physician (GP)"] },
  { terms: ["asthma", "wheezing", "asma", "दमा", "अस्थमा"], targets: ["Asthma", "Pulmonology"] },
];

// Service pages (not health topics), asked for by name, so they are safe to add on the server:
// a sick-note question gets the Doctor's note page, a price question the Pricing page.
const SERVICE_GROUPS = [
  { terms: ["sick note", "sick notes", "doctor's note", "doctors note", "doctor note", "doctor notes", "medical certificate", "work note", "note for work", "fit note", "excuse note", "nota medica", "justificante medico"], title: "Doctor's note (sick note)" },
  { terms: ["price", "prices", "pricing", "cost", "costs", "how much", "fee", "fees", "charge", "charges", "rates", "kitna", "kitne", "kimat", "precio", "precios", "cuanto cuesta", "कीमत", "कितना", "फीस"], title: "Pricing" },
];

// Service topics with no page of their own: the reply still ends with a Book button.
const BOOKING_TOPICS = ["prescription", "prescriptions", "refill", "refills", "lab requisition", "lab requisitions", "lab test", "second opinion", "consultation", "consultations", "appointment", "appointments", "book", "booking", "visit", "doctor visit", "telehealth", "fit to fly", "certificate", "receta", "cita", "consulta", "reservar"];

// Lower case, accents removed, punctuation to spaces; Devanagari letters are kept.
const foldHint = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, (m) => (/[ऀ-ॿ]/.test(m) ? m : ""))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();

const prep = (list) => list.map((t) => foldHint(t)).filter(Boolean);
const prepared = GROUPS.map((g) => ({ terms: prep(g.terms), not: prep(g.not || []), targets: g.targets }));
const preparedBooking = prep(BOOKING_TOPICS);
const preparedServices = SERVICE_GROUPS.map((g) => ({ terms: prep(g.terms), title: g.title }));

const has = (hay, t) => hay.includes(` ${t} `) || hay.includes(` ${t}s `); // also the plural (headaches)

// Titles (best first, no duplicates) that the patient's words clearly point at. Only the FIRST matching group counts: a
// message with two topics is ambiguous, so the caller gets one topic's pages, never a mixture.
function titlesFor(text, limit = 4) {
  const hay = ` ${foldHint(text)} `;
  for (const group of prepared) {
    if (group.not.some((n) => hay.includes(` ${n} `))) continue;
    if (group.terms.some((t) => has(hay, t))) return group.targets.slice(0, limit);
  }
  return [];
}

// The service page title a message asks for ("sick note" -> Doctor's note, "price?" -> Pricing), or "".
function serviceTitleFor(text) {
  const hay = ` ${foldHint(text)} `;
  for (const group of preparedServices) if (group.terms.some((t) => has(hay, t))) return group.title;
  return "";
}

// True when the message is about a service we sell (refill, consultation, booking ...): the reply offers Book.
function isServiceTopic(text) {
  const hay = ` ${foldHint(text)} `;
  return preparedBooking.some((t) => has(hay, t));
}

module.exports = { titlesFor, serviceTitleFor, isServiceTopic, GROUPS, SERVICE_GROUPS, foldHint };
