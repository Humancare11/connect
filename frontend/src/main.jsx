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
if (rootElement.hasAttribute("data-prerendered")) {
  readPrerenderData();
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}
