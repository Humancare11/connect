// Safe creator for admin notifications (Phase 1). Like the direct-call alert
// engine and bookingNotifications, it NEVER throws: callers can invoke it after
// the business write has succeeded and ignore the result without risking the
// request. The result says what happened:
//   { status: "created", id } | { status: "deduplicated" }
//   | { status: "invalid", reason } | { status: "failed" }
const mongoose = require("mongoose");
const AdminNotification = require("../models/AdminNotification");

const clean = (value, max) => String(value ?? "").trim().slice(0, max);

async function createAdminNotification(
  { type, title, message = "", refType = null, refId = "", link = "", dedupeKey } = {},
  { Model = AdminNotification } = {},
) {
  try {
    if (!AdminNotification.NOTIFICATION_TYPES.includes(type)) return { status: "invalid", reason: "type" };
    const cleanTitle = clean(title, 120);
    if (!cleanTitle) return { status: "invalid", reason: "title" };
    if (refType != null && !AdminNotification.REF_TYPES.includes(refType)) return { status: "invalid", reason: "refType" };
    const cleanLink = clean(link, 300);
    if (cleanLink && !AdminNotification.isInternalAdminLink(cleanLink)) return { status: "invalid", reason: "link" };

    const doc = {
      type,
      title: cleanTitle,
      message: clean(message, 300),
      refType: refType ?? null,
      refId: clean(refId, 64),
      link: cleanLink,
    };
    // Leave the field absent (not "") so the sparse unique index ignores it.
    const key = clean(dedupeKey, 200);
    if (key) doc.dedupeKey = key;

    const created = await Model.create(doc);
    return { status: "created", id: String(created?._id ?? "") };
  } catch (err) {
    if (err?.code === 11000) return { status: "deduplicated" };
    // Message only: never the document, which may carry names or ids.
    console.warn("[admin-notifications] failed to create notification:", err?.message);
    return { status: "failed" };
  }
}


// ── Patient bookings ─────────────────────────────────────────────────────
// Content is limited to doctor name, category/specialty, date and time. Never
// patient identity or contact details, free-text concerns, reports or payment
// references. /admin-dashboard/appointments/:id opens either record kind:
// getAppointmentById falls back from Appointment to CategoryConsultation.
const joinParts = (parts) => parts.map((p) => String(p ?? "").trim()).filter(Boolean).join(" · ");

// Both wrappers never throw (the helper never does, and building is guarded),
// so controllers can call them after the response without awaiting.
async function notifyAdminAppointmentBooked({ appointment, doctor } = {}, options) {
  try {
    const id = String(appointment._id);
    return await createAdminNotification(
      {
        type: "appointment_created",
        title: doctor ? "New appointment booked" : "New appointment request",
        message: joinParts([
          doctor?.name ? `Dr. ${doctor.name}` : "No doctor assigned yet",
          appointment.category,
          appointment.specialty,
          appointment.date,
          appointment.time,
        ]),
        refType: "appointment",
        refId: id,
        link: `/admin-dashboard/appointments/${id}`,
        dedupeKey: `appointment_created:${id}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build appointment notification:", err?.message);
    return { status: "failed" };
  }
}

// FLEXIBLE_TIME requests carry the patient-chosen slot; others have none yet.
async function notifyAdminCategoryConsultationBooked({ consultation } = {}, options) {
  try {
    const id = String(consultation._id);
    const flexible =
      (consultation.appointmentType || (consultation.urgency === "flexible" ? "FLEXIBLE_TIME" : "NEXT_AVAILABLE")) ===
      "FLEXIBLE_TIME";
    return await createAdminNotification(
      {
        type: "appointment_created",
        title: "New appointment request",
        message: joinParts([
          "No doctor assigned yet",
          consultation.categoryName,
          consultation.specialtyName || consultation.serviceName,
          consultation.date,
          flexible ? consultation.slot : "Next available",
        ]),
        refType: "appointment",
        refId: id,
        link: `/admin-dashboard/appointments/${id}`,
        dedupeKey: `appointment_created:category:${id}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build category notification:", err?.message);
    return { status: "failed" };
  }
}

// ── Doctor registration / enrollment ─────────────────────────────────────
// Both link to /admin-dashboard/doctor-profile/:id, which loads an *Enrollment*
// by id (getDoctorById), so the link always uses the enrollment id. Content is
// limited to the name and specialization: no email, phone, documents or
// anything else from the application form.
const plainText = (value, max = 80) =>
  String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

async function notifyAdminDoctorRegistered({ doctor, enrollment } = {}, options) {
  try {
    const name = plainText(doctor.name) || "A doctor";
    return await createAdminNotification(
      {
        type: "doctor_registered",
        title: "New doctor registered",
        message: `${name} created an account. Enrollment form not submitted yet.`,
        refType: "doctor",
        refId: String(doctor._id),
        link: `/admin-dashboard/doctor-profile/${enrollment._id}`,
        dedupeKey: `doctor_registered:${doctor._id}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build doctor registration notification:", err?.message);
    return { status: "failed" };
  }
}

// resubmittedFrom: the enrollment updatedAt (ms) from before a rejected doctor
// resubmitted. It keeps a resubmission distinct from the first submission.
async function notifyAdminEnrollmentSubmitted({ enrollment, doctor, resubmittedFrom } = {}, options) {
  try {
    const id = String(enrollment._id);
    const name =
      plainText([enrollment.firstName, enrollment.surname].filter(Boolean).join(" ")) ||
      plainText(doctor?.name) ||
      "A doctor";
    const specialization = plainText(enrollment.specialization);
    const resubmitted = resubmittedFrom != null;
    return await createAdminNotification(
      {
        type: "doctor_enrollment_submitted",
        title: resubmitted ? "Doctor enrollment resubmitted" : "Doctor enrollment submitted",
        message:
          [name, specialization].filter(Boolean).join(" · ") +
          (resubmitted ? " resubmitted the application after rejection." : " submitted an application for review."),
        refType: "enrollment",
        refId: id,
        link: `/admin-dashboard/doctor-profile/${id}`,
        dedupeKey: resubmitted
          ? `doctor_enrollment_submitted:${id}:resubmitted:${Number(resubmittedFrom)}`
          : `doctor_enrollment_submitted:${id}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build enrollment notification:", err?.message);
    return { status: "failed" };
  }
}

// ── Partner cases ────────────────────────────────────────────────────────
// A new case submitted by a partner company (POST /api/partner/cases, the only
// place PartnerCase is created). /admin-dashboard/partner-cases/:id loads the
// case by its own _id. Content is limited to the case number, the partner
// company, service type and urgency: no patient fields, complaint or documents.
const SERVICE_LABELS = { teleconsultation: "Teleconsultation", "house-call": "House call", "in-clinic": "In-clinic" };

async function notifyAdminPartnerCaseCreated({ partnerCase, partnerId } = {}, options) {
  try {
    const id = String(partnerCase._id);
    let companyName = "";
    try {
      // Looked up after the response; a failure only means the company name is omitted.
      const company = await require("../models/Partner").findById(partnerId ?? partnerCase.partner).select("companyName").lean();
      companyName = plainText(company?.companyName);
    } catch {
      companyName = "";
    }
    const urgency = partnerCase.urgency && partnerCase.urgency !== "routine" ? `${plainText(partnerCase.urgency, 20)} urgency` : "";
    return await createAdminNotification(
      {
        type: "partner_case_created",
        title: "New partner case",
        message: [
          plainText(partnerCase.caseNumber, 40),
          companyName,
          SERVICE_LABELS[partnerCase.serviceType] || "",
          urgency,
        ].filter(Boolean).join(" · "),
        refType: "partner_case",
        refId: id,
        link: `/admin-dashboard/partner-cases/${id}`,
        dedupeKey: `partner_case_created:${id}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build partner case notification:", err?.message);
    return { status: "failed" };
  }
}

// ── Support tickets ──────────────────────────────────────────────────────
// Two separate models: Ticket (doctors, POST /api/tickets/create) and UserTicket
// (patients, POST /api/tickets/user/create). The admin page /admin-dashboard/tickets
// is a list with Patient/Doctor tabs and has no per-ticket route or URL parameter,
// so the link goes to the list and the message says which kind it is. Ticket titles
// and descriptions are free text and are never copied; only the kind, the patient
// ticket category (a fixed enum) and a short reference are shown.
async function notifyAdminSupportTicketCreated({ ticket, source } = {}, options) {
  try {
    const kind = source === "doctor" ? "doctor" : "patient";
    const id = String(ticket._id);
    const category = kind === "patient" && ticket.category ? `${plainText(ticket.category, 20)} category` : "";
    return await createAdminNotification(
      {
        type: "support_ticket_created",
        title: kind === "doctor" ? "New doctor support ticket" : "New patient support ticket",
        message: [kind === "doctor" ? "Doctor ticket" : "Patient ticket", category, `Ref ${id.slice(-6)}`]
          .filter(Boolean)
          .join(" · "),
        refType: kind === "doctor" ? "ticket" : "user_ticket",
        refId: id,
        link: "/admin-dashboard/tickets",
        dedupeKey: `support_ticket_created:${kind}:${id}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build support ticket notification:", err?.message);
    return { status: "failed" };
  }
}

// ── Patient account deletion requests ────────────────────────────────────
// Raised once per successfully saved request (POST /api/auth/account-delete-request).
// /admin-dashboard/deletion-requests is the admin list page; it has no per-request
// route. Content is limited to the patient's name: never the deletion reason, email
// or phone. The key includes the request time so a request made again after a
// cancellation is a new alert, while a retry of the same request is not.
async function notifyAdminAccountDeletionRequested({ user } = {}, options) {
  try {
    const id = String(user._id);
    const name = plainText(user.name) || "A patient";
    const requestedAt = user.deletionRequestedAt ? new Date(user.deletionRequestedAt).getTime() : 0;
    return await createAdminNotification(
      {
        type: "account_deletion_requested",
        title: "Patient account deletion requested",
        message: `${name} requested account deletion.`,
        refType: "user",
        refId: id,
        link: "/admin-dashboard/deletion-requests",
        dedupeKey: `account_deletion_requested:${id}:${requestedAt}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build account deletion notification:", err?.message);
    return { status: "failed" };
  }
}

// ── Doctor profile updates ───────────────────────────────────────────────
// An approved doctor's self-service edit (POST /api/doctor/enrollment with real
// changes), staged for admin review. Links to /admin-dashboard/doctor-profile/:id,
// which loads an Enrollment, so the link and refId use the enrollment id. Content is
// the doctor's name only: never which fields changed or their values. The key
// includes the time of this update so each edit is its own alert, while a retry of
// the same edit is not.
async function notifyAdminDoctorProfileUpdated({ enrollment, doctor } = {}, options) {
  try {
    const id = String(enrollment._id);
    const name =
      plainText(doctor?.name) ||
      plainText([enrollment.firstName, enrollment.surname].filter(Boolean).join(" ")) ||
      "A doctor";
    const updatedAt = enrollment.profileUpdateRequestedAt ? new Date(enrollment.profileUpdateRequestedAt).getTime() : 0;
    return await createAdminNotification(
      {
        type: "doctor_profile_updated",
        title: "Doctor profile updated",
        message: `${name} updated their profile.`,
        refType: "enrollment",
        refId: id,
        link: `/admin-dashboard/doctor-profile/${id}`,
        dedupeKey: `doctor_profile_updated:${id}:${updatedAt}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build doctor profile update notification:", err?.message);
    return { status: "failed" };
  }
}

// ── Doctor confirms / completes an appointment ───────────────────────────
// Raised once per persisted transition by the doctor (PUT /api/appointments/:id/confirm
// and /complete; the admin-complete route is not a doctor action). Handles both
// Appointment and CategoryConsultation, which share /admin-dashboard/appointments/:id.
// Content is limited to doctor name, category/specialty, date and time: no patient
// identity, concern, reports or payment. `transitionFrom` is the record's updatedAt
// (ms) from before the transition, so a booking reopened by an admin and then
// confirmed/completed again is a new alert, while a concurrent duplicate request that
// read the same prior state is not.
async function notifyAdminAppointmentDoctorAction({ appointment, isCategory, doctorId, action, transitionFrom } = {}, options) {
  try {
    const completed = action === "completed";
    const id = String(appointment._id);
    let doctorName = "";
    try {
      const doctor = await require("../models/Doctor").findById(doctorId).select("name").lean();
      doctorName = plainText(doctor?.name);
    } catch {
      doctorName = "";
    }
    const details = isCategory
      ? [appointment.categoryName, appointment.specialtyName || appointment.serviceName, appointment.date, appointment.assignedSlot || appointment.slot]
      : [appointment.category, appointment.specialty, appointment.date, appointment.time];
    return await createAdminNotification(
      {
        type: completed ? "appointment_completed_by_doctor" : "appointment_confirmed_by_doctor",
        title: completed ? "Appointment completed by doctor" : "Appointment confirmed by doctor",
        message: joinParts([doctorName ? `Dr. ${doctorName}` : "Doctor", ...details]),
        refType: "appointment",
        refId: id,
        link: `/admin-dashboard/appointments/${id}`,
        dedupeKey: `appointment_${completed ? "completed" : "confirmed"}_by_doctor:${id}:${Number(transitionFrom) || 0}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build appointment action notification:", err?.message);
    return { status: "failed" };
  }
}

// ── Doctor profile deletion requests ─────────────────────────────────────
// Raised once per saved request (POST /api/doctor/profile-delete-request). Unlike the
// patient flow this lives on the Enrollment, and admins review it on the doctor profile
// page /admin-dashboard/doctor-profile/:enrollmentId (which shows the request), so the
// link and refId use the enrollment id. Content is the doctor's name only: never the
// reason, email or phone. The key includes the request time, so a request made again
// after a rejection is a new alert, while a retry of the same request is not.
async function notifyAdminDoctorDeletionRequested({ enrollment, doctor } = {}, options) {
  try {
    const id = String(enrollment._id);
    const name =
      plainText(doctor?.name) ||
      plainText([enrollment.firstName, enrollment.surname].filter(Boolean).join(" ")) ||
      "A doctor";
    const requestedAt = enrollment.profileDeleteRequestedAt ? new Date(enrollment.profileDeleteRequestedAt).getTime() : 0;
    return await createAdminNotification(
      {
        type: "doctor_account_deletion_requested",
        title: "Doctor account deletion requested",
        message: `Dr. ${name} requested account deletion.`,
        refType: "enrollment",
        refId: id,
        link: `/admin-dashboard/doctor-profile/${id}`,
        dedupeKey: `doctor_account_deletion_requested:${id}:${requestedAt}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build doctor deletion notification:", err?.message);
    return { status: "failed" };
  }
}

// ── Paid but not booked ──────────────────────────────────────────────────
// The only authoritative payment problem the app can observe: the gateway confirmed the
// payment server-side (verifyStripePaymentIntent / verifyPaypalOrder) but the booking
// write then failed, so the patient is charged with no booking and support must
// reconcile or refund by hand. There are no gateway webhooks, no decline events and no
// refund flow in the app, so nothing else is raised. The destination is the admin
// bookings list; no booking exists to link to. Content is the gateway, amount and the
// gateway reference needed to find the payment (not a secret): never patient details.
// The key is the gateway reference, so a patient retrying the same payment is not a
// second alert.
const GATEWAY_LABELS = { stripe: "Stripe", paypal: "PayPal" };

async function notifyAdminPaymentNeedsReconciliation({ gateway, ref, amountCents } = {}, options) {
  try {
    const cleanRef = plainText(ref, 64);
    if (!cleanRef) return { status: "invalid", reason: "ref" };
    const key = String(gateway).toLowerCase() === "paypal" ? "paypal" : "stripe";
    const cents = Number(amountCents);
    const amount = Number.isFinite(cents) ? `$${(cents / 100).toFixed(2)}` : "";
    return await createAdminNotification(
      {
        type: "payment_needs_reconciliation",
        title: "Payment received, booking not created",
        message: `${[GATEWAY_LABELS[key], amount].filter(Boolean).join(" · ")} payment ${cleanRef} was received but the booking could not be completed. Reconcile or refund manually.`,
        refType: null,
        refId: cleanRef,
        link: "/admin-dashboard/appointments",
        dedupeKey: `payment_needs_reconciliation:${key}:${cleanRef}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build payment notification:", err?.message);
    return { status: "failed" };
  }
}

// ── Doctor application decisions ─────────────────────────────────────────
// An admin's approve / reject of a doctor's enrollment application
// (PUT /api/admin/doctors/:id/approve and /reject). Only genuine changes of the
// application status are raised: not re-approving an approved doctor, not rejecting
// an already-rejected one, and not the approve/reject of a staged profile update.
// Links to /admin-dashboard/doctor-profile/:id (an Enrollment id). Content is the
// doctor's name only. `decidedFrom` is the enrollment updatedAt (ms) from before the
// decision, so a doctor rejected and later approved is a new alert while a duplicate
// request that read the same prior state is not.
async function notifyAdminDoctorDecision({ enrollment, doctor, decision, decidedFrom } = {}, options) {
  try {
    const approved = decision === "approved";
    const id = String(enrollment._id);
    const name =
      plainText(doctor?.name) ||
      plainText([enrollment.firstName, enrollment.surname].filter(Boolean).join(" ")) ||
      "A doctor";
    return await createAdminNotification(
      {
        type: approved ? "doctor_approved" : "doctor_rejected",
        title: approved ? "Doctor approved" : "Doctor application rejected",
        message: approved ? `Dr. ${name} was approved.` : `Dr. ${name}'s application was rejected.`,
        refType: "enrollment",
        refId: id,
        link: `/admin-dashboard/doctor-profile/${id}`,
        dedupeKey: `${approved ? "doctor_approved" : "doctor_rejected"}:${id}:${Number(decidedFrom) || 0}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build doctor decision notification:", err?.message);
    return { status: "failed" };
  }
}

// ── Partner case activity ────────────────────────────────────────────────
// What a partner does to an existing case that needs admin attention (the partner
// routes in routes/partner.js): cancelling a still-"submitted" case, and posting a
// message on it. New cases are covered by notifyAdminPartnerCaseCreated; partner
// companies and their logins are created and managed only by a Super Admin, and the
// app has no vendor concept, so nothing else is raised. Links to
// /admin-dashboard/partner-cases/:id. Content is the case number and company: never the
// message text, patient fields or documents. A cancellation is final, so it is keyed by
// case; each message is keyed by its own id, so a retry is not a second alert.
async function notifyAdminPartnerCaseActivity({ partnerCase, partnerId, action, messageId } = {}, options) {
  try {
    const id = String(partnerCase._id);
    const cancelled = action === "cancelled";
    let companyName = "";
    try {
      const company = await require("../models/Partner").findById(partnerId ?? partnerCase.partner).select("companyName").lean();
      companyName = plainText(company?.companyName);
    } catch {
      companyName = "";
    }
    if (!cancelled && !messageId) return { status: "invalid", reason: "messageId" };
    return await createAdminNotification(
      {
        type: cancelled ? "partner_case_cancelled" : "partner_case_message",
        title: cancelled ? "Partner case cancelled" : "New partner message",
        message: [plainText(partnerCase.caseNumber, 40), companyName, cancelled ? "Cancelled by the partner" : "Message from the partner"]
          .filter(Boolean)
          .join(" · "),
        refType: "partner_case",
        refId: id,
        link: `/admin-dashboard/partner-cases/${id}`,
        dedupeKey: cancelled ? `partner_case_cancelled:${id}` : `partner_case_message:${id}:${String(messageId)}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build partner case activity notification:", err?.message);
    return { status: "failed" };
  }
}

// ── Security events ──────────────────────────────────────────────────────
// Raised from utils/securityMonitor.js, which is server-side only: no endpoint creates a
// notification, so a caller can't forge one. The app has no security/audit page (activity
// logging is intentionally not persisted), so both link to the closest real admin
// destination, /admin-dashboard/manage-users, where accounts can be reviewed.
// Content is factual and minimal: the portal or the role and event title. Never an email,
// IP address, password, OTP, token or request body.
const SECURITY_LINK = "/admin-dashboard/manage-users";

// The existing "multiple failed logins" threshold (5th failed attempt from the same IP
// or email within 15 minutes). One alert per portal per 15-minute window, however many
// emails or addresses are tried, so an attacker can't flood the bell. This says the
// attempts failed, not that they were an attack.
async function notifyAdminRepeatedFailedLogins({ portal, windowStart } = {}, options) {
  try {
    const where = plainText(portal, 30) || "unknown";
    return await createAdminNotification(
      {
        type: "security_repeated_failed_logins",
        title: "Repeated failed logins",
        message: `5 or more failed sign-in attempts within 15 minutes on the ${where} portal.`,
        refType: null,
        link: SECURITY_LINK,
        dedupeKey: `security_repeated_failed_logins:${where}:${Number(windowStart) || 0}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build failed login notification:", err?.message);
    return { status: "failed" };
  }
}

// A "critical" severity security event (today: an authenticated non-superadmin hitting a
// superadmin-only route, which also revokes that account's sessions). One alert per event
// type and account per hour.
async function notifyAdminCriticalSecurityEvent({ type, title, userId, userRole, hourBucket } = {}, options) {
  try {
    const who = userId && mongoose.isValidObjectId(String(userId)) ? String(userId) : "";
    const role = plainText(userRole, 30) || "unknown";
    return await createAdminNotification(
      {
        type: "security_critical_event",
        title: "Critical security event",
        message: `${plainText(title, 120) || "Critical security event"} (role: ${role}).`,
        refType: who ? "user" : null,
        refId: who,
        link: SECURITY_LINK,
        dedupeKey: `security_critical_event:${plainText(type, 40) || "event"}:${who || "anon"}:${Number(hourBucket) || 0}`,
      },
      options,
    );
  } catch (err) {
    console.warn("[admin-notifications] could not build critical security notification:", err?.message);
    return { status: "failed" };
  }
}

module.exports = {
  notifyAdminRepeatedFailedLogins,
  notifyAdminCriticalSecurityEvent,
  notifyAdminPartnerCaseActivity,
  notifyAdminDoctorDecision,
  notifyAdminPaymentNeedsReconciliation,
  notifyAdminDoctorDeletionRequested,
  notifyAdminAppointmentDoctorAction,
  notifyAdminDoctorProfileUpdated,
  notifyAdminAccountDeletionRequested,
  notifyAdminSupportTicketCreated,
  notifyAdminPartnerCaseCreated,
  createAdminNotification,
  notifyAdminAppointmentBooked,
  notifyAdminCategoryConsultationBooked,
  notifyAdminDoctorRegistered,
  notifyAdminEnrollmentSubmitted,
};
