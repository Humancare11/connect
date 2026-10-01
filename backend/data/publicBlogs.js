// Public blog metadata for Healthcare Discovery Search.
//
// Mirrors the static `blogs` array in frontend/src/pages/Blogs/Blogs.jsx
// (the only blog source today - there is no blog model or API). Only safe
// listing metadata is kept here: no article bodies. Keep the two lists in
// sync when an article is added, renamed or removed.
//
// Intentionally omitted: Blogs.jsx entry id 6 ("How to Choose the Best
// Telemedicine Provider...") - its path duplicates entry 5
// (/conditions-treated-through-telemedicine), so it would open the wrong
// article. Add it back once it has its own route.
const publicBlogs = [
  {
    id: 1,
    title: "What Is Telemedicine? Complete Guide to Meaning, Benefits, Types & How It Works",
    description:
      "Telemedicine refers to the delivery of healthcare services remotely through digital technologies, including video consultations, phone calls, mobile applications, and secure online platforms. It enables the patients to get the consultation of doctors and healthcare professionals without visiting the hospital or a clinic physically.",
    path: "/what-is-telemedicine",
    readTime: 5,
  },
  {
    id: 2,
    title: "Telemedicine Services: Everything You Need to Know About Virtual Healthcare",
    description:
      "Telemedicine services are healthcare services provided remotely using digital technologies such as video consultations, phone calls, secure messaging, and online healthcare platforms",
    path: "/telemedicine-services",
    readTime: null,
  },
  {
    id: 3,
    title: "How Does a Telemedicine Appointment Work? A Complete Step-by-Step Guide",
    description:
      "The future of telemedicine involves a combination of artificial intelligence, remote patient monitoring, wearable health technology, improved digital platforms, and more personalized virtual healthcare experiences. ",
    path: "/how-does-a-telemedicine-appointment-work",
    readTime: null,
  },
  {
    id: 4,
    title: "Online Doctor Consultation: Benefits, Process & When to Choose Virtual Care",
    description:
      "An online doctor consultation is a virtual healthcare appointment where patients connect with doctors or specialists through video calls, phone calls, or secure digital platforms. It allows patients to discuss symptoms, share medical reports, receive professional medical guidance, and understand the next steps in their care without visiting a clinic or hospital in person.",
    path: "/online-doctor-consultation",
    readTime: null,
  },
  {
    id: 5,
    title: "What Medical Conditions Can Be Treated Through Telemedicine? Complete List",
    description:
      "Telemedicine can help manage many non-emergency health concerns, including common illnesses, chronic disease follow-ups, skin conditions, mental health concerns, medication reviews, specialist consultations, and medical second opinions.",
    path: "/conditions-treated-through-telemedicine",
    readTime: null,
  },
  {
    id: 7,
    title: "Top Telemedicine Platforms & Providers: Features, Benefits & How to Choose",
    description:
      "The best telemedicine platforms provide access to qualified healthcare professionals, multiple medical specialties, secure technology, easy appointment scheduling, transparent communication, and reliable patient support.",
    path: "/top-telemedicine-platforms-providers",
    readTime: null,
  },
  {
    id: 8,
    title: "Is Telemedicine Safe? A Complete Guide to Privacy, Security & Trust",
    description:
      "Yes, telemedicine can be a safe and secure way to receive healthcare when provided through reputable healthcare organizations using appropriate security practices and following applicable privacy and healthcare regulations.",
    path: "/is-telemedicine-safe",
    readTime: null,
  },
  {
    id: 9,
    title: "Telemedicine vs In-Person Doctor Visits: Benefits, Differences & Limitations",
    description:
      "Telemedicine and in-person doctor visits each have unique advantages. Telemedicine provides convenience, faster access to healthcare professionals, easier follow-up care, and access to specialists without travel. In-person visits are essential for physical examinations, emergency treatment, diagnostic procedures, and complex medical situations requiring direct evaluation.",
    path: "/telemedicine-vs-in-person-doctor-visits",
    readTime: null,
  },
  {
    id: 10,
    title: "The Cost of Telemedicine: What You Should Know Before Booking",
    description:
      "Understanding telemedicine pricing, insurance coverage, and what to expect when comparing virtual care costs against traditional in-person visits.",
    path: "/telemedicine-cost-usa",
    readTime: 6,
  },
  {
    id: 11,
    title: "Meet the Real Doctors Behind Virtual Healthcare",
    description:
      "A look at the licensed physicians and healthcare professionals who provide consultations through telemedicine platforms, and how their credentials are verified.",
    path: "/are-online-doctors-real-doctors",
    readTime: 6,
  },
  {
    id: 12,
    title: "The Future of Telemedicine: Trends Shaping Virtual Care",
    description:
      "Artificial intelligence, remote monitoring, and wearable technology are reshaping how patients and doctors connect. Here's what's coming next.",
    path: "/future-of-telemedicine",
    readTime: 7,
  },
  {
    id: 13,
    title: "UTI: Symptoms, Causes, Treatment & When to See a Doctor",
    description:
      "UTI is short for urinary tract infection. It’s a common infection that can affect the bladder, urethra, ureters or kidneys. Most UTIs are caused by bacteria that enter the urinary tract and multiply. Cystitis is the most common type of UTI.",
    path: "/uti-symptoms-causes-treatment-&-when-to-see-a-doctor",
    readTime: 8,
  },
];

module.exports = publicBlogs;
