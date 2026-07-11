import {
  ShieldCheck,
  CreditCard,
  CalendarX,
  DollarSign,
  CalendarClock,
  UserX,
  Receipt,
  AlertCircle,
  Wallet,
  Users,
  RefreshCw,
  Mail,
} from "lucide-react";

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "28px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingBottom: "20px", marginBottom: "20px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ width: "36px", height: "36px", flexShrink: 0, borderRadius: "10px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
          <Icon size={17} strokeWidth={1.75} />
        </div>
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function RefundCancellation() {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", boxSizing: "border-box" }}>

      {/* ── Banner — */}
      <div style={{ width: "100%", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 28px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 10px", margin: "80px 0 12px" }}>
            <ShieldCheck size={11} />
            HUMANCARE CONNECT, INC.
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#0f172a", margin: "15px 0 4px", letterSpacing: "-0.02em" }}>Refund & Cancellation Policy</h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>Effective Date: June 8, 2026 | Last Updated: June 8, 2026</p>
        </div>
      </div>

      {/* ── Main Content — explicitly centered with inline styles ── */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "750px", padding: "36px 24px 60px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* overview */}
          <SectionCard icon={ShieldCheck} title="Overview">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Humancare Connect, Inc. ("Humancare Connect," "we," "us," or "our") is committed to ensuring patient satisfaction with our telehealth and medical second opinion services.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              This Refund & Cancellation Policy explains your rights and options regarding payments, cancellations, and refunds on the Humancare Connect Platform.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              By booking a consultation through our Platform, you agree to this policy. This policy applies to all services purchased through humancareconnect.co
            </p>
          </SectionCard>

          {/* payment */}
          <SectionCard icon={CreditCard} title="Payment">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              All consultations and services are paid for in advance through our secure payment processor (Stripe).
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Prices are listed on the Platform at the time of booking and are displayed in U.S. Dollars (USD) unless otherwise stated.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Payment is processed at the time of booking confirmation.
            </p>
          </SectionCard>

          {/* cancellation by patient */}
          <SectionCard icon={CalendarX} title="Cancellation by Patient">
            <h4 style={{ marginBottom: "12px" }}>
              Scheduled Video / Audio Consultations
            </h4>

            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Cancelled more than 24 hours before the appointment: Full refund<br />
              • Cancelled within 24 hours of the appointment: No refund<br />
              • No-show (patient does not attend): No refund
            </p>

            <h4 style={{ marginTop: "24px", marginBottom: "12px" }}>
              Asynchronous / Written Second Opinions
            </h4>

            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Cancelled before physician begins review: Full refund<br />
              • Cancelled after physician has begun review: No refund<br />
              • Cancellation requests must be submitted in writing
            </p>
          </SectionCard>

          {/* refund */}
          <SectionCard icon={DollarSign} title="Refund Eligibility">
            <h4 style={{ marginBottom: "12px" }}>
              Full Refund Circumstances
            </h4>

            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Consultation cancelled per eligibility requirements<br />
              • Physician cancelled the consultation and no rescheduling was accepted<br />
              • Technical failure prevented the consultation from occurring<br />
              • You were charged for a service you did not receive
            </p>

            <h4 style={{ marginTop: "24px", marginBottom: "12px" }}>
              Partial Refund or Credit Circumstances
            </h4>

            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Consultation shorter than scheduled because of technical issues<br />
              • Service quality concerns reviewed on a case-by-case basis
            </p>

            <h4 style={{ marginTop: "24px", marginBottom: "12px" }}>
              Non-Refundable Circumstances
            </h4>

            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Disagreement with a physician's medical opinion<br />
              • Services fully rendered<br />
              • Patient no-show<br />
              • Cancellation within the 24-hour window
            </p>
          </SectionCard>

          {/* reshedulling */}
          <SectionCard icon={CalendarClock} title="Rescheduling">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              You may reschedule a consultation at no charge if the request is made more than 24 hours before the appointment.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Requests within 24 hours are subject to availability<br />
              • A fee of up to 20% of the consultation cost may apply
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              To reschedule, use your account dashboard or contact support.
            </p>
          </SectionCard>
          {/* physician  */}
          <SectionCard icon={UserX} title="Physician Cancellations">
            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              If a physician cancels a consultation, we may offer:
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • A full refund to the original payment method<br />
              • Rescheduling with the same or another physician at no additional cost
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Preferences regarding refunds or rescheduling should be communicated within 7 days.
            </p>
          </SectionCard>
          {/* request refund */}
          <SectionCard icon={Receipt} title="How to Request a Refund">
            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Email support with your name, account email, booking reference, and reason for the request<br />
              • Submit requests within 30 days of the original payment date<br />
              • We respond within 5 business days<br />
              • Approved refunds are generally processed within 5–10 business days
            </p>
          </SectionCard>
          {/* charge backs */}
          <SectionCard icon={AlertCircle} title="Chargebacks">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              If you initiate a chargeback before contacting us, we reserve the right to suspend your account while the dispute is reviewed.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We encourage you to contact support first, as most issues can be resolved quickly.
            </p>
          </SectionCard>
          {/* service credits */}
          <SectionCard icon={AlertCircle} title="Chargebacks">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              If you initiate a chargeback before contacting us, we reserve the right to suspend your account while the dispute is reviewed.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We encourage you to contact support first, as most issues can be resolved quickly.
            </p>
          </SectionCard>
          {/* membership */}
          <SectionCard icon={Users} title="Subscription / Membership Plans">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              If Humancare Connect introduces subscription or membership plans in the future, a separate cancellation and refund policy will apply and will be provided at the time of purchase.
            </p>
          </SectionCard>
          {/* modifications  */}
          <SectionCard icon={RefreshCw} title="Modifications to This Policy">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We reserve the right to modify this Refund & Cancellation Policy at any time.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Material changes will generally be announced with advance notice. Continued use of the Platform constitutes acceptance of the revised policy.
            </p>
          </SectionCard>
          {/* Contact */}
          <SectionCard icon={Mail} title="Contact">
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "24px",
              }}
            >
              <p>
                <strong>Email:</strong>{" "}
                <a href="mailto:support@humancareconnect.co">
                  support@humancareconnect.co
                </a>
              </p>

              <p>
                <strong>Humancare Connect, Inc.</strong>
                <br />
                4 Peddlers Row, 1091
                <br />
                Newark, DE 19702, USA
              </p>

              <p>
                <strong>Business Hours:</strong>
                <br />
                Monday–Friday, 9:00 AM – 5:00 PM Eastern Time
              </p>
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );
}