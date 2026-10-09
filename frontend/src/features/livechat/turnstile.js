// Cloudflare Turnstile loader for the contact form.
//
// Site key: VITE_TURNSTILE_SITE_KEY. In development, when it is not set, Cloudflare's published test site key
// (always passes) is used. In a production build a missing key means no verification is possible, and the form
// says chat is unavailable instead of silently skipping the check.
const TEST_SITE_KEY = "1x00000000000000000000AA";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const turnstileSiteKey = () => import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? TEST_SITE_KEY : "");

let loading = null;

export function loadTurnstile() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
      script.onerror = () => {
        loading = null; // allow a retry
        reject(new Error("turnstile failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

// Renders the widget into `element`. Returns the widget id (or null if it could not be rendered).
export async function renderTurnstile(element, { onToken, onExpire, onError }) {
  const key = turnstileSiteKey();
  if (!key || !element) return null;
  const turnstile = await loadTurnstile();
  return turnstile.render(element, {
    sitekey: key,
    theme: "light",
    size: "flexible",
    callback: onToken,
    "expired-callback": onExpire,
    "error-callback": onError,
  });
}

export const resetTurnstile = (id) => {
  if (id !== null && id !== undefined) window.turnstile?.reset(id);
};

export const removeTurnstile = (id) => {
  if (id !== null && id !== undefined) window.turnstile?.remove(id);
};
