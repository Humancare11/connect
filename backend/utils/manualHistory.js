// The History of a manual entry: who changed what and when, newest first, one group per save. It is built from the row's own audit data:
// `log` (created / edited / deleted, written by every save of the form) and, for older rows, `entry.history` (the table-cell edits of the
// doctor's fee, status, date and comment). Field names are the column headers of the manual sheet; values are shown the way the sheet
// shows them ("Need to pay", "MR received", "20 Oct 2026"). Pure: nothing here touches the database.

// Form key -> column header. The log is written with the header, so what is stored reads the same as what is shown.
const HEADERS = {
  date: "Date",
  company: "Company",
  caseNumber: "Case Number",
  patientName: "Patient Name",
  serviceType: "Type of service",
  otherService: "Other service",
  country: "Patient Country",
  serviceProvider: "Service provider",
  caseStatus: "Status",
  consultationFee: "Consultation Fee",
  doctorFee: "Doctor's Fee",
  mrStatus: "MR status from provider",
  mrSentToCompany: "MR sent status to the companies",
  invoiceSent: "Invoice sent status",
  paymentReceived: "Payment received",
  paymentToProvider: "Payment to Provider",
  paymentReceivedDate: "Payment received date",
  paidDateToProvider: "Paid date to the provider",
  contactNumber: "Contact Number",
  providerNumber: "Service provider number",
  feedbackSent: "Feedback Message Sent",
  feedbackReceived: "Feedback Received",
  comment: "Comment",
};
// Names the log and entry.history used before the headers were used.
const LEGACY = {
  doctor: "Service provider",
  fee: "Consultation Fee",
  time: "Time",
  paidStatus: "Payment to Provider",
  paidOn: "Paid date to the provider",
};

const fieldLabel = (field) => HEADERS[field] || LEGACY[field] || String(field || "");

// What the sheet calls each stored value, per column header.
const VALUE_LABELS = {
  "Type of service": { house_call: "House call", teleconsultation: "Teleconsultation", others: "Others" },
  Status: { open: "Open", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" },
  "MR status from provider": { pending: "MR pending", received: "MR received" },
  "MR sent status to the companies": { not_sent: "Not sent", sent: "MR sent" },
  "Invoice sent status": { not_sent: "Not sent", sent: "Invoice sent" },
  "Payment received": { not_received: "Not received", partly_received: "Partly received", received: "Paid" },
  "Payment to Provider": { unpaid: "Need to pay", on_hold: "On hold", paid: "Paid", not_payable: "Not payable" },
};
const DATE_FIELDS = new Set(["Date", "Payment received date", "Paid date to the provider"]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function displayValue(label, value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (text === "") return "—";
  if (DATE_FIELDS.has(label)) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (m) return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  }
  return VALUE_LABELS[label]?.[text] ?? text;
}

const ROLE_LABELS = { admin: "Admin", superadmin: "Super Admin" };
const roleLabel = (role) => ROLE_LABELS[role] || (role ? String(role) : "");

const timeOf = (value) => new Date(value || 0).getTime();
const whoKey = (by) => String(by?.id || by?.email || by?.name || "");

// The history of a stored manual row:
//   groups  [{ by: { name, email, role, roleLabel }, at, created: boolean, items: [{ field, from, to }] }], newest first
//   count   how many field changes there are (the number on the History button; "created" is not counted)
function buildHistory(doc) {
  const groups = new Map();
  const group = (by, at, created = false) => {
    const key = `${whoKey(by)}|${timeOf(at)}|${created ? "c" : "e"}`;
    if (!groups.has(key)) {
      groups.set(key, {
        by: { name: by?.name || by?.email || "Unknown", email: by?.email || "", role: by?.role || "", roleLabel: roleLabel(by?.role) },
        at: at ? new Date(at).toISOString() : null,
        created,
        items: [],
      });
    }
    return groups.get(key);
  };
  const logged = new Set();

  for (const line of doc?.log || []) {
    if (line.action === "created") {
      group(line.by, line.at, true);
    } else if (line.action === "edited") {
      const label = fieldLabel(line.field);
      logged.add(`${timeOf(line.at)}|${label}`);
      group(line.by, line.at).items.push({ field: label, from: displayValue(label, line.from), to: displayValue(label, line.to) });
    }
  }
  // Table-cell edits of older rows that were not written to the log.
  for (const change of doc?.entry?.history || []) {
    const label = fieldLabel(change.field);
    if (logged.has(`${timeOf(change.at)}|${label}`)) continue;
    group(change.by, change.at).items.push({ field: label, from: displayValue(label, change.from), to: displayValue(label, change.to) });
  }

  const list = [...groups.values()].sort((x, y) => timeOf(y.at) - timeOf(x.at) || (x.created ? 1 : 0) - (y.created ? 1 : 0));
  return { groups: list, count: list.reduce((n, g) => n + g.items.length, 0) };
}

module.exports = { HEADERS, LEGACY, VALUE_LABELS, fieldLabel, displayValue, roleLabel, buildHistory };
