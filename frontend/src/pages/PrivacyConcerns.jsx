import { useState } from "react";

const privacyTableData = [
  {
    area: "Account Information",
    description: "Name, email address, login credentials, and profile details used to manage your account.",
    retention: "Duration of account + 2 years",
    control: "Yes",
  },
  {
    area: "Medical Information",
    description: "Health records, diagnoses, and treatment data stored securely in our databases, never in cookies.",
    retention: "Up to 7 years",
    control: "Limited",
  },
  {
    area: "Communication Preferences",
    description: "Email and notification settings to personalize how we contact you.",
    retention: "Up to 1 year",
    control: "Yes",
  },
  {
    area: "Analytics Data",
    description: "Anonymized usage patterns collected via Google Analytics to improve platform experience.",
    retention: "Up to 2 years",
    control: "Yes",
  },
];

const sections = [
  {
    number: 1,
    title: "Understanding Your Privacy Rights",
    content: (
      <p className="text-[#1E293B] text-sm leading-relaxed">
        You have the right to access, correct, or delete your personal information at any time. Under applicable
        data protection laws, you may also request restriction of processing, object to certain uses, and exercise
        data portability. Humancare Connect is committed to honoring these rights promptly and transparently.
      </p>
    ),
  },
  {
    number: 2,
    title: "Information We Collect",
    content: (
      <>
        <p className="text-[#1E293B] text-sm leading-relaxed mb-4">
          We collect only the information necessary to deliver safe, effective healthcare coordination services.
          This includes account details you provide, health-related data shared through the platform, and
          technical data from your device interactions.
        </p>
        {/* Table */}
        <div className="overflow-x-auto rounded border border-[#D5E5FF]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#0A1F44] text-white">
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Privacy Area</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Description</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Retention Period</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">User Control</th>
              </tr>
            </thead>
            <tbody>
              {privacyTableData.map((row, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "bg-white" : "bg-[#F8FAFF]"}
                >
                  <td className="px-4 py-3 border-b border-[#D5E5FF] font-medium text-[#1E293B] whitespace-nowrap">{row.area}</td>
                  <td className="px-4 py-3 border-b border-[#D5E5FF] text-[#64748B]">{row.description}</td>
                  <td className="px-4 py-3 border-b border-[#D5E5FF] text-[#64748B] whitespace-nowrap">{row.retention}</td>
                  <td className="px-4 py-3 border-b border-[#D5E5FF] text-[#64748B]">{row.control}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[#64748B] text-xs mt-3 italic">
          We do not sell your personal data to third parties. We do not use data brokers.
        </p>
      </>
    ),
  },
  {
    number: 3,
    title: "How We Protect Your Information",
    content: (
      <p className="text-[#1E293B] text-sm leading-relaxed">
        Humancare Connect employs industry-standard security measures including AES-256 encryption at rest,
        TLS 1.3 for data in transit, and strict role-based access controls. Our systems undergo regular
        third-party audits and penetration testing to ensure your data remains protected at all times.
        Protected Health Information (PHI) is <strong>never</strong> stored in cookies or browser storage.
      </p>
    ),
  },
  {
    number: 4,
    title: "Managing Privacy Preferences",
    content: (
      <ul className="space-y-2 text-sm text-[#1E293B]">
        {[
          { label: "Account Settings:", text: "Update or delete personal information directly from your profile dashboard." },
          { label: "Communication Opt-Out:", text: "Unsubscribe from marketing emails at any time using the link in any email we send." },
          { label: "Cookie Preferences:", text: "Manage non-essential cookies via our cookie banner or browser settings." },
          { label: "Data Deletion Request:", text: "Submit a formal erasure request by emailing privacy@humancareconnect.com." },
        ].map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-[#0B57E8] font-bold mt-0.5">–</span>
            <span><span className="font-semibold">{item.label}</span> {item.text}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    number: 5,
    title: "Contact & Privacy Requests",
    content: (
      <>
        <p className="text-[#1E293B] text-sm leading-relaxed mb-5">
          If you have questions about this policy or wish to exercise your privacy rights, please reach out to
          our dedicated Privacy Team. We respond to all verified requests within 30 days.
        </p>
        {/* Contact card */}
        <div className="bg-[#0A1F44] rounded-xl p-6 text-white">
          <h4 className="font-bold text-base mb-3">Privacy Questions</h4>
          <p className="text-sm text-blue-200 mb-1">
            Email:{" "}
            <a href="mailto:privacy@humancareconnect.com" className="underline text-white hover:text-blue-300 transition-colors">
              privacy@humancareconnect.com
            </a>
          </p>
          <p className="text-sm text-blue-200">
            131 Continental Dr, Suite 305, Newark, DE 19713
          </p>
        </div>
      </>
    ),
  },
];

function SectionBlock({ number, title, content }) {
  return (
    <section className="mb-8">
      {/* Section heading row */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: "#0B57E8" }}
        >
          {number}
        </div>
        <h2 className="text-[#1E293B] font-bold text-base">{title}</h2>
      </div>
      <hr className="border-[#D5E5FF] mb-4" />
      <div>{content}</div>
    </section>
  );
}

export default function PrivacyConcerns() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── Hero Banner ── */}
      <header
        className="w-full py-10 px-4 flex flex-col items-center justify-center text-center"
        style={{ backgroundColor: "#0A1F44" }}
      >
        {/* Pill badge */}
        <span
          className="inline-block text-[10px] font-bold tracking-widest uppercase rounded-full px-3 py-1 mb-4 border"
          style={{
            color: "#90B8F8",
            borderColor: "#1E3A6E",
            backgroundColor: "#0d2554",
          }}
        >
          LEGAL
        </span>

        {/* Title */}
        <h1 className="text-white font-bold text-3xl md:text-4xl mb-3 tracking-tight">
          Privacy Concerns
        </h1>

        {/* Meta */}
        <p className="text-blue-300 text-xs">
          Effective: June 8, 2026&nbsp;&nbsp;|&nbsp;&nbsp;Version 1.0
        </p>
      </header>

      {/* ── Main Content ── */}
      <main className="w-full flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-3xl">

          {/* ── Notice Box ── */}
          <div
            className="rounded-lg px-5 py-4 mb-8 text-sm leading-relaxed border"
            style={{
              backgroundColor: "#EAF3FF",
              borderColor: "#D5E5FF",
              color: "#1E293B",
            }}
          >
            This Privacy Concerns page explains how Humancare Connect handles privacy-related requests, user
            concerns, personal information protection, and data management practices. By using our Platform,
            you consent to our privacy practices as described here.
          </div>

          {/* ── Sections ── */}
          {sections.map((s) => (
            <SectionBlock key={s.number} number={s.number} title={s.title} content={s.content} />
          ))}

        </div>
      </main>
    </div>
  );
}
