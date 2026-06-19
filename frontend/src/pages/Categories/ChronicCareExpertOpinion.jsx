import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiArrowRight, FiChevronDown, FiChevronUp, FiX,
  FiStar, FiClock, FiVideo, FiMapPin, FiCheckCircle,
  FiCalendar, FiUser, FiHeart, FiAlertCircle,
  FiActivity, FiMessageSquare, FiShield, FiPhone, FiPlus, FiMinus
} from "react-icons/fi";

// ─── CSS Variables & Global Styles ───────────────────────────────────────────
const GLOBAL_CSS = `
  :root {
    --navy:   #1E3A5F;
    --blue:   #2563EB;
    --blue-lt:#60A5FA;
    --gold:   #C97B1A;
    --bg:     #F4F7FB;
    --tint:   #DCE6F2;
    --white:  #fff;
    --muted:  rgba(30,58,95,.6);
    --line:   rgba(30,58,95,.1);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Satoshi', 'DM Sans', -apple-system, sans-serif; background: var(--bg); color: var(--navy); }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--tint); border-radius: 99px; }

  .hcc-hero {
    position: relative;
    min-height: 520px;
    background: linear-gradient(100deg, #0d2240 0%, #1E3A5F 55%, #1a3356 100%);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
  .hcc-hero-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(13,34,64,0.92) 0%, rgba(13,34,64,0.7) 55%, rgba(13,34,64,0.45) 100%);
    pointer-events: none;
  }
  .hcc-hero-deco-1 {
    position: absolute; right: 340px; top: -80px;
    width: 340px; height: 340px; border-radius: 50%;
    border: 1px solid rgba(96,165,250,0.12);
    pointer-events: none;
  }
  .hcc-hero-deco-2 {
    position: absolute; right: 200px; bottom: -120px;
    width: 480px; height: 480px; border-radius: 50%;
    border: 1px solid rgba(96,165,250,0.08);
    pointer-events: none;
  }
  .hcc-hero-icon {
    position: absolute;
    opacity: 0.12;
    color: var(--blue-lt);
    pointer-events: none;
  }

  .hcc-inner {
    position: relative;
    z-index: 2;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
    padding: 100px clamp(20px,5vw,80px) 56px;
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 56px;
    align-items: center;
    flex: 1;
  }

  .hcc-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: rgba(37,99,235,0.22);
    border: 1px solid rgba(96,165,250,0.35);
    border-radius: 50px;
    padding: 6px 16px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--blue-lt);
    margin-bottom: 22px;
  }
  .hcc-badge-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--blue-lt);
    box-shadow: 0 0 6px var(--blue-lt);
    animation: blink 2s ease-in-out infinite;
  }
  @keyframes blink {
    0%,100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .hcc-headline {
    font-size: clamp(32px, 5vw, 58px);
    font-weight: 800;
    color: #fff;
    line-height: 1.1;
    letter-spacing: -1px;
    margin-bottom: 16px;
  }
  .hcc-subline {
    font-size: clamp(14px, 1.6vw, 17px);
    color: rgba(255,255,255,0.72);
    line-height: 1.7;
    max-width: 500px;
    margin-bottom: 36px;
  }

  .hcc-cta-row {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 36px;
  }
  .hcc-btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--blue);
    color: #fff;
    border: none;
    border-radius: 50px;
    padding: 14px 28px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: transform 0.18s, box-shadow 0.18s;
    box-shadow: 0 4px 20px rgba(37,99,235,0.45);
  }
  .hcc-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(37,99,235,0.55);
  }
  .hcc-btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.10);
    color: #fff;
    border: 1.5px solid rgba(255,255,255,0.3);
    border-radius: 50px;
    padding: 13px 28px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.18s, border-color 0.18s;
    backdrop-filter: blur(8px);
  }
  .hcc-btn-secondary:hover {
    background: rgba(255,255,255,0.18);
    border-color: rgba(255,255,255,0.5);
  }

  .hcc-trust-row {
    display: flex;
    gap: 22px;
    flex-wrap: wrap;
  }
  .hcc-trust-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: rgba(255,255,255,0.7);
    font-weight: 500;
  }
  .hcc-trust-item svg {
    color: var(--blue-lt);
    flex-shrink: 0;
  }

  /* ── Booking Card ── */
  .hcc-book-card {
    background: rgba(255,255,255,0.97);
    border-radius: 24px;
    padding: 25px 25px;
    box-shadow: 0 24px 64px rgba(13,34,64,0.28), 0 4px 16px rgba(13,34,64,0.12);
    border: 1px solid rgba(255,255,255,0.8);
  }
  .hcc-book-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--navy);
    margin-bottom: 4px;
  }
  .hcc-book-sub {
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 24px;
  }
  .hcc-form-group {
    margin-bottom: 14px;
  }
  .hcc-form-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    display: block;
    margin-bottom: 6px;
  }
  .hcc-form-input, .hcc-form-select {
    width: 100%;
    padding: 11px 16px;
    border: 1.5px solid var(--tint);
    border-radius: 12px;
    font-size: 14px;
    color: var(--navy);
    background: var(--bg);
    font-family: inherit;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
    appearance: none;
  }
  .hcc-form-input:focus, .hcc-form-select:focus {
    border-color: var(--blue);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
    background: #fff;
  }
  .hcc-form-input::placeholder {
    color: rgba(30,58,95,0.38);
  }
  .hcc-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .hcc-select-wrap {
    position: relative;
  }
  .hcc-select-wrap::after {
    content: '';
    position: absolute;
    right: 14px; top: 50%;
    transform: translateY(-50%) rotate(45deg);
    width: 6px; height: 6px;
    border-right: 2px solid var(--muted);
    border-bottom: 2px solid var(--muted);
    pointer-events: none;
  }
  .hcc-book-submit {
    width: 100%;
    padding: 14px;
    background: var(--blue);
    color: #fff;
    border: none;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 18px;
    transition: background 0.18s, box-shadow 0.18s;
    box-shadow: 0 4px 16px rgba(37,99,235,0.35);
  }
  .hcc-book-submit:hover {
    background: #1d4ed8;
    box-shadow: 0 8px 24px rgba(37,99,235,0.45);
  }
  .hcc-book-note {
    font-size: 11px;
    color: var(--muted);
    text-align: center;
    margin-top: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }

  /* ── Page body ── */
  .hcc-body {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 clamp(20px,5vw,80px);
  }

  /* ── Section ── */
  .hcc-section {
    padding: 72px 0 0;
  }
  .hcc-section-eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--blue);
    display: block;
    margin-bottom: 10px;
  }
  .hcc-section-title {
    font-size: clamp(22px, 3vw, 32px);
    font-weight: 800;
    color: var(--navy);
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .hcc-section-sub {
    font-size: 15px;
    color: var(--muted);
    line-height: 1.65;
    max-width: 520px;
    margin-bottom: 36px;
  }

  /* ── SPECIALTY GRID — 5 columns, compact cards ── */
  .hcc-specialty-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
  }
  .hcc-specialty-card {
    background: var(--white);
    border: 1.5px solid var(--line);
    border-radius: 14px;
    padding: 16px 14px 14px;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hcc-specialty-card:hover {
    border-color: rgba(37,99,235,0.4);
    box-shadow: 0 6px 20px rgba(37,99,235,0.1);
    transform: translateY(-2px);
  }
  .hcc-specialty-icon {
    font-size: 22px;
    display: block;
    line-height: 1;
  }
  .hcc-specialty-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--navy);
    line-height: 1.3;
  }
  .hcc-specialty-desc {
    font-size: 11.5px;
    color: var(--muted);
    line-height: 1.5;
  }
  .hcc-specialty-arrow {
    margin-top: auto;
    color: var(--blue);
    opacity: 0.5;
  }

  /* ── CONDITION GRID — 5 columns, compact cards ── */
  .hcc-condition-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
  }
  .hcc-condition-card {
    background: var(--white);
    border: 1.5px solid var(--line);
    border-radius: 14px;
    padding: 14px 14px 12px;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .hcc-condition-card:hover {
    border-color: rgba(37,99,235,0.35);
    box-shadow: 0 6px 18px rgba(37,99,235,0.09);
  }
  .hcc-condition-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--navy);
    line-height: 1.3;
  }
  .hcc-condition-desc {
    font-size: 11.5px;
    color: var(--muted);
    line-height: 1.5;
  }
  .hcc-condition-expand {
    margin-top: 6px;
    font-size: 11px;
    color: var(--blue);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .hcc-tag {
    font-size: 11px;
    font-weight: 500;
    border-radius: 50px;
    padding: 2px 8px;
    display: inline-block;
  }
  .hcc-tag-blue {
    background: rgba(37,99,235,0.09);
    color: var(--blue);
  }
  .hcc-tag-muted {
    background: var(--tint);
    color: var(--navy);
  }

  /* Treatment cards */
  .hcc-treatment-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%,230px), 1fr));
    gap: 16px;
  }
  .hcc-treatment-card {
    background: var(--white);
    border: 1.5px solid var(--line);
    border-radius: 20px;
    padding: 24px;
    transition: box-shadow 0.2s;
  }
  .hcc-treatment-card:hover {
    box-shadow: 0 6px 24px rgba(37,99,235,0.08);
  }
  .hcc-treatment-icon {
    width: 42px; height: 42px;
    border-radius: 12px;
    background: rgba(37,99,235,0.09);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--blue);
    font-size: 18px;
    margin-bottom: 16px;
  }
  .hcc-treatment-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--navy);
    margin-bottom: 8px;
  }
  .hcc-treatment-desc {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.6;
  }

  /* ─────────────────────────────────────────────
     FAQ — Two-column layout matching screenshot
  ───────────────────────────────────────────── */
  .hcc-faq-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 48px;
    align-items: flex-start;
  }

  /* Left sidebar */
  .hcc-faq-sidebar {
    position: sticky;
    top: 24px;
  }
  .hcc-faq-sidebar-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--blue);
    display: block;
    margin-bottom: 10px;
  }
  .hcc-faq-sidebar-title {
    font-size: 28px;
    font-weight: 800;
    color: var(--navy);
    line-height: 1.15;
    margin-bottom: 12px;
  }
  .hcc-faq-sidebar-desc {
    font-size: 13.5px;
    color: var(--muted);
    line-height: 1.65;
    margin-bottom: 22px;
  }
  .hcc-faq-chat-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--white);
    border: 1.5px solid var(--line);
    border-radius: 50px;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 600;
    color: var(--navy);
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.18s, box-shadow 0.18s;
    margin-bottom: 20px;
    width: 100%;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(30,58,95,0.07);
  }
  .hcc-faq-chat-btn:hover {
    border-color: var(--blue);
    box-shadow: 0 4px 14px rgba(37,99,235,0.14);
  }
  .hcc-faq-chat-btn .chat-icon {
    width: 20px; height: 20px;
    border-radius: 50%;
    background: var(--blue);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 10px;
    flex-shrink: 0;
  }

  .hcc-faq-trust-badges {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hcc-faq-trust-badge {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 12px;
    color: var(--muted);
    padding: 8px 12px;
    background: var(--white);
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .hcc-faq-trust-badge .badge-icon {
    font-size: 15px;
  }
  .hcc-faq-trust-badge strong {
    color: var(--navy);
    font-weight: 700;
  }
  .hcc-faq-trust-badge .badge-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
  }

  /* Right: grouped accordion */
  .hcc-faq-groups {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .hcc-faq-group {
    background: var(--white);
    border: 1.5px solid var(--line);
    border-radius: 16px;
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .hcc-faq-group-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
  }
  .hcc-faq-group-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--blue);
    flex-shrink: 0;
  }
  .hcc-faq-group-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--navy);
  }

  .hcc-faq-item {
    border-bottom: 1px solid var(--line);
    transition: background 0.15s;
  }
  .hcc-faq-item:last-child {
    border-bottom: none;
  }
  .hcc-faq-item.open {
    background: rgba(37,99,235,0.025);
  }
  .hcc-faq-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    gap: 16px;
    font-family: inherit;
  }
  .hcc-faq-question {
    font-size: 14px;
    font-weight: 600;
    color: var(--navy);
    line-height: 1.4;
  }
  .hcc-faq-toggle {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--bg);
    border: 1.5px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--blue);
    transition: background 0.18s, border-color 0.18s;
  }
  .hcc-faq-item.open .hcc-faq-toggle {
    background: rgba(37,99,235,0.09);
    border-color: rgba(37,99,235,0.3);
  }
  .hcc-faq-answer {
    font-size: 13.5px;
    color: var(--muted);
    line-height: 1.75;
    padding: 0 20px 16px;
  }

  /* Still have questions sticky bar */
  .hcc-faq-still {
    margin-top: 12px;
    background: var(--navy);
    border-radius: 14px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .hcc-faq-still-text {
    font-size: 13.5px;
    color: rgba(255,255,255,0.82);
    line-height: 1.5;
  }
  .hcc-faq-still-text strong {
    color: #fff;
    font-weight: 700;
    display: block;
    font-size: 14px;
  }
  .hcc-faq-call-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: #fff;
    color: var(--navy);
    border: none;
    border-radius: 50px;
    padding: 9px 18px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: box-shadow 0.18s;
    box-shadow: 0 2px 10px rgba(0,0,0,0.12);
    flex-shrink: 0;
  }
  .hcc-faq-call-btn:hover {
    box-shadow: 0 4px 18px rgba(0,0,0,0.2);
  }

  /* CTA Banner */
  .hcc-cta-banner {
    margin: 72px 0 80px;
    background: linear-gradient(120deg, var(--navy) 0%, #0d2240 100%);
    border-radius: 28px;
    padding: clamp(40px,5vw,72px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 40px;
    flex-wrap: wrap;
    position: relative;
    overflow: hidden;
  }
  .hcc-cta-banner::before {
    content: '';
    position: absolute;
    right: -80px; top: -80px;
    width: 360px; height: 360px;
    border-radius: 50%;
    border: 1px solid rgba(96,165,250,0.12);
    pointer-events: none;
  }
  .hcc-cta-banner::after {
    content: '';
    position: absolute;
    left: 40%; bottom: -120px;
    width: 280px; height: 280px;
    border-radius: 50%;
    background: rgba(37,99,235,0.08);
    pointer-events: none;
  }
  .hcc-cta-text .eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--blue-lt);
    margin-bottom: 10px;
    display: block;
  }
  .hcc-cta-text h2 {
    font-size: clamp(22px, 3vw, 36px);
    font-weight: 800;
    color: #fff;
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .hcc-cta-text p {
    font-size: 15px;
    color: rgba(255,255,255,0.7);
    line-height: 1.65;
    max-width: 400px;
  }
  .hcc-cta-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }

  /* Mobile sticky CTA */
  .hcc-mobile-cta {
    display: none;
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 100;
    background: var(--white);
    border-top: 1px solid var(--line);
    padding: 14px 20px;
    gap: 10px;
    box-shadow: 0 -4px 24px rgba(30,58,95,0.1);
  }

  @media (max-width: 1100px) {
    .hcc-specialty-grid,
    .hcc-condition-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  @media (max-width: 960px) {
    .hcc-inner {
      grid-template-columns: 1fr;
      gap: 40px;
      padding: 56px clamp(20px,5vw,48px) 48px;
    }
    .hcc-book-card {
      max-width: 500px;
      margin: 0 auto;
      width: 100%;
    }
    .hcc-mobile-cta { display: flex; }
    .hcc-cta-banner { flex-direction: column; text-align: center; }
    .hcc-cta-banner .hcc-cta-text p { margin: 0 auto; }
    .hcc-cta-actions { justify-content: center; }
    .hcc-specialty-grid,
    .hcc-condition-grid {
      grid-template-columns: repeat(3, 1fr);
    }
    .hcc-faq-layout {
      grid-template-columns: 1fr;
      gap: 28px;
    }
    .hcc-faq-sidebar {
      position: static;
    }
  }
  @media (max-width: 640px) {
    .hcc-specialty-grid,
    .hcc-condition-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`;

// ─── Data ────────────────────────────────────────────────────────────────────

const CATEGORY_DATA = {
  "mental-health": {
    id: "mental-health",
    label: "Mental Health",
    tagline: "Compassionate care, wherever you are",
    headline: "Mental Health",
    headlineAccent: "Compassionate Care",
    subheadline: "Connect with licensed psychologists, psychiatrists, therapists and counselors for personalized, confidential care.",
    icon: "🧠",
    stats: { specialists: 340, conditions: 48, satisfaction: "97%" },
    specialties: [
      { name: "Psychiatry", icon: "🔬", desc: "Medical diagnosis and treatment of mental disorders with medication management." },
      { name: "Clinical Psychology", icon: "💬", desc: "Evidence-based psychological assessment and therapy for mental health conditions." },
      { name: "Counseling Psychology", icon: "🌱", desc: "Talk therapy focusing on emotional, social, and behavioral wellbeing." },
      { name: "Behavioral Therapy", icon: "🧩", desc: "CBT and DBT approaches to modify harmful thought and behavior patterns." },
      { name: "Child Psychology", icon: "🌟", desc: "Specialized mental health care for children and adolescents." },
      { name: "Addiction Psychiatry", icon: "🔄", desc: "Treatment of substance use disorders and co-occurring mental conditions." },
      { name: "Neuropsychology", icon: "⚡", desc: "Assessment of cognitive function, memory, and brain-behavior relationships." },
      { name: "Family Therapy", icon: "👨‍👩‍👧", desc: "Systemic therapy addressing dynamics and communication within families." },
    ],
    conditions: [
      { name: "Anxiety Disorder", desc: "Persistent, excessive worry that interferes with daily activities.", symptoms: ["Restlessness", "Racing thoughts", "Muscle tension"], specialists: ["Clinical Psychology", "Psychiatry"] },
      { name: "Depression", desc: "Persistent low mood, loss of interest, and reduced energy lasting weeks or more.", symptoms: ["Persistent sadness", "Fatigue", "Loss of interest"], specialists: ["Psychiatry", "Counseling Psychology"] },
      { name: "Panic Attacks", desc: "Sudden intense fear episodes with physical symptoms like chest pain or breathlessness.", symptoms: ["Chest tightness", "Shortness of breath", "Dizziness"], specialists: ["Psychiatry", "Behavioral Therapy"] },
      { name: "PTSD", desc: "Trauma-related disorder causing flashbacks, nightmares, and heightened alertness.", symptoms: ["Flashbacks", "Nightmares", "Hypervigilance"], specialists: ["Clinical Psychology", "Psychiatry"] },
      { name: "ADHD", desc: "Neurodevelopmental condition affecting attention, impulse control, and hyperactivity.", symptoms: ["Inattention", "Hyperactivity", "Impulsivity"], specialists: ["Child Psychology", "Psychiatry"] },
      { name: "OCD", desc: "Intrusive thoughts and compulsive behaviors that cause significant distress.", symptoms: ["Obsessive thoughts", "Repetitive behaviors", "Anxiety"], specialists: ["Behavioral Therapy", "Psychiatry"] },
      { name: "Bipolar Disorder", desc: "Extreme mood swings between mania/hypomania and depression.", symptoms: ["Mood swings", "Elevated energy", "Depressive episodes"], specialists: ["Psychiatry", "Clinical Psychology"] },
      { name: "Insomnia", desc: "Difficulty falling or staying asleep, affecting daytime functioning.", symptoms: ["Difficulty sleeping", "Early waking", "Daytime fatigue"], specialists: ["Clinical Psychology", "Psychiatry"] },
      { name: "Burnout", desc: "Chronic workplace or caregiver stress leading to physical and emotional exhaustion.", symptoms: ["Exhaustion", "Detachment", "Reduced performance"], specialists: ["Counseling Psychology", "Psychiatry"] },
      { name: "Stress Management", desc: "Support for managing overwhelming stress from life, work, or relationships.", symptoms: ["Irritability", "Headaches", "Overwhelm"], specialists: ["Counseling Psychology", "Behavioral Therapy"] },
    ],
    treatments: [
      { icon: <FiVideo />, title: "Video Consultation", desc: "Speak with a therapist or psychiatrist from home, in complete privacy." },
      { icon: <FiMapPin />, title: "In-Person Sessions", desc: "Face-to-face consultations at partner clinics near you." },
      { icon: <FiMessageSquare />, title: "Therapy Sessions", desc: "Ongoing CBT, DBT, or talk therapy programs customized to you." },
      { icon: <FiCalendar />, title: "Follow-Up Care", desc: "Structured follow-up plans to track your progress over time." },
      { icon: <FiShield />, title: "Prescription Support", desc: "Psychiatrists who can prescribe and manage your medication safely." },
      { icon: <FiUser />, title: "Specialist Referrals", desc: "Warm handoffs to specialist care when your needs evolve." },
    ],
    // FAQ now grouped by category
    faqGroups: [
      {
        label: "Appointments",
        items: [
          { q: "When should I see a mental health specialist?", a: "If your thoughts, emotions, or behaviors are consistently affecting your work, relationships, or daily functioning for two or more weeks, speaking with a specialist is a good step. Early support leads to better outcomes." },
          { q: "Can I book online consultations for therapy?", a: "Yes. Video consultations are available for therapy, counseling, and psychiatric assessments. Most conditions can be effectively managed remotely, with in-person referrals made when necessary." },
          { q: "How long does a typical therapy session last?", a: "Initial consultations are usually 45–60 minutes. Follow-up therapy sessions typically run 30–50 minutes depending on the modality and your treatment plan." },
        ],
      },
      {
        label: "Virtual Care",
        items: [
          { q: "What can be addressed in a virtual session?", a: "Most therapy, counseling, and psychiatric check-ins can happen virtually — including talk therapy, medication reviews, crisis support, and progress check-ins. Physical examinations are the primary exception." },
          { q: "Is virtual therapy as effective as in-person?", a: "Research consistently shows that video-based therapy is as effective as in-person for anxiety, depression, PTSD, and many other conditions. The key factor is the therapeutic relationship, not the medium." },
        ],
      },
      {
        label: "Privacy & Confidentiality",
        items: [
          { q: "Is my consultation completely confidential?", a: "Absolutely. All consultations on HumanCare Connect are bound by strict medical confidentiality. Your information is never shared without your explicit consent, except in rare legal or safety situations." },
          { q: "What symptoms require immediate attention?", a: "Thoughts of self-harm or suicide, sudden severe mood changes, hearing voices, or experiencing paranoia should be addressed immediately. Please reach out to a crisis helpline or visit your nearest emergency centre." },
        ],
      },
      {
        label: "Your Health & Records",
        items: [
          { q: "How do I access my session notes and records?", a: "After each consultation, a summary is available in your dashboard under 'My Records'. You can download or share them with other providers at any time." },
          { q: "Can my primary care doctor manage my mental health?", a: "For mild-to-moderate conditions, yes — GPs can prescribe and monitor treatment. For complex or specialist conditions, a referral to a psychiatrist or psychologist gives you more targeted care." },
        ],
      },
    ],
  },
  "general-care": {
    id: "general-care",
    label: "General Care",
    tagline: "Your first step to feeling better",
    headline: "Everyday Medical",
    headlineAccent: "Care & Wellness",
    subheadline: "Consult experienced general physicians for common illnesses, health check-ups, and ongoing wellness management.",
    icon: "🩺",
    stats: { specialists: 280, conditions: 60, satisfaction: "96%" },
    specialties: [
      { name: "General Medicine", icon: "🩺", desc: "Diagnosis and treatment of common illnesses, infections, and chronic conditions." },
      { name: "Family Medicine", icon: "👨‍👩‍👧‍👦", desc: "Comprehensive primary care for all family members across all age groups." },
      { name: "Preventive Care", icon: "🛡️", desc: "Health screenings, vaccinations, and lifestyle guidance to prevent illness." },
      { name: "Geriatrics", icon: "🌿", desc: "Specialized care for the unique health needs of older adults." },
      { name: "Sports Medicine", icon: "⚽", desc: "Management of sports injuries, exercise physiology, and athletic health." },
      { name: "Internal Medicine", icon: "🔬", desc: "Non-surgical treatment of complex adult diseases across multiple organs." },
    ],
    conditions: [
      { name: "Common Cold & Flu", desc: "Viral upper respiratory infections with fever, cough, and body aches.", symptoms: ["Runny nose", "Sore throat", "Fever"], specialists: ["General Medicine", "Family Medicine"] },
      { name: "Fever", desc: "Elevated body temperature often indicating an underlying infection.", symptoms: ["High temperature", "Chills", "Sweating"], specialists: ["General Medicine"] },
      { name: "Hypertension", desc: "Persistently high blood pressure that increases heart disease and stroke risk.", symptoms: ["Headaches", "Dizziness", "Blurred vision"], specialists: ["Internal Medicine", "General Medicine"] },
      { name: "Diabetes Management", desc: "Ongoing monitoring and treatment of Type 1 and Type 2 diabetes.", symptoms: ["Frequent urination", "Fatigue", "Blurred vision"], specialists: ["Internal Medicine", "General Medicine"] },
      { name: "UTI", desc: "Bacterial infection of the urinary tract causing pain and discomfort.", symptoms: ["Burning urination", "Frequent urge", "Pelvic pain"], specialists: ["General Medicine"] },
      { name: "Allergies", desc: "Immune reactions to environmental triggers like pollen, food, or dust.", symptoms: ["Sneezing", "Itchy eyes", "Rash"], specialists: ["General Medicine"] },
    ],
    treatments: [
      { icon: <FiVideo />, title: "Video Consultation", desc: "Quick diagnosis and prescriptions for everyday illnesses." },
      { icon: <FiMapPin />, title: "In-Person Visit", desc: "Physical examinations at clinics near you." },
      { icon: <FiActivity />, title: "Health Check-Ups", desc: "Routine wellness screenings and preventive health packages." },
      { icon: <FiCalendar />, title: "Follow-Up Care", desc: "Ongoing management for chronic and recurring conditions." },
      { icon: <FiShield />, title: "Prescription Support", desc: "Digital prescriptions delivered to your pharmacist." },
      { icon: <FiUser />, title: "Specialist Referrals", desc: "Guided referrals when your condition needs focused expertise." },
    ],
    faqGroups: [
      {
        label: "Appointments",
        items: [
          { q: "When should I consult a general physician?", a: "For any illness that lasts more than 2–3 days or significantly affects your daily life — including fever, persistent cough, fatigue, or unusual pain — a consultation is appropriate." },
          { q: "Is an online consultation suitable for children?", a: "Online consultations are effective for assessing common childhood illnesses. For physical examinations or emergencies, an in-person visit is recommended." },
        ],
      },
      {
        label: "Virtual Care",
        items: [
          { q: "What can be diagnosed in a virtual visit?", a: "Colds, flu, UTIs, rashes, mild fever, digestive issues, and chronic condition check-ins can all be assessed effectively online. Doctors can review symptoms, history, and prescribe accordingly." },
        ],
      },
      {
        label: "Costs & Insurance",
        items: [
          { q: "Will I receive a prescription after an online consultation?", a: "Yes. Doctors on HumanCare Connect can issue digital prescriptions for most non-narcotic medications, which can be shared directly with your pharmacy." },
        ],
      },
      {
        label: "Your Health & Records",
        items: [
          { q: "Can a general physician manage chronic conditions?", a: "Yes. General and internal medicine doctors routinely manage hypertension, diabetes, thyroid conditions, and other long-term health issues with monitoring and medication adjustments." },
        ],
      },
    ],
  },
};

const STUB = (id, label, icon, tagline, headline, headlineAccent) => ({
  id, label, icon, tagline, headline, headlineAccent,
  subheadline: `Access specialist doctors, explore conditions, and book consultations — all in one place.`,
  stats: { specialists: Math.floor(Math.random() * 300 + 100), conditions: Math.floor(Math.random() * 50 + 20), satisfaction: "96%" },
  specialties: [], conditions: [], treatments: [], faqGroups: [],
});

const ALL_CATEGORIES = {
  ...CATEGORY_DATA,
  "skin-hair": STUB("skin-hair", "Skin & Hair", "🌸", "Confidence starts with healthy skin", "Skin &", "Hair Care"),
  "womens-health": STUB("womens-health", "Women's Health", "🌺", "Specialized care at every stage of life", "Women's", "Health Care"),
  "mens-health": STUB("mens-health", "Men's Health", "💪", "Performance, vitality, and longevity", "Men's", "Health & Vitality"),
  "children-family": STUB("children-family", "Children & Family", "⭐", "Caring for your little ones", "Children &", "Family Care"),
  "weight-nutrition": STUB("weight-nutrition", "Weight & Nutrition", "🥗", "Science-backed wellness from within", "Weight &", "Nutrition"),
  "chronic-care": STUB("chronic-care", "Chronic Care", "🔬", "Long-term care for lasting health", "Chronic Care &", "Expert Opinion"),
  "eye-ear-bone": STUB("eye-ear-bone", "Eye, Ear & Bone", "👁️", "Precision care for sensory health", "Eye, Ear &", "Bone Health"),
  "sexual-health": STUB("sexual-health", "Sexual Health", "❤️", "Discreet, judgement-free care", "Sexual", "Health Care"),
};

// ─── Booking Form ─────────────────────────────────────────────────────────────

function BookingForm({ categoryLabel }) {
  const [form, setForm] = useState({ name: "", phone: "", date: "", time: "", type: "", specialty: "" });
  const [submitted, setSubmitted] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name || !form.phone || !form.date) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  if (submitted) {
    return (
      <div className="hcc-book-card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div className="hcc-book-title">Appointment Requested!</div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
          We'll confirm your slot via call or SMS within 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="hcc-book-card">
      <div className="hcc-book-title">Book an Appointment</div>
      <p className="hcc-book-sub">Same-day slots often available</p>
      <div className="hcc-form-group">
        <label className="hcc-form-label">Full Name</label>
        <input className="hcc-form-input" placeholder="Your full name" value={form.name} onChange={e => set("name", e.target.value)} />
      </div>
      <div className="hcc-form-group">
        <label className="hcc-form-label">Phone Number</label>
        <input className="hcc-form-input" placeholder="+91 98765 43210" value={form.phone} onChange={e => set("phone", e.target.value)} />
      </div>
      <div className="hcc-form-row">
        <div className="hcc-form-group">
          <label className="hcc-form-label">Date</label>
          <input className="hcc-form-input" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
        </div>
        <div className="hcc-form-group">
          <label className="hcc-form-label">Time</label>
          <div className="hcc-select-wrap">
            <select className="hcc-form-select" value={form.time} onChange={e => set("time", e.target.value)}>
              <option value="">Select</option>
              <option>Morning (9–12)</option>
              <option>Afternoon (12–4)</option>
              <option>Evening (4–8)</option>
            </select>
          </div>
        </div>
      </div>
      <div className="hcc-form-group">
        <label className="hcc-form-label">Consultation Type</label>
        <div className="hcc-select-wrap">
          <select className="hcc-form-select" value={form.type} onChange={e => set("type", e.target.value)}>
            <option value="">Select type</option>
            <option>Video Consultation</option>
            <option>In-Person Visit</option>
          </select>
        </div>
      </div>
      <div className="hcc-form-group">
        <label className="hcc-form-label">Specialty (optional)</label>
        <input className="hcc-form-input" placeholder={`e.g. Specialist in ${categoryLabel}`} value={form.specialty} onChange={e => set("specialty", e.target.value)} />
      </div>
      <button className="hcc-book-submit" onClick={handleSubmit}>
        <FiCalendar /> Confirm Appointment
      </button>
      <p className="hcc-book-note">
        <FiShield size={11} /> Free cancellation up to 2 hours before
      </p>
    </div>
  );
}

// ─── Compact Specialty Card ───────────────────────────────────────────────────

function SpecialtyCard({ sp, index }) {
  return (
    <motion.div
      className="hcc-specialty-card"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
    >
      <span className="hcc-specialty-icon">{sp.icon}</span>
      <div className="hcc-specialty-name">{sp.name}</div>
      <p className="hcc-specialty-desc">{sp.desc}</p>
      <div className="hcc-specialty-arrow">
        <FiArrowRight size={13} />
      </div>
    </motion.div>
  );
}

// ─── Compact Condition Card ───────────────────────────────────────────────────

function ConditionCard({ cond, index }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      className="hcc-condition-card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="hcc-condition-name">{cond.name}</div>
      <p className="hcc-condition-desc">{cond.desc}</p>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
                Symptoms
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                {cond.symptoms.map((s, i) => <span key={i} className="hcc-tag hcc-tag-blue">{s}</span>)}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
                Specialists
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {cond.specialists.map((s, i) => <span key={i} className="hcc-tag hcc-tag-muted">{s}</span>)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="hcc-condition-expand">
        {open ? "Show less" : "Symptoms & specialists"} <FiArrowRight size={11} />
      </div>
    </motion.div>
  );
}

// ─── FAQ Section ─────────────────────────────────────────────────────────────

function FaqSection({ faqGroups, catLabel }) {
  // Track open item as "groupIndex-itemIndex"
  const [openItem, setOpenItem] = useState(null);

  const toggle = (key) => setOpenItem(prev => prev === key ? null : key);

  return (
    <section className="hcc-section">
      <div className="hcc-faq-layout">
        {/* ── Left sidebar ── */}
        <div className="hcc-faq-sidebar">
          <span className="hcc-faq-sidebar-eyebrow">FAQ</span>
          <h2 className="hcc-faq-sidebar-title">Frequently Asked Questions</h2>
          <p className="hcc-faq-sidebar-desc">
            Everything you need to know about {catLabel} care at HumanCare Connect. Can't find an answer?
          </p>

          <button className="hcc-faq-chat-btn">
            <span className="chat-icon"><FiMessageSquare size={10} /></span>
            Chat with our team
          </button>

          <div className="hcc-faq-trust-badges">
            <div className="hcc-faq-trust-badge">
              <span className="badge-icon">⚡</span>
              <div>
                <strong>Avg. response in 2 min</strong>
                <div>Live chat available</div>
              </div>
            </div>
            <div className="hcc-faq-trust-badge">
              <span className="badge-icon">🏥</span>
              <div>
                <strong>HIPAA secure &amp; private</strong>
                <div>Your data is protected</div>
              </div>
            </div>
            <div className="hcc-faq-trust-badge">
              <span className="badge-dot" />
              <div>
                <strong>Available on all devices</strong>
                <div>Web, iOS &amp; Android</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right accordion groups ── */}
        <div>
          <div className="hcc-faq-groups">
            {faqGroups.map((group, gi) => (
              <div key={gi} className="hcc-faq-group">
                <div className="hcc-faq-group-header">
                  <span className="hcc-faq-group-dot" />
                  <span className="hcc-faq-group-label">{group.label}</span>
                </div>
                {group.items.map((faq, fi) => {
                  const key = `${gi}-${fi}`;
                  const isOpen = openItem === key;
                  return (
                    <div key={fi} className={`hcc-faq-item${isOpen ? " open" : ""}`}>
                      <button className="hcc-faq-btn" onClick={() => toggle(key)}>
                        <span className="hcc-faq-question">{faq.q}</span>
                        <span className="hcc-faq-toggle">
                          {isOpen ? <FiMinus size={12} /> : <FiPlus size={12} />}
                        </span>
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            style={{ overflow: "hidden" }}
                          >
                            <div className="hcc-faq-answer">{faq.a}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Still have questions bar */}
          <div className="hcc-faq-still">
            <div className="hcc-faq-still-text">
              <strong>Still have questions?</strong>
              Our care team is available every day, 8 AM – 10 PM.
            </div>
            <button className="hcc-faq-call-btn">
              <FiPhone size={13} /> Book a Call
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChronicCareExpertOpinion({ categoryId = "mental-health" }) {
  const [activeCategory, setActiveCategory] = useState(categoryId);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const cat = ALL_CATEGORIES[activeCategory] || CATEGORY_DATA["mental-health"];

  return (
    <div style={{ fontFamily: "'Satoshi', 'DM Sans', -apple-system, sans-serif", background: "var(--bg)", color: "var(--navy)", minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Hero ── */}
      <section className="hcc-hero">
        <div className="hcc-hero-overlay" />
        <div className="hcc-hero-deco-1" />
        <div className="hcc-hero-deco-2" />
        <FiHeart className="hcc-hero-icon" style={{ top: 48, right: 420, fontSize: 48 }} />
        <FiShield className="hcc-hero-icon" style={{ bottom: 60, right: 500, fontSize: 36 }} />
        <FiActivity className="hcc-hero-icon" style={{ top: 140, right: 340, fontSize: 30 }} />
        <FiCheckCircle className="hcc-hero-icon" style={{ bottom: 120, right: 420, fontSize: 28 }} />

        <div className="hcc-inner">
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <div className="hcc-badge">
              <span className="hcc-badge-dot" />
              + Trusted {cat.label}
            </div>
            <h1 className="hcc-headline">
              {cat.headline}
              <br />
              <span style={{ color: "var(--blue-lt)" }}>{cat.headlineAccent}</span>
            </h1>
            <p className="hcc-subline">{cat.subheadline}</p>
            <div className="hcc-cta-row">
              <button className="hcc-btn-primary">
                <FiCalendar /> Book Appointment
              </button>
              <button className="hcc-btn-secondary">
                <FiUser size={15} /> Know More
              </button>
            </div>
            <div className="hcc-trust-row">
              <div className="hcc-trust-item"><FiCheckCircle size={14} /> Same Day Visits</div>
              <div className="hcc-trust-item"><FiShield size={14} /> Insurance Accepted</div>
              <div className="hcc-trust-item"><FiVideo size={14} /> Virtual Care</div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.15 }}>
            <BookingForm categoryLabel={cat.label} />
          </motion.div>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="hcc-body">

        {/* ── Specialties — 5-col compact grid ── */}
        {cat.specialties.length > 0 && (
          <section className="hcc-section">
            <span className="hcc-section-eyebrow">Expertise</span>
            <h2 className="hcc-section-title">Specialties Covered</h2>
            <p className="hcc-section-sub">All {cat.label} specialties available on HumanCare Connect.</p>
            <div className="hcc-specialty-grid">
              {cat.specialties.map((sp, i) => (
                <SpecialtyCard key={i} sp={sp} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Conditions — 5-col compact grid ── */}
        {cat.conditions.length > 0 && (
          <section className="hcc-section">
            <span className="hcc-section-eyebrow">Conditions</span>
            <h2 className="hcc-section-title">Conditions &amp; Symptoms We Treat</h2>
            <p className="hcc-section-sub">Click on any condition to see symptoms and the right specialists for you.</p>
            <div className="hcc-condition-grid">
              <AnimatePresence>
                {cat.conditions.map((cond, i) => (
                  <ConditionCard key={cond.name} cond={cond} index={i} />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* ── Treatments ── */}
        {cat.treatments.length > 0 && (
          <section className="hcc-section">
            <span className="hcc-section-eyebrow">Care Options</span>
            <h2 className="hcc-section-title">Treatment &amp; Care Pathways</h2>
            <p className="hcc-section-sub">Multiple ways to access quality care, on your terms.</p>
            <div className="hcc-treatment-grid">
              {cat.treatments.map((t, i) => (
                <motion.div
                  key={i}
                  className="hcc-treatment-card"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                >
                  <div className="hcc-treatment-icon">{t.icon}</div>
                  <div className="hcc-treatment-title">{t.title}</div>
                  <p className="hcc-treatment-desc">{t.desc}</p>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── FAQ — Two-column layout ── */}
        {cat.faqGroups && cat.faqGroups.length > 0 && (
          <FaqSection faqGroups={cat.faqGroups} catLabel={cat.label} />
        )}

        {/* ── CTA Banner ── */}
        <div className="hcc-cta-banner">
          <div className="hcc-cta-text">
            <span className="eyebrow">{cat.label}</span>
            <h2>Get Expert Care Today</h2>
            <p>Connect with experienced {cat.label} specialists — same-day appointments often available.</p>
          </div>
          <div className="hcc-cta-actions">
            <button className="hcc-btn-primary" style={{ background: "#fff", color: "var(--blue)", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
              Find Doctors <FiArrowRight />
            </button>
            <button className="hcc-btn-secondary" style={{ borderColor: "rgba(255,255,255,0.35)" }}>
              <FiPhone size={14} /> Call Us Now
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile sticky CTA ── */}
      <div className="hcc-mobile-cta">
        <button
          className="hcc-btn-primary"
          style={{ flex: 1, justifyContent: "center", borderRadius: 12 }}
        >
          Book Appointment
        </button>
      </div>

      {/* ── All Categories Drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(13,34,64,0.5)", zIndex: 200, backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              style={{
                position: "fixed", right: 0, top: 0, bottom: 0,
                width: "min(420px, 95vw)",
                background: "var(--white)", zIndex: 201,
                overflowY: "auto", padding: 32,
                boxShadow: "-8px 0 40px rgba(13,34,64,0.2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--navy)" }}>All Categories</h3>
                <button
                  onClick={() => setDrawerOpen(false)}
                  style={{ background: "var(--tint)", border: "none", borderRadius: 50, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <FiX style={{ color: "var(--navy)" }} />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.values(ALL_CATEGORIES).map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveCategory(c.id);
                      setDrawerOpen(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      background: c.id === activeCategory ? "rgba(37,99,235,0.07)" : "var(--bg)",
                      border: `1.5px solid ${c.id === activeCategory ? "var(--blue)" : "var(--line)"}`,
                      borderRadius: 14, padding: "14px 18px",
                      cursor: "pointer", textAlign: "left",
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 24, lineHeight: 1 }}>{c.icon}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--navy)" }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{c.tagline}</div>
                    </div>
                    {c.id === activeCategory && <FiCheckCircle style={{ marginLeft: "auto", color: "var(--blue)" }} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
} 