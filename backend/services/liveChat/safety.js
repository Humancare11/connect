// Live-chat safety layer. Everything here is deterministic (no model call) and sits around the AI:
//
//   detectEmergency(text)   the PATIENT's message describes an emergency -> the server sends a fixed 911 message itself
//   checkReply(text)        the MODEL's reply gives medical advice -> it is not sent; a fixed safe reply goes out instead
//   replyLength(text)       length of a reply for the 200-character rule: URLs do not count
//   FIXED_TEXT              every fixed patient-facing string (English, Hindi, Spanish) in one place, for counsel review
//
// The checks are deliberately simple word lists: they must be predictable and testable. A false alarm costs one safe
// reply or one 911 message; a miss is the risk this layer exists to remove.

const MAX_REPLY_CHARS = 200;

// ── Fixed strings (reviewed by counsel; do not reword without telling them) ─────────────────────────────────────

const FIXED_TEXT = {
  // Sent by the server when the patient's message describes an emergency. The model is not involved.
  emergency: {
    en: "Please call 911 right now, or go to the nearest emergency room. If you are outside the US, call your local emergency number. In the US you can also call or text 988 for suicide and crisis support.",
    hi: "कृपया अभी 911 पर कॉल करें या नज़दीकी इमरजेंसी रूम में जाएं। अगर आप अमेरिका से बाहर हैं, तो अपने देश के आपातकालीन नंबर पर कॉल करें। अमेरिका में आत्महत्या या संकट में सहायता के लिए 988 पर कॉल या टेक्स्ट भी कर सकते हैं।",
    es: "Llame al 911 ahora mismo o vaya a la sala de emergencias más cercana. Si está fuera de EE. UU., llame a su número local de emergencias. En EE. UU. también puede llamar o enviar un mensaje de texto al 988 para apoyo en crisis o por pensamientos suicidas.",
  },
  // The quiet-chat lines (inactivity job, midnight sweep). The chat is NOT closed: the patient can keep writing, so these
  // never say "closed" or "ended". Picked by the chat's language.
  inactive: {
    en: "No new messages for a while. You can keep writing here any time and we'll continue.",
    hi: "कुछ समय से कोई नया संदेश नहीं आया है। आप कभी भी यहीं लिख सकते हैं, हम बातचीत आगे बढ़ाएंगे।",
    es: "Hace un rato que no hay mensajes nuevos. Puede seguir escribiendo aquí en cualquier momento y continuaremos.",
  },
  quietSinceYesterday: {
    en: "No new messages since yesterday. You can keep writing here any time and we'll continue.",
    hi: "कल से कोई नया संदेश नहीं आया है। आप कभी भी यहीं लिख सकते हैं, हम बातचीत आगे बढ़ाएंगे।",
    es: "No hay mensajes nuevos desde ayer. Puede seguir escribiendo aquí en cualquier momento y continuaremos.",
  },
  // Sent after the 911 message, when the chat has been handed to the team (replaces the usual "Connecting you" line).
  teamNotified: {
    en: "Our team has been notified.",
    hi: "हमारी टीम को सूचित कर दिया गया है।",
    es: "Nuestro equipo ha sido notificado.",
  },
  // Sent instead of a model reply that gave (or looked like) medical advice, or that stayed over the length limit.
  // The booking page button is shown directly under it.
  fallback: {
    en: "Sorry you're not feeling well. I can't give medical advice, but a licensed Humancare Connect doctor can help you. Book here:",
    hi: "आपकी तबीयत ठीक नहीं है, यह जानकर दुख हुआ। चिकित्सीय सलाह देना मेरे लिए संभव नहीं है, लेकिन Humancare Connect के लाइसेंस प्राप्त डॉक्टर मदद कर सकते हैं। यहां बुक करें:",
    es: "Lamento que no se sienta bien. No puedo dar consejo médico, pero un médico con licencia de Humancare Connect puede ayudarle. Reserve aquí:",
  },
  // The same, when the patient's message or the blocked reply is about a medication or a refill.
  fallbackMedication: {
    en: "Sorry you're dealing with this. Our licensed doctors can help with medication questions and refills. Book here:",
    hi: "यह जानकर दुख हुआ कि आप परेशान हैं। हमारे लाइसेंस प्राप्त डॉक्टर दवाओं से जुड़े सवालों और रिफिल में मदद कर सकते हैं। यहां बुक करें:",
    es: "Lamento que esté pasando por esto. Nuestros médicos con licencia pueden ayudarle con preguntas sobre medicamentos y renovaciones de recetas. Reserve aquí:",
  },
};

const LANGS = ["en", "hi", "es"];
const langKey = (code) => {
  const base = String(code || "").toLowerCase().split(/[-_]/)[0];
  return LANGS.includes(base) ? base : "en";
};
const fixedText = (kind, code) => FIXED_TEXT[kind][langKey(code)];

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────

// Lower case, Latin accents removed (Devanagari is untouched), whitespace collapsed, curly quotes straightened.
function fold(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const DEVANAGARI_RE = /[ऀ-ॿ]/;
const HINGLISH_RE = /\b(?:hai|hain|nahi|nahin|mujhe|mereko|mera|meri|kya|kaise|dawai|dawa|goli|dard|bukhar|aapko|karna|karo|chahiye|bahut|zyada|thoda|kab|kyun)\b/;
const SPANISH_RE = /[¿¡ñ]|\b(?:el|la|los|las|un|una|mi|tengo|puedo|necesito|quiero|dolor|medicamento|estoy|hola|gracias|por favor|cuanto|cuesta|que|para|con|sin)\b/;

// Rough language of a patient message (used only when the model has not told us): "hi" | "es" | "en".
function guessLanguage(text) {
  const raw = String(text || "");
  if (DEVANAGARI_RE.test(raw)) return "hi";
  const t = fold(raw);
  if (HINGLISH_RE.test(t)) return "hi";
  if (/[¿¡ñ]/.test(raw)) return "es";
  const spanishHits = (t.match(new RegExp(SPANISH_RE.source, "g")) || []).length;
  const englishHits = (t.match(/\b(?:the|is|are|what|how|my|i|you|can|do|does|have|need|want|with|and)\b/g) || []).length;
  return spanishHits >= 2 && spanishHits > englishHits ? "es" : "en";
}

// Length for the reply-length rule: characters, with URLs (absolute, www., and site paths like /appointment-booking)
// removed so that links do not use up the budget.
function replyLength(text) {
  const withoutUrls = String(text || "")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, " ")
    .replace(/(^|\s)\/[a-z0-9][\w\-/#?=&.%]*/gi, "$1");
  return [...withoutUrls.replace(/\s+/g, " ").trim()].length;
}

// ── Medication words ────────────────────────────────────────────────────────────────────────────────────────────

// Common drug names (generic and brand, US and India) plus classes. Not a formulary: a safety net for the reply filter.
const DRUGS = [
  "ibuprofen", "advil", "motrin", "naproxen", "aleve", "aspirin", "paracetamol", "acetaminophen", "tylenol", "panadol",
  "crocin", "dolo", "calpol", "diclofenac", "voltaren", "meloxicam", "celecoxib", "amoxicillin", "augmentin", "azithromycin",
  "zithromax", "penicillin", "ciprofloxacin", "cipro", "levofloxacin", "doxycycline", "cephalexin", "clindamycin",
  "metronidazole", "flagyl", "fluconazole", "nitrofurantoin", "metformin", "insulin", "glipizide", "ozempic", "semaglutide",
  "wegovy", "mounjaro", "tirzepatide", "lisinopril", "losartan", "amlodipine", "metoprolol", "atenolol", "propranolol",
  "hydrochlorothiazide", "furosemide", "lasix", "warfarin", "coumadin", "eliquis", "apixaban", "xarelto", "clopidogrel",
  "plavix", "atorvastatin", "lipitor", "simvastatin", "rosuvastatin", "crestor", "statins?", "levothyroxine", "synthroid",
  "omeprazole", "prilosec", "pantoprazole", "esomeprazole", "nexium", "ranitidine", "famotidine", "pepcid", "prednisone",
  "prednisolone", "dexamethasone", "hydrocortisone", "montelukast", "singulair", "albuterol", "ventolin", "salbutamol",
  "cetirizine", "zyrtec", "loratadine", "claritin", "fexofenadine", "allegra", "benadryl", "diphenhydramine",
  "pseudoephedrine", "sudafed", "dextromethorphan", "robitussin", "sertraline", "zoloft", "fluoxetine", "prozac",
  "escitalopram", "lexapro", "citalopram", "paroxetine", "venlafaxine", "bupropion", "wellbutrin", "duloxetine", "cymbalta",
  "amitriptyline", "trazodone", "mirtazapine", "alprazolam", "xanax", "lorazepam", "ativan", "diazepam", "valium",
  "clonazepam", "klonopin", "zolpidem", "ambien", "melatonin", "quetiapine", "seroquel", "olanzapine", "risperidone",
  "aripiprazole", "abilify", "lithium", "lamotrigine", "gabapentin", "neurontin", "pregabalin", "lyrica", "topiramate",
  "sumatriptan", "imitrex", "rizatriptan", "tramadol", "codeine", "morphine", "oxycodone", "oxycontin", "percocet",
  "hydrocodone", "vicodin", "fentanyl", "methadone", "buprenorphine", "suboxone", "adderall", "ritalin", "methylphenidate",
  "modafinil", "sildenafil", "viagra", "tadalafil", "cialis", "finasteride", "minoxidil", "isotretinoin", "accutane",
  "tretinoin", "methotrexate", "hydroxychloroquine", "ivermectin", "oseltamivir", "tamiflu", "paxlovid", "valacyclovir",
  "acyclovir", "ondansetron", "zofran", "loperamide", "imodium", "bisacodyl", "laxatives?", "antacids?", "antibiotics?",
  "antidepressants?", "antihistamines?", "antivirals?", "painkillers?", "pain ?relievers?", "steroids?", "opioids?",
  "benzodiazepines?", "sleeping pills?", "birth control", "contraceptive pills?", "cough syrup", "eye drops?",
  "पैरासिटामोल", "आइबुप्रोफेन", "क्रोसिन", "डोलो", "एस्पिरिन", "एंटीबायोटिक", "पेनकिलर", "इंसुलिन",
];
const DRUG_ALT = DRUGS.join("|");
const DRUG_RE = new RegExp(`(?:^|[^\\p{L}])(?:${DRUG_ALT})(?![\\p{L}])`, "iu");

// Words that make a message "about a medication or refill" (patient message or blocked reply) for the fallback variant.
const MEDICATION_TALK_RE = new RegExp(
  [
    "\\b(?:medications?|medicines?|medicinal|drugs?|pills?|tablets?|capsules?|dos(?:e|es|age)|prescri(?:be|bed|ption|ptions)|refills?|rx|antibiotics?|painkillers?|side effects?|interactions?)\\b",
    "\\b(?:medicamentos?|medicinas?|pastillas?|tabletas?|dosis|recetas?|receta|renovar|antibioticos?|analgesicos?|efectos secundarios)\\b",
    "\\b(?:dawai|dawa|dawaiyan|goli|goliyan|khurak|refill)\\b",
    "(?:दवा|दवाई|दवाइयां|दवाइयाँ|गोली|गोलियां|खुराक|रिफिल|पर्ची|नुस्खा|साइड इफेक्ट)",
  ].join("|"),
  "iu"
);
const isMedicationText = (text) => {
  const raw = String(text || "");
  return DRUG_RE.test(raw) || DRUG_RE.test(fold(raw)) || MEDICATION_TALK_RE.test(fold(raw)) || MEDICATION_TALK_RE.test(raw);
};

// ── Reply filter (model output -> patient) ──────────────────────────────────────────────────────────────────────

const CONDITIONS = [
  "infections?", "flu", "influenza", "colds?", "covid(?:-19)?", "coronavirus", "migraines?", "diabetes", "hypertension",
  "high blood pressure", "low blood pressure", "asthma", "anxiety", "depression", "strep(?: throat)?", "pneumonia",
  "bronchitis", "sinusitis", "cancer", "tumou?rs?", "allerg(?:y|ies)", "uti", "arthritis", "ulcers?", "diseases?",
  "disorders?", "syndromes?", "medical conditions?", "viruses", "virus", "bacterial", "deficiency", "anemia", "stroke",
  "heart attack", "appendicitis", "reflux", "gerd", "eczema", "psoriasis", "thyroid", "cholesterol", "hepatitis",
  "tonsillitis", "gastroenteritis", "food poisoning", "concussion", "fracture", "sprain",
];
const COND_ALT = CONDITIONS.join("|");

const DOSE_PATTERNS = [
  /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|ug|ml|mls|milligrams?|micrograms?|milliliters?|millilitres?|cc)\b/i,
  /\b(?:\d+|an?|one|two|three|four|five|six|half|couple of)\s+(?:tablets?|pills?|capsules?|caplets?|teaspoons?|tablespoons?|tsp|tbsp|drops?|puffs?|sprays?)\b/i,
  /\b(?:\d+|una?|dos|tres|cuatro|media)\s+(?:pastillas?|tabletas?|comprimidos?|capsulas?|gotas|cucharaditas?)\b/i,
  /\d+\s*(?:गोली|गोलियां|गोलियाँ|टैबलेट|एमजी|मिलीग्राम|एमएल|बूंद|चम्मच)/u,
  /\b\d+\s*(?:goli|goliyan|tablet|tablets)\b/i,
];

const CONDITION_PATTERNS = [
  new RegExp(
    `\\b(?:you\\s+(?:probably\\s+|likely\\s+|definitely\\s+|certainly\\s+|might\\s+|may\\s+|could\\s+)?(?:have|has|had)|you\\s+(?:are|re)\\s+(?:suffering|probably|likely)|sounds?\\s+like|looks?\\s+like|seems?\\s+like|(?:this|it|that)\\s+(?:could|might|may)\\s+be|(?:this|it|that)\\s+(?:is|s)\\s+(?:probably|likely|most likely|just))\\b[^.!?\\n]{0,40}?\\b(?:${COND_ALT})\\b`,
    "i"
  ),
  /\b(?:tienes|tiene|podrias tener|podria tener|puede tener|puedes tener|parece|suena como|es probable que tenga|probablemente tiene)\b[^.!?\n]{0,40}?\b(?:infeccion|gripe|gripa|resfriado|migrana|diabetes|hipertension|asma|ansiedad|depresion|neumonia|bronquitis|cancer|alergia|artritis|enfermedad|virus|anemia|colesterol)\b/i,
  /\b(?:aapko|apko|tumhe|tumhein)\b[^.!?\n]{0,40}?\b(?:infection|bukhar|fever|migraine|diabetes|sugar|asthma|cancer|allergy|bimari|depression|typhoid|malaria|dengue|jaundice)\b/i,
  /(?:आपको|तुम्हें|आपके)[^।.!?\n]{0,40}(?:संक्रमण|इन्फेक्शन|बुखार|माइग्रेन|डायबिटीज|मधुमेह|अस्थमा|दमा|कैंसर|एलर्जी|बीमारी|डिप्रेशन|टाइफाइड|मलेरिया|डेंगू|पीलिया|उच्च रक्तचाप)/u,
];

const TAKE_NOUNS = `(?:${DRUG_ALT}|medications?|medicines?|meds|tablets?|pills?|capsules?|ointments?|creams?|syrups?|supplements?|vitamins?|herbal\\s+\\w+|home\\s+remed\\w+)`;
const TAKE_PATTERNS = [
  new RegExp(`\\b(?:take|taking|takes|try|trying|use|using|apply|applying|drink|drinking|swallow)\\s+(?:an?\\s+|some\\s+|the\\s+|your\\s+|any\\s+|extra\\s+|over[- ]the[- ]counter\\s+|otc\\s+|prescription\\s+)*${TAKE_NOUNS}\\b`, "i"),
  new RegExp(`\\b(?:tome|tomar|toma|tomando|pruebe|probar|use|usar|aplique|aplicar)\\s+(?:un|una|unos|unas|el|la|algun|alguna|algunos|algunas|su)?\\s*(?:${DRUG_ALT}|medicamentos?|medicinas?|pastillas?|tabletas?|jarabe|crema|pomada|suplementos?)\\b`, "i"),
  /(?:दवा|दवाई|गोली|टैबलेट|सिरप|क्रीम)\s*(?:ले|लें|लीजिए|खा|खाएं|खाइए|लगाएं|पिएं)/u,
  /\b(?:dawai|dawa|goli|tablet|syrup)\s+(?:lo|lein|le\s+lo|khao|khaiye|lijiye|lagao)\b/i,
];

const DIAGNOS_RE = /\bdiagnos|निदान|\bdiagnostic/i;

// Returns { blocked: boolean, reason: string }. reason: dose | condition | take | diagnosis (for logs and tests only).
function checkReply(text) {
  const raw = String(text || "");
  const folded = fold(raw);
  const both = (re) => re.test(raw) || re.test(folded);
  if (DOSE_PATTERNS.some(both)) return { blocked: true, reason: "dose" };
  if (DRUG_RE.test(raw) || DRUG_RE.test(folded)) return { blocked: true, reason: "medication" };
  if (CONDITION_PATTERNS.some(both)) return { blocked: true, reason: "condition" };
  if (TAKE_PATTERNS.some(both)) return { blocked: true, reason: "take" };
  if (both(DIAGNOS_RE)) return { blocked: true, reason: "diagnosis" };
  return { blocked: false, reason: "" };
}

// ── Emergency detector (patient message -> server-sent 911 message) ─────────────────────────────────────────────

const EMERGENCY_PATTERNS = {
  en: [
    /\bchest (?:pain|pains|pressure|tightness|discomfort)\b/,
    /\b(?:pain|pressure|tight(?:ness)?|squeezing|crushing|heavy|heaviness|discomfort)\b[^.!?\n]{0,30}\b(?:in|across|on) (?:my |the |your )?chest\b/,
    /\b(?:tight(?:ness)?|tightening|squeezing|pressure|heavy|heaviness) (?:in|around|across|on) (?:my |the |your )?chest\b|\b(?:tight|heavy|squeezing) chest\b|\bchest (?:is |feels? |feeling )?(?:tight|heavy|squeezing|squeezed|pressure)\b/,
    /\bheart attack\b/,
    /\b(?:can'?t|cannot|can not|unable to|not able to|hard to|difficult to|trouble|difficulty|struggling to|struggling with|problems?) (?:breathe|breathing|get (?:any )?air|catch my breath)\b/,
    /\b(?:short(?:ness)? of breath|gasping for (?:air|breath)|stopped breathing|not breathing|choking)\b/,
    /\b(?:having|had|think i'?m having|might be having) a stroke\b/,
    /\b(?:face|mouth) (?:is )?(?:drooping|droopy|numb)\b/,
    /\bslurred speech\b|\bcan'?t (?:speak|talk) properly\b/,
    /\bsudden (?:numbness|weakness|loss of vision|confusion|trouble speaking|severe headache)\b/,
    /\bcan'?t (?:move|feel) (?:my )?(?:arm|leg|face|side)\b/,
    /\boverdos(?:e|ed|ing)\b|\btook too (?:many|much)\b|\bswallowed (?:a lot of|too many|all (?:my|the))\b/,
    /\bsuicid(?:e|al)\b|\bkill(?:ing)? myself\b|\bend(?:ing)? my (?:own )?life\b|\btake my own life\b|\bwant(?:ed)? to die\b|\bwanna die\b|\bdon'?t want to (?:live|be alive)\b|\bbetter off dead\b/,
    /\b(?:hurt|harm|cut|injure|kill) myself\b|\bself[- ]?harm\b/,
    /\b(?:severe|heavy|massive|serious|uncontrolled) bleeding\b|\bbleeding (?:heavily|badly|profusely|a lot|everywhere|out)\b|\b(?:won'?t|will not|can'?t|cannot|doesn'?t|does not) (?:stop )?bleeding\b|\bbleeding (?:won'?t|will not|can'?t|cannot|doesn'?t|does not) stop\b|\bcoughing (?:up )?blood\b|\bvomiting blood\b|\bblood everywhere\b/,
    /\bpassed out\b|\bunconscious\b|\bunresponsive\b/,
  ],
  hi: [
    /(?:सीने|छाती|सीना)\s*(?:में|मे)?\s*(?:दर्द|जकड़न|भारीपन)/u,
    /(?:सांस|साँस)\s*(?:नहीं|ना)\s*(?:ले|आ)|(?:सांस|साँस)\s*(?:लेने|लेना)\s*(?:में|मे)?\s*(?:तकलीफ|दिक्कत|परेशानी|मुश्किल)|(?:सांस|साँस)\s*फूल/u,
    /आत्महत्या|आत्म-हत्या|मरना\s*चाह|जान\s*दे(?:ना|ने)|खुद\s*को\s*(?:मार|खत्म|नुकसान|चोट)|जीना\s*नहीं\s*चाह/u,
    /ओवरडोज|ज़्यादा\s*गोलियां|ज्यादा\s*गोलियां/u,
    /(?:बहुत|ज़्यादा|ज्यादा)\s*खून|खून\s*(?:नहीं\s*रुक|बह\s*रहा)/u,
    /लकवा|दिल\s*का\s*दौरा|हार्ट\s*अटैक|बेहोश/u,
    /\bseene?\s*(?:mein|me|main)\s*(?:dard|jakdan|bhaari)|\bchh?aati\s*(?:mein|me|main)\s*dard/,
    /\bsaans\s*(?:nahi|nahin|na)\s*(?:le|aa)|\bsaans\s*lene\s*(?:mein|me|main)\s*(?:takleef|dikkat|pareshani|mushkil)|\bsaans\s*phool/,
    /\baatm?\s*-?hatya|\batm?hatya|\bmarna\s*chah|\bjaan\s*de\s*(?:du|dunga|dungi|na)|\bkhud\s*ko\s*(?:khatam|maar|nuksan|chot)|\bjeena\s*nahi\s*chah/,
    /\b(?:bahut|zyada|jyada)\s*khoon|\bkhoon\s*(?:nahi|nahin)\s*ruk|\bkhoon\s*beh/,
    /\bdil\s*ka\s*daura|\blakwa\b|\bbehosh/,
  ],
  es: [
    /\bdolor (?:de|en|del)(?: el| mi| la)? (?:pecho|torax|toracico)\b|\bdolor (?:toracico|opresivo)\b/,
    /\b(?:presion|opresion|tension) en (?:el|mi) pecho\b/,
    /\binfarto\b|\bataque (?:al corazon|cardiaco)\b/,
    /\bno puedo respirar\b|\bme cuesta (?:mucho )?respirar\b|\bdificultad (?:para|al) respirar\b|\bfalta de aire\b|\bme falta (?:el )?aire\b|\bno (?:me )?entra (?:el )?aire\b|\bahog/,
    /\bderrame cerebral\b|\baccidente cerebrovascular\b|\bnecesito ayuda.*\bderrame\b|\b(?:cara|rostro|boca) caida\b|\bhabla (?:arrastrada|confusa)\b|\bhabla (?:muy )?(?:mal|raro)\b/,
    /\bsobredosis\b|\btome demasiad[ao]s?\b|\bme tome (?:todas|muchas)\b/,
    /\bsuicid|\bquiero morir(?:me)?\b|\bmatarme\b|\bquitarme la vida\b|\bacabar con mi vida\b|\bno quiero vivir\b|\bhacerme dano\b|\bautolesion|\bcortarme\b/,
    /\bsangrado (?:fuerte|abundante|severo|grave|excesivo)\b|\bmucha sangre\b|\bno (?:para|deja|puedo parar) de sangrar\b|\bvomit(?:o|ando) sangre\b|\btoso sangre\b/,
    /\bme desmay|\binconsciente\b|\bperdi el conocimiento\b/,
  ],
};

// Severe-pain signals. Ordinary pain ("back pain", "headache", "knee pain", "I have pain", "dolor de cabeza", "sar dard") is NOT
// here: only a strong word (severe, unbearable, excruciating, worst ...) or "cannot move because of the pain" counts.
// Each sentence is checked on its own. SEVERE_PAIN_NEGATED is cut out of the sentence first ("no severe pain", "not unbearable"),
// and a sentence that matches SEVERE_PAIN_SKIP (long ago, a pain scale, "what is severe pain") is ignored.
const SEVERE_PAIN = {
  en: [
    /\b(?:severe|unbearable|excruciating|agonizing|agonising|intolerable|crippling)\s+(?:[a-z]+\s+){0,2}(?:pain|pains|ache|aches|cramps?)\b/,
    /\bworst\s+(?:[a-z]+\s+){0,2}(?:pain|headache|ache)\b|\b(?:pain|headache|ache) of my life\b/,
    /\b(?:pain|headache|ache|cramps?)\s+(?:is|was|has become|got|gets|feels?)\s+(?:so |really |very |just )?(?:unbearable|excruciating|agonizing|agonising|intolerable)\b/,
    /\bin agony\b|\b(?:screaming|crying|doubled over|writhing) (?:in|with) pain\b|\bwrithing\b/,
    /\bsudden(?:ly)?\s+(?:severe|intense|terrible|worst|excruciating)\s+(?:[a-z]+\s+)?(?:headache|pain)\b|\bthunderclap headache\b/,
    /\b(?:severe|intense|unbearable|excruciating|terrible|agonizing|agonising)\s+(?:stomach|abdominal|abdomen|belly|tummy)\s+(?:pain|pains|ache|cramps?)\b/,
    /\b(?:pain|ache|cramps?) in my (?:stomach|abdomen|belly|tummy)\b[^.!?\n]{0,25}\b(?:severe|unbearable|worst|excruciating)\b/,
    /\bcan'?t (?:move|walk|stand up|get up|sit up|bear|stand)\b[^.!?\n]{0,25}\b(?:pain|hurts?)\b|\b(?:pain|hurts?)\b[^.!?\n]{0,20}\bcan'?t (?:move|walk|stand up|get up)\b/,
  ],
  hi: [
    /(?:असहनीय|भयंकर|भयानक|बर्दाश्त\s*से\s*बाहर|सबसे\s*बुरा)\s*(?:\S+\s+){0,2}(?:दर्द|पीड़ा)/u,
    /अचानक\s*(?:बहुत\s*)?(?:तेज़|तेज)\s*(?:सिर|सर)\s*दर्द/u,
    /दर्द\s*(?:से|के\s*कारण|की\s*वजह\s*से)\s*(?:चिल्ला|तड़प|हिल\s*नहीं|चल\s*नहीं|उठ\s*नहीं)/u,
    /दर्द[^।.!?\n]{0,20}जान\s*निकल|जान\s*निकल[^।.!?\n]{0,20}दर्द/u,
    /\b(?:asahniya|asahaniya|asahniy|bhayankar|bhayanak)\s+(?:\w+\s+){0,2}dard\b/,
    /\bbardasht\s+se\s+bahar\b[^.!?\n]{0,15}\bdard\b|\bdard\b[^.!?\n]{0,15}\bbardasht\s+se\s+bahar\b/,
    /\bsabse\s+(?:bura|zyada|tez)\s+(?:\w+\s+)?dard\b/,
    /\bachanak\s+(?:bahut\s+)?tez\s+(?:sar|sir)\s*dard\b/,
    /\bpet\s+(?:mein|me|main)\s+(?:bahut\s+|behad\s+)?(?:tez|bhayankar|asahniya)\s+dard\b/,
    /\bdard\s+(?:se|ki wajah se|ke karan)\s+(?:tadap|chilla|hil|chal|uth)/,
  ],
  es: [
    /\bdolor\s+(?:muy\s+)?(?:severo|insoportable|atroz|terrible|intenso)\b|\b(?:severo|insoportable|atroz|terrible|intenso)\s+dolor\b/,
    /\bel peor dolor\b/,
    /\bdolor de cabeza\s+(?:repentino|subito|de repente)\s+y\s+(?:severo|fuerte|intenso)\b/,
    /\bdolor\s+(?:abdominal|de estomago|de vientre|de barriga)\s+(?:muy\s+)?(?:severo|intenso|insoportable|atroz)\b/,
    /\bno (?:puedo|aguanto) (?:moverme|caminar|levantarme)\b[^.!?\n]{0,25}\bdolor\b|\bdolor\b[^.!?\n]{0,25}\bno puedo (?:moverme|caminar|levantarme)\b/,
    /\bno aguanto (?:mas )?el dolor\b|\bme retuerzo de dolor\b|\b(?:grito|gritando) de dolor\b/,
  ],
};

const SEVERE_PAIN_NEGATED = {
  en: /\b(?:no|not|never|without|isn'?t|aren'?t|wasn'?t|weren'?t|barely|hardly|mild|slight|minimal|less)\b[^.!?\n]{0,15}\b(?:severe|unbearable|excruciating|agonizing|agonising|intolerable|crippling|intense|worst|terrible)\b/g,
  hi: /(?:नहीं|कोई)\s*(?:\S+\s+){0,2}(?:असहनीय|भयंकर|भयानक)|\b(?:nahi|nahin|koi)\s+(?:\w+\s+){0,2}(?:asahniya|asahaniya|bhayankar|bhayanak)\b/gu,
  es: /\b(?:no (?:tengo|tiene|siento|es|hay|fue|era)|sin|nunca|ningun)\b(?:\s+\w+){0,3}\s+(?:severo|insoportable|atroz|terrible|intenso)\b/g,
};

const SEVERE_PAIN_SKIP = {
  en: /\b(?:years?|months?|decades?) ago\b|\blast (?:year|month)\b|\bin the past\b|\bused to\b|\bas a (?:child|kid)\b|\bhistory of\b|\bwhen i was\b|\bpain (?:scale|level|rating|management|clinic|relief|specialist)\b|\brate (?:my|the) pain\b|\bwhat (?:is|are|causes?)\b[^.!?\n]*\b(?:severe|unbearable)\b/,
  hi: /(?:साल|महीने|दिन)\s*पहले|पिछले\s*(?:साल|महीने)|\b(?:saal|sal|mahine|din)\s+pehle\b|\bpichle\s+(?:saal|mahine)\b/u,
  es: /\bhace\s+(?:\w+\s+)?(?:anos|meses|dias)\b|\bcuando era\s+(?:nino|nina|pequeno)\b|\bhistorial\b|\bescala (?:del? )?dolor\b|\bque (?:es|causa)\b/,
};

function severePain(language, raw, folded) {
  for (const text of new Set([folded, raw])) {
    for (const sentence of text.split(/[.!?\n।]+/)) {
      if (!sentence.trim() || SEVERE_PAIN_SKIP[language].test(sentence)) continue;
      const cleaned = sentence.replace(SEVERE_PAIN_NEGATED[language], " ");
      if (SEVERE_PAIN[language].some((re) => re.test(cleaned))) return true;
    }
  }
  return false;
}

// Returns { language: "en" | "hi" | "es" } when the message describes an emergency, otherwise null.
function detectEmergency(text) {
  const raw = String(text || "");
  if (!raw.trim()) return null;
  const folded = fold(raw);
  const hit = (list) => list.some((re) => re.test(folded) || re.test(raw));
  const is = (language) => hit(EMERGENCY_PATTERNS[language]) || severePain(language, raw, folded);
  // Devanagari / Hinglish first so a Hindi message is answered in Hindi.
  if (is("hi")) return { language: "hi" };
  if (is("es") && !is("en")) return { language: "es" };
  if (is("en")) return { language: "en" };
  if (is("es")) return { language: "es" };
  return null;
}

module.exports = {
  MAX_REPLY_CHARS,
  FIXED_TEXT,
  fixedText,
  langKey,
  guessLanguage,
  replyLength,
  isMedicationText,
  checkReply,
  detectEmergency,
};
