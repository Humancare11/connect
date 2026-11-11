// The prices the live chat AI may quote: read from the Super Admin pricing, never typed in twice.
//
// There are two Super Admin price sources and the booking flow charges from whichever one the page uses:
//   - a SERVICE page books through /service-consultant and is charged by resolveServiceFeeCents (ServicePrice, by slug),
//   - a CATEGORY / condition page books through /category-consultant and is charged by resolveCategoryFeeCents
//     (HealthcareCategory.pricingSlug -> CategoryPricing).
// This module calls those SAME two functions, in the currency of the visitor's country (currencyConfig), so the chat quotes what
// checkout would charge: the same USD fallback when a currency has no price yet, and no price at all when the booking flow would
// refuse (a category switched off, a record missing, a price of 0).
//
// CONFIRMED MAPPING (AI service name -> the record its page's booking charges):
//   key                       AI name                      page the AI links to            source    record
//   general-consultation      General consultation         /online-doctor-consultation     service   general-consultations
//   mental-health             Mental health support        /mental-health                  category  mental
//   doctor-notes              Doctor notes & sick notes    /doctors-note                   category  general   (the page books category=general)
//   lab-requisitions          Lab requisitions             /lab-requisitions               service   lab-requisitions
//   chronic-care-management   Chronic care management     /chronic-care-management        service   chronic-care-management
//   prescription-refills      Prescription refills         /online-prescription-refills    service   online-prescription-refills
//   second-opinion            Second medical opinion       /online-second-medical-opinion  service   online-second-medical-opinion
//   fit-to-fly                Fit to fly                   /fit-to-fly-certificate         service   fit-to-fly
// A service with no record (or no price) is simply not in the list: the AI then says the price is shown when booking.
const { normalizeCurrency, SUPPORTED_CURRENCIES } = require("../../utils/currencyConfig");

const AI_SERVICES = [
  { key: "general-consultation", name: "General consultation", page: "/online-doctor-consultation", source: "service", ref: "general-consultations" },
  { key: "mental-health", name: "Mental health support", page: "/mental-health", source: "category", ref: "mental" },
  { key: "doctor-notes", name: "Doctor notes & sick notes", page: "/doctors-note", source: "category", ref: "general" },
  { key: "lab-requisitions", name: "Lab requisitions", page: "/lab-requisitions", source: "service", ref: "lab-requisitions" },
  { key: "chronic-care-management", name: "Chronic care management", page: "/chronic-care-management", source: "service", ref: "chronic-care-management" },
  { key: "prescription-refills", name: "Prescription refills", page: "/online-prescription-refills", source: "service", ref: "online-prescription-refills" },
  { key: "second-opinion", name: "Second medical opinion", page: "/online-second-medical-opinion", source: "service", ref: "online-second-medical-opinion" },
  { key: "fit-to-fly", name: "Fit to fly", page: "/fit-to-fly-certificate", source: "service", ref: "fit-to-fly" },
];

const SYMBOLS = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };
const CACHE_MS = 5 * 60 * 1000;

// "$49", "$49.50", "€30", "₹1,499": whole amounts have no decimals, others two.
function formatAmount(amount, currency) {
  const code = normalizeCurrency(currency);
  const n = Number(amount);
  const text = Number.isInteger(n)
    ? n.toLocaleString("en-US")
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${SYMBOLS[code] || "$"}${text}`;
}

// resolvers: { service(ref, {currency}), category(ref, {currency}) } -> { amountMinor, currency } | null. They default to the
// booking flow's own functions (loaded when first needed, so requiring this file never loads the payment code).
function createLivePrices({ resolvers, now = () => Date.now(), ttlMs = CACHE_MS, log = () => {} } = {}) {
  const real = () => {
    const pv = require("../../utils/paymentVerification");
    return { service: pv.resolveServiceFeeCents, category: pv.resolveCategoryFeeCents };
  };
  let cached = null;
  const cache = new Map(); // currency -> { at, items }
  const loading = new Map(); // currency -> promise (one load at a time)

  async function load(currency, previous = []) {
    const use = resolvers || (cached ||= real());
    const items = [];
    for (const def of AI_SERVICES) {
      try {
        const fee = def.source === "service"
          ? await use.service(def.ref, { currency })
          : await use.category(def.ref, { currency });
        const amount = fee && Number.isFinite(fee.amountMinor) && fee.amountMinor > 0 ? fee.amountMinor / 100 : 0;
        if (amount > 0) {
          const feeCurrency = normalizeCurrency(fee.currency);
          items.push({ ...def, amount, currency: feeCurrency, text: formatAmount(amount, feeCurrency) });
        }
      } catch (err) {
        // A failed read keeps the last good price of that service (if there was one); with none, it is not quoted.
        log({ event: "live_price_failed", key: def.key, reason: String(err?.name || "error").slice(0, 40) });
        const last = previous.find((i) => i.key === def.key);
        if (last) items.push(last);
      }
    }
    return items;
  }

  // The quotable prices for a visitor priced in `currency`: [{ key, name, page, amount, currency, text }].
  // On a failed read the last good list is kept; with none, the list is empty (the AI then sends no amount).
  async function forCurrency(wanted = "USD") {
    const currency = normalizeCurrency(wanted);
    const hit = cache.get(currency);
    if (hit && now() - hit.at < ttlMs) return hit.items;
    if (!loading.has(currency)) {
      const job = load(currency, hit?.items || [])
        .then((items) => {
          cache.set(currency, { at: now(), items });
          return items;
        })
        .catch(() => hit?.items || [])
        .finally(() => loading.delete(currency));
      loading.set(currency, job);
    }
    return loading.get(currency);
  }

  // For the read-only card in the admin: every AI service with its price in each currency (null = no price, the AI quotes nothing).
  async function overview() {
    const byCurrency = {};
    for (const code of SUPPORTED_CURRENCIES) byCurrency[code] = await forCurrency(code);
    return AI_SERVICES.map((def) => ({
      key: def.key,
      name: def.name,
      page: def.page,
      source: def.source,
      ref: def.ref,
      prices: Object.fromEntries(
        SUPPORTED_CURRENCIES.map((code) => {
          const hit = byCurrency[code].find((i) => i.key === def.key);
          return [code, hit ? { text: hit.text, currency: hit.currency } : null];
        }),
      ),
    }));
  }

  // A Super Admin save: the next question reads the new prices.
  function invalidate() {
    cache.clear();
  }

  return { forCurrency, overview, invalidate };
}

// Shared by the app (one instance, so a save in the pricing routes clears the chat's cache).
let shared = null;
const sharedLivePrices = () => (shared ||= createLivePrices());
const invalidateLivePrices = () => {
  if (shared) shared.invalidate();
};

module.exports = { AI_SERVICES, formatAmount, createLivePrices, sharedLivePrices, invalidateLivePrices, CACHE_MS };
