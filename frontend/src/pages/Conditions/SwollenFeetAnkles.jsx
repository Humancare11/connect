import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCategoryPrice } from "../../hooks/useCategoryPrice";
import SEO from "../../components/Seo";
import {
  Calendar,
  Star,
  Shield,
  ShieldCheck,
  Clock,
  Video,
  Pill,
  Heart,
  Activity,
  ChevronDown,
  ChevronRight,
  Phone,
  CheckCircle,
  AlertTriangle,
  Stethoscope,
  Brain,
  Zap,
  Users,
  Award,
  ArrowRight,
  MapPin,
  FileText,
  FlaskConical,
  Scan,
  Microscope,
  Thermometer,
  Wind,
  HeartPulse,
  Syringe,
  Eye,
  Bone,
  CircleDot,
  Smile,
  TrendingUp,
  MessageCircle,
  X,
} from "lucide-react";
import ConditionBannerImage from "../../assets/ConditionImages/EyeEarAndMusculoskeletal/Swollen-Feet-or-Ankles.webp";

// ─────────────────────────────────────────────────────────────────
// EMBEDDED STYLES  (scoped with "sp-" prefix so nothing clashes)
// ─────────────────────────────────────────────────────────────────
const STYLES = `
    /* ── keyframes ── */
    @keyframes sp-floatGlow {
        0%,100% { transform: translateY(0) scale(1); }
        50%      { transform: translateY(-24px) scale(1.06); }
    }
    @keyframes sp-floatIcon {
        0%,100% { transform: translateY(0) rotate(0deg); }
        50%      { transform: translateY(-14px) rotate(4deg); }
    }
    @keyframes sp-fadeUp {
        from { opacity:0; transform:translateY(24px); }
        to   { opacity:1; transform:translateY(0); }
    }
    @keyframes sp-cardIn {
        from { opacity:0; transform:translateY(14px) scale(.97); }
        to   { opacity:1; transform:translateY(0) scale(1); }
    }
    @keyframes sp-sbcFadeUp {
        from { opacity:0; transform:translateY(18px); }
        to   { opacity:1; transform:translateY(0); }
    }
    @keyframes sp-sbcPulse {
        0%,100% { transform:scale(1); opacity:1; }
        50%     { transform:scale(1.4); opacity:.7; }
    }

    /* ══ HERO ══ */
    .sp-hero {
        position:relative; display:flex; align-items:center; overflow:hidden;
        padding-top:100px; padding-bottom:56px; min-height:520px;
    }
    .sp-glow { position:absolute; border-radius:50%; filter:blur(60px); pointer-events:none; }
    .sp-glow--tr {
        top:6%; right:6%;
        width:clamp(160px,22vw,300px); height:clamp(160px,22vw,300px);
        background:radial-gradient(circle,rgba(11,87,232,.38) 0%,transparent 70%);
        animation:sp-floatGlow 8s ease-in-out infinite;
    }
    .sp-glow--bl {
        bottom:-4%; left:4%;
        width:clamp(130px,18vw,240px); height:clamp(130px,18vw,240px);
        background:radial-gradient(circle,rgba(124,183,255,.22) 0%,transparent 70%);
        animation:sp-floatGlow 11s ease-in-out infinite;
    }
    .sp-fi { position:absolute; pointer-events:none; opacity:0; }
    .sp-fi--1 { top:20%; right:17%; animation:sp-floatIcon 5s ease-in-out infinite; }
    .sp-fi--2 { bottom:24%; right:9%; animation:sp-floatIcon 7s ease-in-out infinite; }
    .sp-fi--3 { top:52%; right:32%; animation:sp-floatIcon 6s ease-in-out infinite; }
    .sp-hero-wrap { position:relative;z-index:5;width:100%;max-width:1280px;margin:0 auto;padding:0 clamp(16px,4vw,48px); }
    .sp-hero-inner { max-width:680px;display:flex;flex-direction:column;align-items:flex-start; }
    .sp-badge-hero {
        display:inline-flex;align-items:center;gap:8px;padding:7px 16px;border-radius:999px;
        background:rgba(255,255,255,.09);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
        border:1px solid rgba(255,255,255,.18);color:#7CB7FF;font-size:11px;font-weight:700;
        letter-spacing:.06em;text-transform:uppercase;margin-bottom:18px;white-space:nowrap;
    }
    .sp-h1 {
        font-size:clamp(26px,3.4vw,44px);line-height:1.09;font-weight:900;color:#fff;
        letter-spacing:-1.4px;text-shadow:0 2px 28px rgba(11,87,232,.28);margin:0 0 14px;
    }
    .sp-desc-hero { font-size:clamp(13.5px,1.35vw,15px);line-height:1.65;color:#D0E4FF;max-width:540px;margin:0 0 24px; }
    .sp-btns { display:flex;flex-wrap:wrap;gap:12px;margin-bottom:22px; }
    .sp-btn {
        display:inline-flex;align-items:center;gap:8px;border-radius:12px;font-size:13.5px;
        font-weight:700;cursor:pointer;transition:transform .2s,box-shadow .2s,background .2s,border-color .2s;
        white-space:nowrap;padding:12px 24px;
    }
    .sp-btn--primary {
        background:linear-gradient(135deg,#0B57E8 0%,#1E6BFF 55%,#4D8DFF 100%);
        color:#fff;border:none;box-shadow:0 10px 28px rgba(11,87,232,.42);
    }
    .sp-btn--primary:hover { transform:translateY(-2px);box-shadow:0 20px 40px rgba(11,87,232,.60); }
    .sp-btn--ghost {
        background:rgba(255,255,255,.09);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
        color:#fff;border:1px solid rgba(255,255,255,.18);
    }
    .sp-btn--ghost:hover { background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.30); }
    .sp-trust { display:flex;flex-wrap:wrap;gap:8px 20px; }
    .sp-trust-item { display:flex;align-items:center;gap:6px;color:#D0E4FF;font-size:12.5px;font-weight:500; }
    .sp-trust-check { color:#7CB7FF;flex-shrink:0; }

    /* ══ ABOUT GLASS CARD ══ */
    .sp-glass-card {
        position:relative;border-radius:28px;overflow:hidden;height:100%;box-sizing:border-box;
        display:flex;flex-direction:column;
        background:rgba(255,255,255,.62);backdrop-filter:blur(28px) saturate(160%);-webkit-backdrop-filter:blur(28px) saturate(160%);
        border:1px solid rgba(255,255,255,.85);
        box-shadow:0 2px 0px rgba(255,255,255,.9) inset,0 18px 50px -20px rgba(11,40,100,.18),0 30px 80px -30px rgba(11,40,100,.30);
        padding:clamp(28px,4vw,48px);
    }
    .sp-glass-shine {
        position:absolute;inset:0;
        background:linear-gradient(135deg,rgba(255,255,255,.45) 0%,rgba(255,255,255,.10) 40%,rgba(200,223,255,.08) 70%,rgba(11,87,232,.04) 100%);
        pointer-events:none;z-index:0;
    }
    .sp-about-grid {
        position:relative;z-index:1;display:grid;grid-template-columns:220px 1fr;
        gap:clamp(28px,4vw,56px);align-items:stretch;flex:1;
    }
    .sp-about-left { display:flex;flex-direction:column;gap:0;justify-content:space-between; }
    .sp-about-h2 { font-size:clamp(20px,2.2vw,26px);font-weight:800;color:#0A1F44;line-height:1.2;font-family:'Georgia',serif;margin:0 0 18px; }
    .sp-nav-card {
        background:rgba(11,87,232,.10);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);
        border-radius:16px;padding:20px 18px;margin-bottom:14px;border:1px solid rgba(11,87,232,.22);
        box-shadow:0 2px 0 rgba(255,255,255,.55) inset,0 8px 24px -8px rgba(11,87,232,.18);
    }
    .sp-nav-label { color:#0B57E8;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 12px; }
    .sp-nav-list { display:flex;flex-direction:column;gap:10px; }
    .sp-nav-item { display:flex;align-items:center;gap:8px;cursor:pointer;padding:5px 7px;border-radius:8px;transition:background .18s; }
    .sp-nav-item:hover { background:rgba(11,87,232,.12); }
    .sp-nav-chevron { color:#0B57E8;flex-shrink:0; }
    .sp-nav-text { color:#1e3457;font-size:13px;font-weight:600; }
    .sp-stat-row { display:flex;flex-direction:column;gap:8px; }
    .sp-stat-pill {
        display:inline-flex;align-items:center;gap:7px;background:rgba(11,87,232,.07);
        border:1px solid rgba(11,87,232,.15);border-radius:10px;padding:7px 12px;font-size:12px;font-weight:600;color:#0B57E8;
    }
    .sp-about-right { display:flex;flex-direction:column;gap:28px;justify-content:space-between; }
    .sp-block-title {
        font-size:16px;font-weight:700;color:#0A1F44;margin:0 0 10px;display:flex;align-items:center;gap:8px;
    }
    .sp-block-title::before {
        content:'';display:inline-block;width:3px;height:16px;
        background:linear-gradient(180deg,#0B57E8,#7CB7FF);border-radius:2px;flex-shrink:0;
    }
    .sp-block-body { color:#5C7099;line-height:1.8;font-size:14.5px;margin:0; }
    .sp-benefits-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr));gap:10px;margin-top:4px; }
    .sp-benefit-item {
        display:flex;align-items:center;gap:8px;font-size:13px;color:#2A3F66;font-weight:500;
        background:rgba(11,87,232,.04);border:1px solid rgba(11,87,232,.08);border-radius:8px;padding:8px 10px;
        transition:background .18s,border-color .18s;
    }
    .sp-benefit-item:hover { background:rgba(11,87,232,.09);border-color:rgba(11,87,232,.18); }
    .sp-benefit-check { color:#0B57E8;flex-shrink:0; }

    /* ══ STICKY BOOKING CARD ══ */
    .sp-sbc {
        position:sticky;top:120px;
        background:rgba(255,255,255,.62);backdrop-filter:blur(28px) saturate(160%);-webkit-backdrop-filter:blur(28px) saturate(160%);
        border:1px solid rgba(255,255,255,.85);
        box-shadow:0 2px 0px rgba(255,255,255,.9) inset,0 18px 50px -20px rgba(11,40,100,.18),0 30px 80px -30px rgba(11,40,100,.30);
        border-radius:22px;padding:clamp(20px,3.5vw,28px);
        display:flex;flex-direction:column;align-items:center;text-align:center;
        animation:sp-sbcFadeUp .65s cubic-bezier(.22,.68,0,1.2) both;
        max-width:360px;width:100%;margin:0 auto;
    }
    .sp-sbc-badge {
        display:inline-flex;align-items:center;gap:7px;background:#EEF4FF;color:#0B57E8;
        border:1px solid #C5DEFF;border-radius:999px;padding:5px 13px;font-size:12px;font-weight:700;
        margin-bottom:18px;letter-spacing:.02em;animation:sp-sbcFadeUp .6s .05s cubic-bezier(.22,.68,0,1.2) both;
    }
    .sp-sbc-dot {
        width:7px;height:7px;border-radius:50%;background:#0B57E8;
        box-shadow:0 0 12px rgba(11,87,232,.5);animation:sp-sbcPulse 2s ease-in-out infinite;flex-shrink:0;
    }
    .sp-sbc-price { font-size:clamp(32px,7vw,42px);font-weight:900;color:#0A1F44;line-height:1;letter-spacing:-1.5px;font-family:'Georgia',serif; }
    .sp-sbc-price-sub { font-size:12.5px;color:#7A90B8;margin:8px 0 0;line-height:1.5; }
    .sp-sbc-info {
        display:flex;align-items:flex-start;gap:10px;background:#EEF6FF;border:1px solid #C5DEFF;
        border-radius:12px;padding:13px 14px;margin-bottom:20px;text-align:left;
        animation:sp-sbcFadeUp .6s .16s cubic-bezier(.22,.68,0,1.2) both;
    }
    .sp-sbc-info-icon { color:#0B57E8;flex-shrink:0;margin-top:1px; }
    .sp-sbc-info-text { font-size:12.5px;color:#2255AA;line-height:1.6;margin:0; }
    .sp-sbc-features { width:100%;display:flex;flex-direction:column;gap:0;margin-bottom:22px; }
    .sp-sbc-row {
        display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #F0F5FD;
        animation:sp-sbcFadeUp .55s cubic-bezier(.22,.68,0,1.2) both;transition:background .18s;
    }
    .sp-sbc-row:last-child { border-bottom:none; }
    .sp-sbc-row:hover { background:#F8FAFF;border-radius:8px;padding-left:6px; }
    .sp-sbc-check { color:#1E6BFF;display:block; }
    .sp-sbc-feat-text { font-size:13px;color:#2A3F66;font-weight:500;text-align:left; }
    .sp-sbc-cta {
        width:100%;background:#1e3457;color:#fff;border:none;border-radius:50px;padding:16px 24px;
        font-size:clamp(14px,2.5vw,15px);font-weight:700;cursor:pointer;margin-bottom:12px;
        transition:transform .2s,box-shadow .2s,background .2s;letter-spacing:.02em;
        animation:sp-sbcFadeUp .6s .55s cubic-bezier(.22,.68,0,1.2) both;
        box-shadow:0 20px 50px rgba(34,58,94,.12),0 0 0 4px rgba(34,58,94,.05);
    }
    .sp-sbc-cta:hover { transform:translateY(-2px);background:#264070;box-shadow:0 28px 60px rgba(34,58,94,.22),0 0 0 4px rgba(34,58,94,.08); }
    .sp-sbc-terms { font-size:11.5px;color:#9AAAC5;text-align:center;line-height:1.6;margin:0; }
    .sp-sbc-link { color:#0B57E8;text-decoration:underline;text-underline-offset:2px; }
    .sp-sbc-link:hover { color:#0A2FA0; }

    /* ══ SYMPTOMS ══ */
    .sp-sym-section { background:#fff; padding:80px 0 100px; }
    .sp-sym-wrap { max-width:1240px; margin:0 auto; padding:0 24px; }
    .sp-sym-header { margin-bottom:40px; }
    .sp-sym-h2 { font-size:clamp(24px,3vw,32px); font-weight:800; color:#0A1F44; font-family:'Georgia',serif; margin:6px 0 8px; line-height:1.15; }
    .sp-sym-sub { color:#5C7099; font-size:15px; margin:0; }

    .sp-sym-grid {
        display:flex; flex-wrap:wrap; gap:10px; align-items:flex-start;
    }

    /* Wrapper reserves the collapsed footprint in the flow */
    .sp-sym-card-wrap {
        position:relative; flex-shrink:0;
        width:158px; height:52px;
        animation:sp-cardIn .5s both ease;
        z-index:1;
    }
    .sp-sym-card-wrap.sp-wrap-active { z-index:30; }

    /* Card floats absolutely — won't push siblings when it expands */
    .sp-sym-card {
        position:absolute; top:0;
        width:158px; min-width:158px;
        border-radius:16px; border:1px solid #C8DFFF; background:#F0F5FF;
        padding:14px 16px; cursor:pointer; box-sizing:border-box; overflow:hidden;
        transition:
        width .38s cubic-bezier(.34,1.15,.64,1),
        background .25s ease, border-color .25s ease,
        box-shadow .25s ease, transform .25s ease;
    }
    .sp-sym-card.sp-expand-right { left:0; right:auto; }
    .sp-sym-card.sp-expand-left  { right:0; left:auto; }

    .sp-sym-card.sp-card-active {
        width:300px;
        background:linear-gradient(135deg,#0B57E8 0%,#1E6BFF 100%);
        border-color:#0B57E8;
        box-shadow:0 16px 40px -8px rgba(11,87,232,.40),0 4px 12px -4px rgba(11,87,232,.24);
        transform:translateY(-3px);
    }

    .sp-sym-top { display:flex; align-items:center; gap:10px; white-space:nowrap; }
    .sp-sym-title { font-size:13.5px; font-weight:650; color:#1e3457; transition:color .22s; flex:1; overflow:hidden; text-overflow:ellipsis; }
    .sp-sym-arrow { font-size:12px; color:#0B57E8; opacity:1; transition:opacity .20s,transform .26s; flex-shrink:0; }
    .sp-sym-card.sp-card-active .sp-sym-title { color:#fff; }
    .sp-sym-card.sp-card-active .sp-sym-arrow { opacity:0; transform:translateX(4px); }

    .sp-sym-body { max-height:0; opacity:0; overflow:hidden; transition:max-height .36s cubic-bezier(.34,1.10,.64,1),opacity .26s ease .06s; }
    .sp-sym-card.sp-card-active .sp-sym-body { max-height:160px; opacity:1; }
    .sp-sym-desc { margin:10px 0 10px; font-size:12.5px; line-height:1.65; color:rgba(255,255,255,.92); white-space:normal; }
    .sp-sym-cta {
        display:inline-block; font-size:12px; font-weight:700; color:rgba(255,255,255,.80);
        letter-spacing:.03em; border-bottom:1px solid rgba(255,255,255,.35); padding-bottom:1px;
        transition:color .18s,border-color .18s;
    }
    .sp-sym-cta:hover { color:#fff; border-color:rgba(255,255,255,.7); }

    /* ══ FAQ ══ */
    .sp-faq-layout { display:grid;grid-template-columns:320px minmax(0,1fr);gap:48px;align-items:start; }
    .sp-faq-sidebar { position:sticky;top:110px; }
    .sp-faq-title { font-size:52px;line-height:1.05;font-weight:800;color:#0a1f44;margin:14px 0;font-family:Georgia,serif; }
    .sp-faq-desc { color:#5c7099;line-height:1.8;margin-bottom:28px; }
    .sp-faq-chat {
        height:52px;border-radius:14px;padding:0 24px;border:1px solid #0b57e8;background:white;
        color:#0b57e8;display:flex;align-items:center;gap:10px;font-weight:700;cursor:pointer;transition:all .3s;
    }
    .sp-faq-chat:hover { background:#eef4ff; }
    .sp-faq-stat { margin-top:14px;background:white;border:1px solid #e4edff;border-radius:14px;padding:14px 18px;color:#2a3f66;font-size:14px;box-shadow:0 4px 15px rgba(0,0,0,.04); }
    .sp-faq-content { display:flex;flex-direction:column;gap:22px; }
    .sp-faq-card { background:white;border-radius:22px;border:1px solid #dce7ff;overflow:hidden;box-shadow:0 8px 25px rgba(11,87,232,.05); }
    .sp-faq-cat { height:64px;display:flex;align-items:center;gap:12px;padding:0 24px;font-size:12px;font-weight:800;color:#0b57e8;letter-spacing:.12em;text-transform:uppercase; }
    .sp-faq-dot { width:8px;height:8px;border-radius:50%;background:#0b57e8; }
    .sp-faq-item { border-top:1px solid #eef4ff; }
    .sp-faq-q { width:100%;background:transparent;border:none;cursor:pointer;padding:22px 24px;display:flex;justify-content:space-between;align-items:center;text-align:left; }
    .sp-faq-q span { font-size:18px;font-weight:600;color:#0a1f44; }
    .sp-faq-icon { width:38px;height:38px;border-radius:50%;background:#eef4ff;color:#0b57e8;display:flex;align-items:center;justify-content:center;transition:.35s; }
    .sp-faq-icon.sp-active { transform:rotate(45deg);background:#0b57e8;color:white; }
    .sp-faq-ans { max-height:0;overflow:hidden;transition:max-height .45s cubic-bezier(.4,0,.2,1),padding .45s ease; }
    .sp-faq-ans.sp-open { max-height:300px; }
    .sp-faq-ans p { padding:0 24px 24px;color:#5c7099;line-height:1.8; }
    .sp-faq-bottom-cta { background:#2E4A7A;border-radius:22px;padding:30px;display:flex;justify-content:space-between;align-items:center; }
    .sp-faq-bottom-cta h3 { color:white;margin-bottom:6px; }
    .sp-faq-bottom-cta p { color:#c8dfff; }
    .sp-faq-bottom-cta button { background:white;border:none;border-radius:14px;height:54px;padding:0 24px;display:flex;align-items:center;gap:10px;font-weight:700;color:#0a1f44;cursor:pointer; }

    /* ══ PAGE LAYOUT ══ */
    .sp-page-layout {
        max-width:1240px;margin:0 auto;padding:0 24px;
        display:grid;grid-template-columns:1fr 320px;gap:48px;align-items:stretch;
    }
    .sp-page-layout > main { display:flex;flex-direction:column; }
    .sp-page-layout > main > * { flex:1;display:flex;flex-direction:column; }

    /* ══ RESPONSIVE ══ */
    @media (min-width:1280px) {
        .sp-hero { min-height:500px; }
        .sp-fi { opacity:.13; }
        .sp-fi--3 { opacity:.09; }
    }
    @media (min-width:1024px) and (max-width:1279px) {
        .sp-hero { min-height:480px; }
        .sp-fi { opacity:.11; }
        .sp-fi--3 { opacity:.07; }
    }
    @media (min-width:768px) and (max-width:1023px) {
        .sp-hero { min-height:auto;padding-top:100px;padding-bottom:52px; }
        .sp-fi { display:none; }
        .sp-glow--tr { width:180px;height:180px;opacity:.7; }
        .sp-glow--bl { width:150px;height:150px;opacity:.6; }
        .sp-h1 { font-size:clamp(24px,4vw,34px);letter-spacing:-.8px; }
        .sp-desc-hero { font-size:14px;max-width:520px; }
        .sp-badge-hero { font-size:10px;padding:6px 14px; }
        .sp-sym-card-wrap { width:140px; }
        .sp-sym-card { width:140px; }
        .sp-sym-card:hover { width:260px; }
    }
    @media (max-width:767px) {
        .sp-hero { padding-top:80px;padding-bottom:44px;background-position:70% center; }
        .sp-fi { display:none; }
        .sp-glow--tr { width:120px;height:120px;top:4%;right:2%;opacity:.5; }
        .sp-glow--bl { width:100px;height:100px;opacity:.4; }
        .sp-h1 { font-size:clamp(22px,6vw,30px);letter-spacing:-.6px;margin-bottom:12px; }
        .sp-desc-hero { font-size:13.5px;margin-bottom:20px; }
        .sp-badge-hero { font-size:10px;padding:6px 12px;margin-bottom:16px; }
        .sp-btn { padding:11px 20px;font-size:13px; }
        .sp-btns { flex-direction:column;width:100%;gap:10px; }
        .sp-btn { width:100%;justify-content:center; }
        .sp-trust { gap:8px 14px; }
        .sp-trust-item { font-size:12px; }
        .sp-sym-section { padding:52px 0 72px; }
        .sp-sym-grid { gap:8px; }
        .sp-sym-card-wrap { width:calc(50% - 4px);height:48px; }
        .sp-sym-card { width:100%;border-radius:12px; }
        .sp-sym-card:hover { width:100%; }
        .sp-sym-h2 { font-size:22px; }
        .sp-page-layout { grid-template-columns:1fr;align-items:start; }
        .sp-page-layout > main, .sp-page-layout > main > * { flex:unset;display:block; }
        .sp-faq-layout { grid-template-columns:1fr; }
        .sp-faq-sidebar { position:static; }
        .sp-faq-title { font-size:38px; }
        .sp-faq-bottom-cta { flex-direction:column;align-items:flex-start;gap:18px; }
    }
    @media (max-width:860px) {
        .sp-about-grid { grid-template-columns:1fr; }
        .sp-stat-row { flex-direction:row; }
        .sp-glass-card { border-radius:20px; }
    }
    @media (max-width:1024px) {
        .sp-sbc { position:relative;top:auto;max-width:100%; }
        .sp-page-layout { grid-template-columns:1fr;align-items:start; }
        .sp-page-layout > main, .sp-page-layout > main > * { flex:unset;display:block; }
    }
    @media (max-width:479px) {
        .sp-hero { padding-top:72px;padding-bottom:36px; }
        .sp-h1 { font-size:clamp(20px,7vw,26px); }
        .sp-desc-hero { font-size:13px; }
        .sp-badge-hero { font-size:9.5px;padding:5px 10px; }
        .sp-trust-item { font-size:11.5px; }
        .sp-glass-card { padding:22px 18px;border-radius:16px; }
        .sp-sbc { border-radius:18px;padding:20px 18px; }
        .sp-sym-card-wrap { width:calc(50% - 4px); }
        .sp-sym-card { width:100%; }
        .sp-sym-card:hover { width:100%; }
        .sp-sym-title { font-size:12px; }
        .sp-faq-title { font-size:30px; }
    }
    `;

// ─────────────────────────────────────────────────────────────────
// DATA  (swap this out per sub-page)
// ─────────────────────────────────────────────────────────────────
const pageData = {
  badge: "Eye, Ear & Bone Care",
  heading: "Swollen Feet or Ankles",
  description: "Swelling and fluid buildup in feet",
  trustItems: ["Same Day Visits", "No Insurance Required", "Virtual Care"],
  bgImage: ConditionBannerImage,
};

const relatedSpecialties = [
  { icon: Brain, name: "Mental Health", color: "#F4F0FF", accent: "#7C3AED" },
  { icon: Zap, name: "Urgent Care", color: "#FFF0EE", accent: "#DC2626" },
  { icon: Heart, name: "Women's Health", color: "#FFF0F3", accent: "#DB2777" },
  { icon: Smile, name: "Pediatrics", color: "#EDFCF2", accent: "#059669" },
  { icon: Brain, name: "Mental Health", color: "#F4F0FF", accent: "#7C3AED" },
  { icon: Zap, name: "Urgent Care", color: "#FFF0EE", accent: "#DC2626" },
  { icon: Heart, name: "Women's Health", color: "#FFF0F3", accent: "#DB2777" },
  { icon: Smile, name: "Pediatrics", color: "#EDFCF2", accent: "#059669" },
];

const symptomData = [
  {
    title: "Fever",
    desc: "Elevated body temperature often signals infection. See a doctor if it exceeds 103°F or lasts more than 3 days.",
  },
  {
    title: "Headache",
    desc: "Can range from tension headaches to migraines. Sudden, severe headaches need immediate evaluation.",
  },
  {
    title: "Fatigue",
    desc: "Persistent tiredness may indicate anaemia, thyroid issues, or other conditions. Don't dismiss chronic fatigue.",
  },
  {
    title: "Nausea",
    desc: "Often tied to GI issues, medications, or infections. Prolonged nausea warrants a medical review.",
  },
  {
    title: "Dizziness",
    desc: "Vertigo or lightheadedness can stem from inner ear, blood pressure, or neurological causes.",
  },
  {
    title: "Cough",
    desc: "A cough lasting more than 3 weeks, or producing blood or thick mucus, should be evaluated promptly.",
  },
  {
    title: "Anxiety",
    desc: "Persistent worry, racing thoughts, or panic attacks benefit from professional mental health support.",
  },
  {
    title: "Back Pain",
    desc: "Acute or chronic back pain can affect posture and mobility. Early treatment prevents long-term damage.",
  },
  {
    title: "Shortness of Breath",
    desc: "Difficulty breathing can signal respiratory or cardiac conditions. Seek urgent care if sudden or severe.",
  },
  {
    title: "Sore Throat",
    desc: "Often viral, but strep throat requires antibiotics. Difficulty swallowing needs prompt attention.",
  },
  {
    title: "Chest Pain",
    desc: "Always take chest pain seriously. It may indicate cardiac, muscular, or gastrointestinal causes.",
  },
  {
    title: "Joint Pain",
    desc: "Swollen or stiff joints may indicate arthritis or injury. Early diagnosis preserves joint function.",
  },
  {
    title: "Loss of Appetite",
    desc: "Unexplained appetite loss can be linked to digestive, mental, or systemic health conditions.",
  },
  {
    title: "Insomnia",
    desc: "Chronic sleep difficulty affects mood, cognition, and immunity. CBT and medical review can help.",
  },
  {
    title: "Skin Rash",
    desc: "Rashes can signal allergies, infections, or autoimmune conditions. Sudden rashes need evaluation.",
  },
];

const whyUs = [
  {
    icon: Award,
    title: "Board Certified Doctors",
    desc: "Every physician is credentialed and continuously trained.",
  },
  {
    icon: Clock,
    title: "Fast Scheduling",
    desc: "Book an appointment in under 60 seconds.",
  },
  {
    icon: Video,
    title: "Online Consultations",
    desc: "See a doctor from anywhere, anytime.",
  },
  {
    icon: Shield,
    title: "Insurance Support",
    desc: "Dedicated team to help navigate your coverage.",
  },
  {
    icon: FileText,
    title: "Personalised Plans",
    desc: "Care designed around your unique health profile.",
  },
  {
    icon: Pill,
    title: "Digital Prescriptions",
    desc: "Sent directly to your pharmacy — no paper needed.",
  },
];

const faqData = [
  {
    category: "Appointments",
    items: [
      {
        q: "How do I book a primary care appointment?",
        a: 'You can book online in under 60 seconds — just click "Book Appointment" at the top of the page, choose a date and time that works for you, and confirm. Same-day slots are often available.',
      },
      {
        q: "Can I see a doctor the same day?",
        a: "Yes. We reserve same-day slots every morning for acute concerns. If you log in before 10 AM, you'll typically find availability for that day.",
      },
      {
        q: "What should I bring to my first visit?",
        a: "Bring a valid photo ID, your insurance card, a list of any current medications, and any recent lab results or specialist notes if you have them.",
      },
    ],
  },
  {
    category: "Virtual Care",
    items: [
      {
        q: "How does an online consultation work?",
        a: "After booking, you'll receive a secure video link by email and SMS. At your appointment time, click the link — no app download required.",
      },
      {
        q: "What conditions can be treated virtually?",
        a: "Most common illnesses and follow-ups are well-suited to video care — colds, infections, skin concerns, mental health check-ins, and prescription renewals.",
      },
    ],
  },
  {
    category: "Costs & Insurance",
    items: [
      {
        q: "Do you accept my insurance?",
        a: "We work with most major insurance plans including Aetna, Cigna, UnitedHealth, BlueCross BlueShield, Humana, and Medicare.",
      },
      {
        q: "What is the consultation fee if I'm uninsured?",
        a: "Our self-pay consultation fee is $49 for a standard visit — this covers the appointment, any prescriptions written, a doctor's note if needed, and 24-hour follow-up support.",
      },
      {
        q: "Are referrals and lab orders included in the fee?",
        a: "Yes. Specialist referrals and lab test orders issued during your visit are included at no extra charge.",
      },
    ],
  },
  {
    category: "Your Health & Records",
    items: [
      {
        q: "How do I access my medical records?",
        a: "All visit notes, lab results, and prescription history are available in your secure patient portal within 24 hours of your appointment.",
      },
      {
        q: "Can my primary care doctor manage chronic conditions?",
        a: "Absolutely. Chronic disease management is one of our core services. Your physician will create a personalised care plan and coordinate with any specialists you see.",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────
function SectionLabel({ children, variant = "light" }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: variant === "dark" ? "#7CB7FF" : "#0B57E8",
        background: variant === "dark" ? "rgba(124,183,255,.12)" : "#EEF4FF",
        border:
          variant === "dark"
            ? "1px solid rgba(124,183,255,.22)"
            : "1px solid transparent",
        padding: "4px 12px",
        borderRadius: 20,
        marginBottom: 12,
      }}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────
function HeroSection({ data }) {
  return (
    <section
      className="sp-hero"
      style={{
        backgroundImage: `
            linear-gradient(105deg,
                rgba(6,19,51,.97) 0%,
                rgba(10,31,68,.90) 30%,
                rgba(10,31,68,.72) 62%,
                rgba(10,31,68,.48) 100%
            ),
            url(${data.bgImage})
            `,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="sp-glow sp-glow--tr" />
      <div className="sp-glow sp-glow--bl" />

      <div className="sp-fi sp-fi--1">
        <HeartPulse size={44} color="#ffffff" />
      </div>
      <div className="sp-fi sp-fi--2">
        <ShieldCheck size={52} color="#ffffff" />
      </div>
      <div className="sp-fi sp-fi--3">
        <Stethoscope size={40} color="#ffffff" />
      </div>

      <div className="sp-hero-wrap">
        <div className="sp-hero-inner">
          <span
            className="sp-badge-hero"
            style={{
              animation: "sp-fadeUp .75s .00s cubic-bezier(.22,.68,0,1.2) both",
            }}
          >
            ✦ Trusted {data.badge}
          </span>

          <h1
            className="sp-h1"
            style={{
              animation: "sp-fadeUp .85s .10s cubic-bezier(.22,.68,0,1.2) both",
            }}
          >
            {data.heading}
          </h1>

          <p
            className="sp-desc-hero"
            style={{
              animation: "sp-fadeUp .85s .18s cubic-bezier(.22,.68,0,1.2) both",
            }}
          >
            {data.description}
          </p>

          <div
            className="sp-btns"
            style={{
              animation: "sp-fadeUp .85s .26s cubic-bezier(.22,.68,0,1.2) both",
            }}
          >
            <a href="/appointment-booking" className="sp-btn sp-btn--primary">
              <Calendar size={15} /> Book Appointment
            </a>
            <a href="#" className="sp-btn sp-btn--ghost">
              <Users size={15} /> Know More
            </a>
          </div>

          <div
            className="sp-trust"
            style={{
              animation: "sp-fadeUp .85s .34s cubic-bezier(.22,.68,0,1.2) both",
            }}
          >
            {data.trustItems.map((item) => (
              <div key={item} className="sp-trust-item">
                <CheckCircle size={13} className="sp-trust-check" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// ABOUT SPECIALTY
// ─────────────────────────────────────────────────────────────────
function AboutSpecialty() {
  return (
    <div className="sp-glass-card">
      <div className="sp-glass-shine" />
      <div className="sp-about-grid">
        {/* LEFT */}
        <div className="sp-about-left">
          <SectionLabel>About This Specialty</SectionLabel>
          <h2 className="sp-about-h2">
            Your Health,
            <br />
            Our Priority
          </h2>

          <div className="sp-nav-card">
            <p className="sp-nav-label">Quick Access</p>
            <div className="sp-nav-list">
              {[
                "Routine Wellness",
                "Acute Illness",
                "Chronic Conditions",
                "Mental Wellbeing",
              ].map((item) => (
                <div key={item} className="sp-nav-item">
                  <ChevronRight size={13} className="sp-nav-chevron" />
                  <span className="sp-nav-text">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sp-stat-row">
            <div className="sp-stat-pill">
              <HeartPulse size={13} />
              <span>15 K+ Patients</span>
            </div>
            <div className="sp-stat-pill">
              <ShieldCheck size={13} />
              <span>98% Satisfaction</span>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="sp-about-right">
          <div>
            <h3 className="sp-block-title">What Is Swollen Feet or Ankles?</h3>
            <p className="sp-block-body">
              Swollen feet or ankles can cause puffiness, discomfort, tightness,
              pain, stiffness, and difficulty walking that may be linked to
              fluid retention, injury, circulation issues, pregnancy, or
              underlying health conditions.
            </p>
          </div>

          <div>
            <h3 className="sp-block-title">How?</h3>
            <p className="sp-block-body">
              Get convenient care for swollen feet or ankles with Humancare
              Connect. Our telemedicine services make it easy to schedule an
              online doctor appointment and connect with a licensed provider
              from home. Through our secure telemedicine platform, you can
              receive symptom evaluation, treatment guidance, circulation
              support, and personalized care recommendations without the need
              for an in-person clinic visit.
            </p>
          </div>

          <div>
            <h3 className="sp-block-title">
              Get swelling relief in 4 simple steps.
            </h3>
            <div className="sp-benefits-grid">
              {[
                "Choose Swollen Feet or Ankles care",
                "Share your symptoms and health concerns",
                "Connect with an online provider",
                "Receive treatment guidance and personalized care recommendations",
              ].map((b) => (
                <div key={b} className="sp-benefit-item">
                  <CheckCircle size={14} className="sp-benefit-check" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STICKY BOOKING CARD
// ─────────────────────────────────────────────────────────────────
function StickyBookingCard() {
  const navigate = useNavigate();
  const price = useCategoryPrice();
  return (
    <div className="sp-sbc">
      <div className="sp-sbc-badge">
        <span className="sp-sbc-dot" />
        Doctors Available Now
      </div>

      <div
        style={{
          marginBottom: 16,
          animation: "sp-sbcFadeUp .6s .10s cubic-bezier(.22,.68,0,1.2) both",
        }}
      >
        <div className="sp-sbc-price">${price ?? 49}</div>
        <p className="sp-sbc-price-sub">
          One-time consultation fee · No subscription required
        </p>
      </div>

      <div className="sp-sbc-info">
        <Shield size={15} className="sp-sbc-info-icon" />
        <p className="sp-sbc-info-text">
          No extra fee for doctor notes, prescriptions, or specialist referrals.{" "}
          <strong style={{ color: "#0A1F44", fontWeight: 700 }}>
            Everything is included.
          </strong>
        </p>
      </div>

      <div className="sp-sbc-features">
        {[
          "Board-certified physician",
          "Rx to your pharmacy",
          "Doctor's note included",
          "24hr follow-up support",
          "HIPAA secure session",
        ].map((item, i) => (
          <div
            key={item}
            className="sp-sbc-row"
            style={{ animationDelay: `${0.35 + i * 0.07}s` }}
          >
            <CheckCircle size={15} className="sp-sbc-check" />
            <span className="sp-sbc-feat-text">{item}</span>
          </div>
        ))}
      </div>

      <button
        className="sp-sbc-cta"
        onClick={() =>
          navigate(
            "/category-consultant?category=eeb&condition=Swollen%20Feet%20or%20Ankles",
          )
        }
      >
        Start Consultation →
      </button>
      <p className="sp-sbc-terms">
        By continuing, you agree to our{" "}
        <a href="#" className="sp-sbc-link">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="sp-sbc-link">
          Privacy Policy
        </a>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SYMPTOMS CHIPS — direction-aware, JS-driven active state
// ─────────────────────────────────────────────────────────────────
function SymptomsChips() {
  const [activeIdx, setActiveIdx] = useState(null);
  const [goLeft, setGoLeft] = useState({}); // { [i]: bool }
  const wrapRefs = {}; // populated by ref callbacks

  const EXPANDED_W = 300;

  const onEnter = (i) => {
    // Measure available space to the right before committing direction
    const node = wrapRefs[i];
    if (node) {
      const rect = node.getBoundingClientRect();
      const spaceRight = window.innerWidth - rect.right;
      setGoLeft((prev) => ({ ...prev, [i]: spaceRight < EXPANDED_W + 16 }));
    }
    setActiveIdx(i);
  };

  const onLeave = () => setActiveIdx(null);

  return (
    <section className="sp-sym-section">
      <div className="sp-sym-wrap">
        <div className="sp-sym-header">
          <SectionLabel>Common Symptoms</SectionLabel>
          <h2 className="sp-sym-h2">Recognise Your Symptoms</h2>
          <p className="sp-sym-sub">
            Hover a symptom card to learn more and find the right care.
          </p>
        </div>

        <div className="sp-sym-grid">
          {symptomData.map((item, i) => {
            const isActive = activeIdx === i;
            const expandDir = goLeft[i] ? "sp-expand-left" : "sp-expand-right";

            return (
              <div
                key={item.title}
                ref={(node) => {
                  wrapRefs[i] = node;
                }}
                className={`sp-sym-card-wrap${isActive ? " sp-wrap-active" : ""}`}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div
                  className={`sp-sym-card ${expandDir}${isActive ? " sp-card-active" : ""}`}
                  onMouseEnter={() => onEnter(i)}
                  onMouseLeave={onLeave}
                >
                  <div className="sp-sym-top">
                    <span className="sp-sym-title">{item.title}</span>
                    <span className="sp-sym-arrow">→</span>
                  </div>
                  <div className="sp-sym-body">
                    <p className="sp-sym-desc">{item.desc}</p>
                    <span className="sp-sym-cta">Find care →</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// RELATED SPECIALTIES
// ─────────────────────────────────────────────────────────────────
function RelatedSpecialties() {
  return (
    <section style={{ background: "#F8FAFE", padding: "64px 0" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ marginBottom: 36 }}>
          <SectionLabel>Related Specialties</SectionLabel>
          <h2
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "#0A1F44",
              fontFamily: "'Georgia',serif",
              marginTop: 8,
            }}
          >
            Explore Other Specialties
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill,minmax(min(100%,280px),1fr))",
            gap: 16,
          }}
        >
          {relatedSpecialties.map((s, idx) => (
            <div
              key={idx}
              style={{
                background: s.color,
                borderRadius: 16,
                padding: "24px 20px",
                cursor: "pointer",
                transition: "all .25s",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow =
                  "0 12px 40px -10px rgba(11,40,100,.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <s.icon size={20} style={{ color: s.accent }} />
              </div>
              <div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#0A1F44",
                    marginBottom: 4,
                  }}
                >
                  {s.name}
                </p>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    color: "#5C7099",
                    fontWeight: 500,
                  }}
                >
                  Learn More <ArrowRight size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// WHY CHOOSE US
// ─────────────────────────────────────────────────────────────────
function WhyChooseUs() {
  return (
    <section style={{ background: "#0A1F44", padding: "80px 0" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <SectionLabel variant="dark">Why HumanCare Connect</SectionLabel>
          <h2
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "#fff",
              fontFamily: "'Georgia',serif",
              marginTop: 8,
            }}
          >
            The Standard of Modern Healthcare
          </h2>
          <p style={{ color: "#7CB7FF", fontSize: 16, marginTop: 12 }}>
            Built for patients who deserve better.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill,minmax(min(100%,300px),1fr))",
            gap: 20,
          }}
        >
          {whyUs.map((w) => (
            <div
              key={w.title}
              style={{
                background: "rgba(255,255,255,.06)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 16,
                padding: "28px 24px",
                transition: "all .25s",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,.12)";
                e.currentTarget.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,.06)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "rgba(11,87,232,.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <w.icon size={20} style={{ color: "#7CB7FF" }} />
              </div>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 8,
                }}
              >
                {w.title}
              </p>
              <p style={{ fontSize: 13, color: "#7CB7FF", lineHeight: 1.65 }}>
                {w.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────────
function FaqSection() {
  const [openId, setOpenId] = useState("0-0");
  const toggle = (id) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <section style={{ background: "#F7FAFF", padding: "90px 0" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px" }}>
        <div className="sp-faq-layout">
          {/* Sidebar */}
          <div className="sp-faq-sidebar">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="sp-faq-title">
              Frequently Asked
              <br />
              Questions
            </h2>
            <p className="sp-faq-desc">
              Everything you need to know about primary care at HumanCare
              Connect. Can't find an answer?
            </p>
            <button className="sp-faq-chat">
              <MessageCircle size={18} /> Chat with our team
            </button>
            <div className="sp-faq-stat">⚡ Avg. response in 2 min</div>
            <div className="sp-faq-stat">🔒 HIPAA secure &amp; private</div>
            <div className="sp-faq-stat">🌍 Available in all 50 states</div>
          </div>

          {/* Content */}
          <div className="sp-faq-content">
            {faqData.map((cat, ci) => (
              <div key={cat.category} className="sp-faq-card">
                <div className="sp-faq-cat">
                  <span className="sp-faq-dot" />
                  {cat.category}
                </div>
                {cat.items.map((item, ii) => {
                  const id = `${ci}-${ii}`;
                  return (
                    <div key={id} className="sp-faq-item">
                      <button className="sp-faq-q" onClick={() => toggle(id)}>
                        <span>{item.q}</span>
                        <div
                          className={`sp-faq-icon ${openId === id ? "sp-active" : ""}`}
                        >
                          +
                        </div>
                      </button>
                      <div
                        className={`sp-faq-ans ${openId === id ? "sp-open" : ""}`}
                      >
                        <p>{item.a}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="sp-faq-bottom-cta">
              <div>
                <h3>Still have questions?</h3>
                <p>Our care team is available every day, 8 AM – 10 PM.</p>
              </div>
              <a href="/appointment-booking">
                <button>
                  Book a Call <ArrowRight size={18} />
                </button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// ROOT EXPORT  — drop-in replacement for any sub-page
// ─────────────────────────────────────────────────────────────────
export default function SwollenFeetAnkles() {
  return (
    <>
      <SEO
        title="Swollen Feet & Ankles Treatment Online | Virtual Doctor Consultation"
        description="Get online care for swollen feet or ankles. Consult a licensed provider for swelling, fluid retention, discomfort, and personalized treatment guidance."
        keywords="swollen feet treatment, swollen ankles treatment, ankle swelling, foot swelling, edema treatment online, fluid retention, online doctor consultation, virtual healthcare services, telehealth swelling care, swollen feet and ankles causes"
        url="https://humancareconnect.co/swollen-feet-ankles"
      />
      <style>{STYLES}</style>

      <div
        style={{
          fontFamily: "Satoshi, sans-serif",
          color: "#0A1F44",
          background: "#fff",
        }}
      >
        <HeroSection data={pageData} />

        <div
          style={{
            background:
              "linear-gradient(180deg,#EEF4FF 0%,#F6F9FF 60%,#ffffff 100%)",
          }}
        >
          <div className="sp-page-layout" style={{ padding: "72px 24px" }}>
            <main>
              <AboutSpecialty />
            </main>
            <aside>
              <StickyBookingCard />
            </aside>
          </div>
        </div>

        <SymptomsChips />
        <RelatedSpecialties />

        <FaqSection />
      </div>
    </>
  );
}
