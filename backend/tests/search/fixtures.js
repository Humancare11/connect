// Shared test fixtures: a catalog built through the real buildSearchCatalog
// with stub model sources. No database connection is ever opened.
const mongoose = require("mongoose");

// Any accidental database call fails immediately instead of buffering.
mongoose.set("bufferCommands", false);

const { buildSearchCatalog } = require("../../services/search/searchCatalog");
const publicBlogs = require("../../data/publicBlogs");

const id = (n) => new mongoose.Types.ObjectId(n.toString(16).padStart(24, "0"));

const C = { skin: id(1), chronic: id(2), general: id(3), family: id(4), hidden: id(5) };
const S = {
  derm: id(11), neuro: id(12), cardio: id(13), gp: id(14), endo: id(15), adol: id(16), orphan: id(17),
};

const rawCategories = [
  { _id: C.skin, name: "Skin & Hair", description: "Dermatology", icon: "🧴", isActive: true, price: 11, pricingSlug: "skin" },
  { _id: C.chronic, name: "Chronic Care & Expert Opinion", description: "", icon: "📋", isActive: true },
  { _id: C.general, name: "General & Everyday Care", description: "", icon: "🩺", isActive: true },
  { _id: C.family, name: "Children & Family", description: "", icon: "🧒", isActive: true },
  { _id: C.hidden, name: "Hidden Category", description: "", icon: "", isActive: false },
];

const rawSpecialties = [
  { _id: S.derm, categoryId: C.skin, name: "Dermatology", aliases: ["skin doctor", "skin specialist"], isActive: true },
  { _id: S.neuro, categoryId: C.chronic, name: "Neurology", isActive: true },
  { _id: S.cardio, categoryId: C.chronic, name: "Cardiology", aliases: ["heart doctor", "heart specialist"], isActive: true },
  { _id: S.gp, categoryId: C.general, name: "General Physician", isActive: true },
  { _id: S.endo, categoryId: C.chronic, name: "Endocrinology", aliases: ["hormones"], isActive: true },
  { _id: S.adol, categoryId: C.family, name: "Adolescent Care", isActive: true },
  // Parent category inactive -> must be excluded.
  { _id: S.orphan, categoryId: C.hidden, name: "Hidden Specialty", isActive: true },
];

const rawConditions = [
  { _id: id(101), specialtyId: S.derm, name: "Acne", aliases: ["pimples", "breakout"], isActive: true },
  { _id: id(102), specialtyId: S.adol, name: "Teen acne", icon: "🔴", isActive: true },
  { _id: id(103), specialtyId: S.neuro, name: "Migraine", aliases: ["severe headache"], isActive: true },
  { _id: id(104), specialtyId: S.neuro, name: "Chronic Migraine", isActive: true },
  { _id: id(105), specialtyId: S.endo, name: "Type 2 Diabetes", aliases: ["diabetes", "blood sugar"], isActive: true },
  { _id: id(106), specialtyId: S.gp, name: "Doctor's Note", kind: "service", aliases: ["sick note"], isActive: true },
  { _id: id(107), specialtyId: S.derm, name: "Skin Rash", route: "javascript:alert(1)", isActive: true },
  { _id: id(108), specialtyId: S.derm, name: "Eczema", route: "/skin-and-hair-care/dermatology/eczema", isActive: true },
  // Missing specialty (orphan) and inactive -> must be excluded.
  { _id: id(109), specialtyId: id(999), name: "Orphan Condition", isActive: true },
  { _id: id(110), specialtyId: S.derm, name: "Inactive Condition", isActive: false },
  { _id: id(111), specialtyId: S.orphan, name: "Under Hidden Specialty", isActive: true },
];

// Aggregate output deliberately includes private fields, to prove the
// Node-side allowlist strips them even if the MongoDB projection failed.
const PRIVATE_DOCTOR_FIELDS = {
  email: "private@example.com",
  phoneNumber: "5550100",
  countryCode: "+1",
  password: "hashed-secret",
  googleId: "google-oauth-id",
  appleId: "apple-oauth-id",
  dob: "1980-01-01",
  address: "1 Private Street",
  zip: "99999",
  clinicAddress: "2 Clinic Road",
  clinicName: "Private Clinic",
  medicalLicense: "LIC-123",
  medicalRegistrationNumber: "REG-456",
  internationalLicenses: ["INTL-1"],
  licensedStates: ["CA"],
  idProof: "s3-key-id",
  degreeFile: "s3-key-degree",
  medicalLicenseFile: "s3-key-lic",
  malpracticeInsuranceFile: "s3-key-ins",
  profilePhoto: "s3-key-photo",
  payoutEmail: "payout@example.com",
  paypalId: "pp-1",
  stripeAccountId: "acct_1",
  accountNumber: "000111",
  ifscCode: "IFSC0001",
  bankName: "Bank",
  accountHolderName: "Holder",
  availability: { monday: ["09:00"] },
  timezone: "UTC",
  approvalStatus: "approved",
  pendingProfileChanges: [],
  profileUpdateSnapshot: {},
  _id: id(500),
  mongoId: id(501),
};

const rawDoctors = [
  {
    ...PRIVATE_DOCTOR_FIELDS,
    doctorId: 12345, firstName: "Rahul", surname: "Testname", qualification: "MD",
    specialization: "General Practice", subSpecialization: "Family care",
    languagesKnown: ["English", "Hindi"], city: "Pune", state: "MH", country: "India",
    experience: 8, aboutDoctor: "About text", gender: "Male", consultantFees: 30,
    feeCurrency: "USD", consultationMode: "Video",
  },
  { doctorId: 23456, firstName: "Priya", surname: "Example", qualification: "MD", specialization: "Dermatology", languagesKnown: [] },
  { doctorId: 34567, firstName: "Asha", surname: "Sample", qualification: "DO", specialization: "OB/GYN" },
  // Invalid public id -> dropped.
  { doctorId: null, firstName: "No", surname: "Id", specialization: "Cardiology" },
];

function stubModel(docs, calls, name) {
  return {
    find(filter) {
      calls.push({ model: name, filter });
      return {
        select(fields) {
          calls.push({ model: name, select: fields });
          return { lean: async () => docs };
        },
      };
    },
  };
}

async function buildFixtureCatalog(overrides = {}) {
  const calls = [];
  const sources = {
    HealthcareCategory: stubModel(overrides.categories || rawCategories, calls, "HealthcareCategory"),
    HealthcareSpecialty: stubModel(overrides.specialties || rawSpecialties, calls, "HealthcareSpecialty"),
    HealthcareCondition: stubModel(overrides.conditions || rawConditions, calls, "HealthcareCondition"),
    Enrollment: {
      aggregate: async (pipeline) => {
        calls.push({ model: "Enrollment", pipeline });
        return overrides.doctors || rawDoctors;
      },
    },
    Doctor: { collection: { name: "doctors" } },
    blogs: overrides.blogs || publicBlogs,
  };
  const catalog = await buildSearchCatalog(sources);
  return { catalog, calls };
}

module.exports = { buildFixtureCatalog, PRIVATE_DOCTOR_FIELDS, rawCategories, id };
