import { useLocation } from "react-router-dom";
import { usePrices, usePricingMeta } from "../context/PricingContext";
import { useSiteCurrency } from "../context/CurrencyContext";
import { resolveCategoryPrice } from "../utils/currencyDisplay";
import { URL_CATEGORY_MAP } from "./useCategoryPrice";

/**
 * The price of a category in the visitor's currency: { amount, currency, loading, unavailable }.
 *
 * Reads the shared pricing table (PricingProvider, already refreshed every 30s) and the server-decided currency
 * (CurrencyProvider), so a page makes no request of its own. `loading` is true until both are known (show a skeleton);
 * `unavailable` is true when there is no price at all (show "Price unavailable" - there is no made-up fallback price).
 * `categoryId` is the pricing slug (e.g. "general"); without it the current URL decides, as in useCategoryPrice.
 */
export function useCategoryPriceInfo(categoryId) {
  const { pathname } = useLocation();
  const prices = usePrices();
  const { loading: pricesLoading, error } = usePricingMeta();
  const { currency, loading: currencyLoading } = useSiteCurrency();

  const slug = categoryId ?? URL_CATEGORY_MAP[pathname];
  const loading = currencyLoading || (prices === null && pricesLoading && !error);
  if (loading) return { amount: null, currency, loading: true, unavailable: false };

  const info = slug && prices ? resolveCategoryPrice(prices[slug], currency) : null;
  if (!info) return { amount: null, currency, loading: false, unavailable: true };
  return { ...info, loading: false, unavailable: false };
}
