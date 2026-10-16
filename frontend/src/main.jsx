import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { installSecureConsole } from "./utils/secureConsole";

// Must run before anything else can call console.error/warn with a raw
// Axios error object (see utils/secureConsole.js for why).
installSecureConsole();
import AppProviders from "./AppProviders";
import { readPrerenderData } from "./seo/prerenderData";
import PrerenderCleanup from "./seo/PrerenderCleanup";
import "./fonts.css";
import "./index.css";
import App from "./App.jsx";

const app = (
  <StrictMode>
    <HelmetProvider>
      <AppProviders>
        <PrerenderCleanup />
        <App />
      </AppProviders>
    </HelmetProvider>
  </StrictMode>
);

const rootElement = document.getElementById("root");

// Pages prerendered at build time (see scripts/prerender.mjs) carry data-prerendered and are
// hydrated; the SPA shell (dashboards, login, booking, payment, video call) and the 404 page are
// rendered from scratch.
//
// Hydrate only on the URL the HTML was rendered for (data-prerendered-path). A host that falls back to
// index.html for unknown paths serves the prerendered home page on every SPA route; hydrating that HTML there
// is a mismatch (React error #418) and leaves the home page's header on top of the real page. In that case the
// stale markup is cleared and the page is rendered from scratch.
const normalizePath = (value) => {
  const path = String(value || "/").replace(/[?#].*$/, "").replace(/\/+$/, "");
  return path || "/";
};
const SHELL_TITLE = "Humancare Connect | Online Doctor Consultation & Telehealth Services";
const prerenderedFor = rootElement.getAttribute("data-prerendered-path");
const hydratable =
  rootElement.hasAttribute("data-prerendered") &&
  prerenderedFor !== null &&
  normalizePath(prerenderedFor) === normalizePath(window.location.pathname);

if (hydratable) {
  readPrerenderData();
  hydrateRoot(rootElement, app);
} else {
  if (rootElement.hasAttribute("data-prerendered")) {
    rootElement.replaceChildren();
    // The prerendered page's own <title>, canonical, robots and social tags describe a different URL.
    document.querySelectorAll("[data-prerendered-head]").forEach((el) => el.remove());
    document.title = SHELL_TITLE; // same text as the fallback <title> in index.html
  }
  createRoot(rootElement).render(app);
}
