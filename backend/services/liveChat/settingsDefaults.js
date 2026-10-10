// Seeded defaults for the LcSettings singleton. Everything here is editable later in AI agent settings (Phase 5).
// Wording and options follow docs/chat-demo.html.

const QUICK_OPTIONS = [
  {
    key: "consultation",
    link: "/online-doctor-consultation",
    label: "Online Consultation with Prescription",
    icon: "stethoscope",
    reply:
      "You can see a licensed US doctor online. A general consultation is $49, and if the doctor decides a prescription is appropriate it is issued after the visit. Book from Book Appointment, choose a category and pick a time.",
  },
  {
    key: "refill",
    link: "/online-prescription-refills",
    label: "Prescription & Prescription refill",
    icon: "pill",
    reply:
      "Prescription refills are $60. Go to Book Appointment, choose Prescription refill and a doctor will review your request.",
  },
  {
    key: "second_opinion",
    link: "/online-second-medical-opinion",
    label: "Medical Advice/Second Opinion",
    icon: "clipboard",
    reply:
      "A Second Medical Opinion is $60. A specialist reviews your reports and treatment plan. Book it from Book Appointment, then choose Second opinion.",
  },
  {
    key: "sick_notes",
    link: "/doctors-note",
    label: "Sick Notes",
    icon: "document",
    reply:
      "Doctor notes and sick notes are $49. A doctor reviews your request and, where appropriate, issues the note. Book from Book Appointment, then choose Doctor notes.",
  },
  {
    key: "others",
    label: "Others",
    icon: "dots",
    reply: "Sure, tell me what you need help with and I'll do my best, or I can connect you with a live agent.",
  },
  { key: "live", label: "Talk to a live agent", icon: "agent", reply: "" },
];

const PRICES = [
  { name: "General consultation", price: 49 },
  { name: "Mental health support", price: 49 },
  { name: "Doctor notes & sick notes", price: 49 },
  { name: "Lab requisitions", price: 49 },
  { name: "Chronic care management", price: 55 },
  { name: "Prescription refills", price: 60 },
  { name: "Second medical opinion", price: 60 },
  { name: "Fit to fly", price: 69 },
];

// Canned replies for agents (seeded once; {agentName} is replaced with the agent's display name when inserted).
const CANNED_REPLIES = [
  { title: "Greeting", text: "Hi, I'm {agentName} from Humancare support. How can I help?" },
  { title: "Slot booked", text: "I've booked a General consultation for you today at 6:00 PM. You'll get the video link by email." },
  { title: "Payment confirmed", text: "Your payment went through. A confirmation email will reach you within 5 minutes." },
  { title: "Prescription re-sent", text: "I've re-sent your prescription to your pharmacy. It should arrive within 30 minutes." },
];

const DEFAULT_SETTINGS = {
  key: "default",
  aiMode: "ai_first",
  agentDisplayName: "Sam",
  greeting:
    "Hi {firstName}! Welcome to Humancare Connect. I'm Humancare AI, your healthcare coordinator. How can I help you today?",
  followUpMinutes: 1,
  handoffRules: {
    onPatientRequest: true,
    onTechnicalIssue: true,
    onComplaint: true,
    onUnsure: true,
    onAccountOrPayment: true,
    onAiRequest: true,
    maxAiRepliesPerChat: 30,
    agentOfflineGraceSeconds: 120,
  },
  quickOptions: QUICK_OPTIONS,
  prices: PRICES,
  businessFacts: "",
  dailySpendCapUsd: 3,
  unavailableMessage:
    'Our AI assistant is unavailable right now. Tap "Talk to live agent" and our team will help you.',
};

module.exports = { QUICK_OPTIONS, PRICES, CANNED_REPLIES, DEFAULT_SETTINGS };
