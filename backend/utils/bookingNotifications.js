// Email notifications for the booking / doctor-assignment flow:
//   • admins    — a new appointment was booked
//   • doctors   — a case was booked with / assigned / reassigned to them
//   • old doctor — a case is no longer assigned to them
//
// Every exported function is fire-and-forget safe: it never throws and never
// rejects, because these emails must not affect a booking (payment has already
// been taken) or an admin's assignment. Failures are only logged.
//
// Privacy: bodies carry only patient name/ID, date/time and category/specialty.
// No concern text and no patient contact details — those stay behind the login.
const mailer = require("./sendEmail");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");

const frontendBase = () =>
  String(process.env.FRONTEND_URL || "https://humancareconnect.co")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

// Looked up on every booking (not cached) so admins added, removed or disabled
// are picked up without a restart. Active = not `accountDisabled` (the same flag
// login and token checks use); deleted accounts no longer exist as documents.
const ADMIN_ROLES = ["admin", "superadmin"];
const adminRecipients = async () => {
  const admins = await User.find({
    role: { $in: ADMIN_ROLES },
    accountDisabled: { $ne: true },
    email: { $exists: true, $ne: "" },
  })
    .select("email")
    .lean();
  const unique = new Set();
  for (const admin of admins) {
    const email = String(admin?.email || "").trim().toLowerCase();
    if (email.includes("@")) unique.add(email);
  }
  return [...unique];
};

const patientLabel = (patient) => {
  const name = patient?.name || "Patient";
  return patient?.patientId ? `${name} (ID ${patient.patientId})` : name;
};

const validTimeZone = (tz) => {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// Booking date/time strings are in the patient's timezone. When a UTC instant
// and a valid target timezone are known, show the instant in that timezone;
// otherwise fall back to the stored strings, labelled with the patient's zone.
const whenText = ({ date, time, utc, patientTimezone, targetTimezone }) => {
  const instant = utc ? new Date(utc) : null;
  if (instant && !Number.isNaN(instant.getTime()) && validTimeZone(targetTimezone)) {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: targetTimezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(instant);
    return `${formatted} (${targetTimezone})`;
  }
  const base = [date, time].filter(Boolean).join(" ");
  if (!base) return "";
  return patientTimezone ? `${base} (${patientTimezone})` : base;
};

const safely = async (label, fn) => {
  try {
    await fn();
  } catch (err) {
    console.error(`[booking-notify] ${label} failed (non-fatal):`, err.message);
  }
};

const sendAdminEmail = async ({ subject, intro, rows, path }) => {
  const recipients = await adminRecipients();
  if (!recipients.length) {
    console.warn("[booking-notify] No active admin/superadmin users with an email found; skipping admin booking email.");
    return;
  }
  const payload = {
    subject,
    badge: "New Booking",
    greeting: "Hello Admin,",
    intro,
    rows,
    ctaUrl: path ? `${frontendBase()}${path}` : "",
    ctaLabel: "View in admin dashboard",
  };
  // One message per admin so recipients never see each other's addresses; one
  // failed send is logged and must not stop the rest.
  for (const to of recipients) {
    await safely(`admin booking email to ${to}`, () => mailer.sendBookingNotificationEmail(to, payload));
  }
};

const sendDoctorEmail = async ({ to, doctorName, variant, rows, subject, intro, badge }) => {
  if (!to) {
    console.warn(`[booking-notify] ${variant} email skipped: doctor has no email address.`);
    return;
  }
  await mailer.sendBookingNotificationEmail(to, {
    subject,
    badge,
    greeting: doctorName ? `Hello Dr. ${doctorName},` : "Hello Doctor,",
    intro,
    rows,
    ctaUrl: `${frontendBase()}/doctor-dashboard/appointments`,
    ctaLabel: "Go to your dashboard",
  });
};

const doctorEmailCopy = {
  "direct-booking": {
    subject: "Humancare Connect — New appointment booked with you",
    badge: "New Appointment",
    intro: "A patient has booked an appointment with you.",
  },
  assigned: {
    subject: "Humancare Connect — New case assigned to you",
    badge: "Case Assigned",
    intro: "A case has been assigned to you by the Humancare Connect team.",
  },
  reassigned: {
    subject: "Humancare Connect — Case reassigned to you",
    badge: "Case Reassigned",
    intro: "This case has been reassigned to you by the Humancare Connect team.",
  },
};

const notifyDoctorAssigned = async ({ to, doctorName, variant, patient, when, category, specialty }) =>
  safely(`doctor ${variant} email`, () =>
    sendDoctorEmail({
      to,
      doctorName,
      variant,
      ...doctorEmailCopy[variant],
      rows: [
        ["Patient", patientLabel(patient)],
        ["Date / time", when],
        ["Category", category],
        ["Specialty", specialty],
      ],
    })
  );

// Deliberately no patient name or link: the doctor no longer has access.
const notifyDoctorUnassigned = async ({ to, doctorName, patient, when, category }) =>
  safely("previous-doctor unassigned email", async () => {
    if (!to) {
      console.warn("[booking-notify] unassigned email skipped: previous doctor has no email address.");
      return;
    }
    await mailer.sendBookingNotificationEmail(to, {
      subject: "Humancare Connect — Case no longer assigned to you",
      badge: "Case Unassigned",
      greeting: doctorName ? `Hello Dr. ${doctorName},` : "Hello Doctor,",
      intro: "The case below is no longer assigned to you. No further action is needed on your part.",
      rows: [
        ["Patient ID", patient?.patientId || ""],
        ["Date / time", when],
        ["Category", category],
      ],
    });
  });

const fetchPatient = (id) =>
  id ? User.findById(id).select("name patientId").lean() : Promise.resolve(null);

const doctorFullName = (enrollment) =>
  `${enrollment?.firstName || ""} ${enrollment?.surname || ""}`.trim();

// Enrollment.email is not required by the schema; fall back to the linked Doctor.
const enrollmentEmail = async (enrollment) => {
  if (enrollment?.email) return enrollment.email;
  if (!enrollment?.doctorId) return "";
  const doctor = await Doctor.findById(enrollment.doctorId).select("email").lean();
  return doctor?.email || "";
};

// ── Booking created ────────────────────────────────────────────────────────

// `appointment` is the created Appointment; `doctor` the booked Doctor
// document (null for category bookings with no doctor chosen yet).
async function notifyAppointmentBooked({ appointment, patient, doctor }) {
  await safely("appointment booking notifications", async () => {
    const patientInfo = patient || (await fetchPatient(appointment.patientId));
    const specialty = appointment.specialty || appointment.condition || "";
    const id = String(appointment._id);

    await safely("admin booking email", () =>
      sendAdminEmail({
        subject: doctor
          ? `Humancare Connect — New appointment booked (Dr. ${doctor.name})`
          : `Humancare Connect — New appointment request (${appointment.category || "Category"})`,
        intro: doctor
          ? "A patient has booked an appointment directly with a doctor."
          : "A patient has submitted an appointment request. A doctor still needs to be assigned.",
        rows: [
          ["Patient", patientLabel(patientInfo)],
          ["Date / time", whenText({
            date: appointment.date,
            time: appointment.time,
            patientTimezone: appointment.patientTimezone,
          })],
          ["Category", appointment.category],
          ["Specialty", specialty],
          ["Doctor", doctor ? `Dr. ${doctor.name}` : "Not assigned yet"],
        ],
        path: `/admin-dashboard/appointments/${id}`,
      })
    );

    if (doctor) {
      const enrollment = await Enrollment.findOne({ doctorId: doctor._id }).select("timezone").lean();
      await notifyDoctorAssigned({
        to: doctor.email,
        doctorName: doctor.name,
        variant: "direct-booking",
        patient: patientInfo,
        when: whenText({
          date: appointment.date,
          time: appointment.time,
          utc: appointment.appointmentDateTimeUtc,
          patientTimezone: appointment.patientTimezone,
          targetTimezone: enrollment?.timezone,
        }),
        category: appointment.category,
        specialty,
      });
    }
  });
}

const consultationWhen = (cc) => {
  const flexible =
    (cc.appointmentType || (cc.urgency === "flexible" ? "FLEXIBLE_TIME" : "NEXT_AVAILABLE")) === "FLEXIBLE_TIME";
  const time = flexible ? cc.slot : cc.assignedSlot || "Next Available";
  return whenText({ date: cc.date, time });
};

async function notifyCategoryConsultationBooked({ consultation }) {
  await safely("category booking notification", async () => {
    const patient = await fetchPatient(consultation.patientId);
    await sendAdminEmail({
      subject: `Humancare Connect — New appointment request (${consultation.categoryName || "Category"})`,
      intro: "A patient has submitted a category consultation request. A doctor still needs to be assigned.",
      rows: [
        ["Patient", patientLabel(patient)],
        ["Date / time", consultationWhen(consultation)],
        ["Category", consultation.categoryName],
        ["Specialty", consultation.specialtyName || consultation.serviceName],
        ["Doctor", "Not assigned yet"],
      ],
      path: `/admin-dashboard/category-consultations/${consultation._id}`,
    });
  });
}

// ── Doctor changed ─────────────────────────────────────────────────────────

// Called only when the doctor actually changed. `previousDoctorId` is the
// previous Doctor _id (or null on a first assignment).
async function notifyAppointmentDoctorChanged({ appointment, newDoctor, previousDoctorId }) {
  await safely("appointment assignment notifications", async () => {
    const patient = await fetchPatient(appointment.patientId);
    const specialty = appointment.specialty || appointment.condition || "";
    const enrollment = await Enrollment.findOne({ doctorId: newDoctor._id }).select("timezone").lean();

    await notifyDoctorAssigned({
      to: newDoctor.email,
      doctorName: newDoctor.name,
      variant: previousDoctorId ? "reassigned" : "assigned",
      patient,
      when: whenText({
        date: appointment.date,
        time: appointment.time,
        utc: appointment.appointmentDateTimeUtc,
        patientTimezone: appointment.patientTimezone,
        targetTimezone: appointment.doctorTimezone || enrollment?.timezone,
      }),
      category: appointment.category,
      specialty,
    });

    if (previousDoctorId) {
      const previous = await Doctor.findById(previousDoctorId).select("name email").lean();
      const previousEnrollment = await Enrollment.findOne({ doctorId: previousDoctorId }).select("timezone").lean();
      await notifyDoctorUnassigned({
        to: previous?.email,
        doctorName: previous?.name,
        patient,
        when: whenText({
          date: appointment.date,
          time: appointment.time,
          utc: appointment.appointmentDateTimeUtc,
          patientTimezone: appointment.patientTimezone,
          targetTimezone: previousEnrollment?.timezone,
        }),
        category: appointment.category,
      });
    }
  });
}

// `newEnrollment` / `previousEnrollmentId` are Enrollment documents/ids, as
// stored in CategoryConsultation.assignedDoctorId.
async function notifyConsultationDoctorChanged({ consultation, newEnrollment, previousEnrollmentId }) {
  await safely("category assignment notifications", async () => {
    const patient = await fetchPatient(consultation.patientId);
    const when = consultationWhen(consultation);

    await notifyDoctorAssigned({
      to: await enrollmentEmail(newEnrollment),
      doctorName: doctorFullName(newEnrollment),
      variant: previousEnrollmentId ? "reassigned" : "assigned",
      patient,
      when,
      category: consultation.categoryName,
      specialty: consultation.specialtyName || consultation.serviceName,
    });

    if (previousEnrollmentId) {
      const previous = await Enrollment.findById(previousEnrollmentId)
        .select("firstName surname email doctorId")
        .lean();
      await notifyDoctorUnassigned({
        to: await enrollmentEmail(previous),
        doctorName: doctorFullName(previous),
        patient,
        when,
        category: consultation.categoryName,
      });
    }
  });
}

module.exports = {
  notifyAppointmentBooked,
  notifyCategoryConsultationBooked,
  notifyAppointmentDoctorChanged,
  notifyConsultationDoctorChanged,
  // exported for tests
  _internals: { whenText, adminRecipients, patientLabel },
};
