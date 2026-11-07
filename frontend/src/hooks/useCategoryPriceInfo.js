import { useLocation } from "react-router-dom";
import { usePrices, usePricingMeta } from "../context/PricingContext";
import { useSiteCurrency } from "../context/CurrencyContext";
import { resolveCategoryPrice } from "../utils/currencyDisplay";
import { URL_CATEGORY_MAP } from "./useCategoryPrice";
import { usePrerendered } from "../seo/prerenderData";

/**
 * The price of a category in the visitor's currency: { amount, currency, loading, unavailable }.
 *
 * Reads the shared pricing table (PricingProvider, already refreshed every 30s) and the server-decided currency
 * (CurrencyProvider), so a page makes no request of its own. `loading` is true until both are known (show a skeleton);
 * `unavailable` is true when there is no price at all (show "Price unavailable" - there is no made-up fallback price).
 * `usdAmount` is always the category's USD price when it is known (the live table, or while loading the build-time data embedded in
 * a prerendered page): PriceText keeps it in the markup, hidden behind the skeleton, so crawlers and the first hydrated render see
 * the USD price; a booking selection carries it as its USD `cost`.
 * `categoryId` is the pricing slug (e.g. "general"); without it the current URL decides, from URL_CATEGORY_MAP.
 */
export function useCategoryPriceInfo(categoryId) {
  const { pathname } = useLocation();
  const prices = usePrices();
  const { loading: pricesLoading, error } = usePricingMeta();
  const { currency, loading: currencyLoading } = useSiteCurrency();
  const prerenderedPrices = usePrerendered("pricing:usd");

  const slug = categoryId ?? URL_CATEGORY_MAP[pathname];
  const loading = currencyLoading || (prices === null && pricesLoading && !error);
  const usd = Number((slug && (prices?.[slug]?.price ?? prerenderedPrices?.[slug]?.price)) || 0);
  const usdAmount = usd > 0 ? usd : null;
  if (loading) return { amount: null, currency, loading: true, unavailable: false, usdAmount };

  const info = slug && prices ? resolveCategoryPrice(prices[slug], currency) : null;
  if (!info) return { amount: null, currency, loading: false, unavailable: true, usdAmount };
  return { ...info, loading: false, unavailable: false, usdAmount };
}
