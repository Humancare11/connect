// Made-up bookings (the approved reference's rows plus a few long ones) for the screenshot scripts.
const hex = (n) => `6a2d30014193e6621459${(0xabbd + n).toString(16)}`;
// What the API sends for the source of each row (sourceGroup, the tooltip and the Source page cell).
const WEB = "Website";
const UNKNOWN = { sourceGroup: "Unknown", sourceDetail: "Booked before source tracking started", sourcePage: null };
const page = (type, name, clickedOn = "") => ({ type, name, clickedOn });
const SOURCES = {
  1: { sourceGroup: "Web", sourceDetail: WEB, sourcePage: page("Condition", "Fever") },
  2: { sourceGroup: "App", sourceDetail: "Android · v1.0.0+16", sourcePage: page("Service", "Fit to fly") },
  3: { sourceGroup: "Web", sourceDetail: WEB, sourcePage: page("Header", "Book Appointment", "Service: Fit to fly") },
  4: UNKNOWN,
  5: { sourceGroup: "Web", sourceDetail: WEB, sourcePage: page("Speciality", "Adolescent Medicine") },
  6: {
    sourceGroup: "Web",
    sourceDetail: WEB,
    sourcePage: page("Footer", "Book Appointment", "Blog: Travelling with asthma, jet lag, altitude and everything else you should know before you fly"),
  },
  7: { sourceGroup: "App", sourceDetail: "iOS · v1.0.0+16", sourcePage: page("Service", "Online Prescription Refills") },
  8: { sourceGroup: "Web", sourceDetail: WEB, sourcePage: page("Doctor profile", "Martin Perlin") },
  9: { sourceGroup: "Web", sourceDetail: WEB, sourcePage: page("Header", "Book Appointment", "Home page") },
  10: { sourceGroup: "App", sourceDetail: "Android · v1.0.0+16", sourcePage: page("Home", "Book appointment card") },
  11: { sourceGroup: "App", sourceDetail: "iOS · v1.0.0+16", sourcePage: null },
  12: { sourceGroup: "Web", sourceDetail: WEB, sourcePage: page("Category", "Mental Health") },
};
const R = (n, status, patient, country, doctorName, category, booked, date, time, fee, assignedBy, extra = {}) => ({
  id: hex(n),
  shortId: hex(n).slice(-8).toUpperCase(),
  kind: extra.kind || "appointment",
  status,
  patient: { name: patient, country },
  doctorName,
  category,
  bookedAt: booked,
  consultation: date ? { date, time, timezone: "" } : null,
  fee,
  assignedBy: doctorName ? assignedBy : null,
  isTesting: Boolean(extra.testing),
  originalDoctorName: extra.original || null,
  ...(SOURCES[n] || UNKNOWN),
});
export const items = [
  R(1, "upcoming", "Test Sujal", "IN", null, "Children & Family", "2026-10-16T08:00:00Z", "2026-10-23", "1:30 AM", 10, null),
  R(2, "upcoming", "kedar", "IN", null, "Chronic Care & Expert Opinion", "2026-10-06T08:00:00Z", "2026-10-06", "1:30 PM", 60, null, { testing: true }),
  R(3, "upcoming", "Priya Nair", "AE", null, "Women's Health", "2026-10-09T08:00:00Z", null, "", 49, null, { kind: "category" }),
  R(4, "assigned", "UatT PatientT ShizukaA", "IN", "TestT Shizuka DoctorR", "Children & Family", "2026-08-03T08:00:00Z", "2026-08-03", "5:40 PM", 110, null),
  R(5, "assigned", "Narayan Mestry", "IN", "Satish Dalvi", "Skin & Hair", "2026-06-13T08:00:00Z", "2026-06-20", "8:30 AM", 100, "admin@gmail.com", { original: "Dr Ananya Rao" }),
  R(6, "assigned", "A Patient With A Really Long Full Name Here", "United Arab Emirates", "Satish Dalvi Technical Team Lead", "General & Everyday Care & Wellbeing Checkups", "2026-06-11T08:00:00Z", "2026-06-26", "8:30 AM", 1499, "administrator.on.duty@humancareconnect.co"),
  R(7, "confirmed", "Rohan Mehta", "IN", "Dr Ananya Rao", "Mental Wellbeing", "2026-10-05T08:00:00Z", "2026-10-28", "11:00 AM", 25, "admin@gmail.com"),
  R(8, "confirmed", "Rachel Secemski", "US", "Martin Perlin", "Travel & Global Care", "2026-10-10T08:00:00Z", "2026-10-16", "9:00 AM", 99, "superadmin@humancare.com"),
  R(9, "pending", "Pam Pending", "IN", "Dr Hidayat Khan", "Children & Family", "2026-10-12T08:00:00Z", "2026-10-30", "4:00 PM", 40, "admin@gmail.com"),
  R(10, "complete", "Satish Dalvi", "IN", "satish dalvi", "Children & Family", "2026-10-01T08:00:00Z", "2026-10-02", "3:30 PM", 1234.5, "admin@gmail.com", { testing: true }),
  R(11, "complete", "Piyush Y.", "GB", "Dr Hidayat Khan", "Children & Family", "2026-09-28T08:00:00Z", "2026-09-30", "7:00 PM", 5, null),
  R(12, "cancelled", "Mahek Test", "IN", "Dr Hidayat Khan", "Chronic Care & Expert Opinion", "2026-09-10T08:00:00Z", "2026-09-10", "4:30 PM", 60, "admin@gmail.com"),
];
export const counts = { all: items.length, upcoming: 3, assigned: 3, pending: 1, confirmed: 2, complete: 2, cancelled: 1, testing: 2 };
