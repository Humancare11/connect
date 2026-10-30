import { useEffect, useState } from "react";
import api from "../api";
import { useSiteCurrency } from "../context/CurrencyContext";
import { servicePriceInfo } from "../utils/currencyDisplay";
import { usePrerendered } from "../seo/prerenderData";

// One service's record from GET /api/services/by-slug/:slug ({ price, priceEur?, priceGbp?, priceInr?, ... }). An empty slug loads nothing.
// `record` is null until it is loaded (and when the service cannot be loaded).
export function useServiceRecord(slug) {
  const [state, setState] = useState({ slug: "", record: null, loading: Boolean(slug) });

  useEffect(() => {
    let cancelled = false;
    if (!slug) return undefined;
    api
      .get(`/api/services/by-slug/${encodeURIComponent(slug)}`)
      .then((res) => { if (!cancelled) setState({ slug, record: res.data || null, loading: false }); })
      .catch(() => { if (!cancelled) setState({ slug, record: null, loading: false }); });
    return () => { cancelled = true; };
  }, [slug]);

  // A record that belongs to another slug is not this service's record (the slug just changed): show it as loading.
  if (!slug) return { record: null, loading: false };
  if (state.slug !== slug) return { record: null, loading: true };
  return { record: state.record, loading: state.loading };
}

/**
 * The price of a service in the visitor's currency: { priceInfo, price, priceLoading }.
 * `priceInfo` ({ amount, currency, loading, unavailable }) is for PriceText / BookingCard: a skeleton while the currency or the
 * service is loading, "Price unavailable" when there is no price - no made-up fallback price. `price` is the service's USD price
 * (null until known).
 */
export function useServicePrice(slug) {
  const { currency, loading: currencyLoading } = useSiteCurrency();
  const { record, loading } = useServiceRecord(slug);
  // The USD price embedded in a prerendered page (build time): kept in the markup behind the skeleton for crawlers.
  const prerendered = usePrerendered("services:usd");
  const priceInfo = servicePriceInfo({ record, loading, currency, currencyLoading, usdFallback: slug ? prerendered?.[slug]?.price : null });
  const usd = Number(record?.price);
  return { priceInfo, price: Number.isFinite(usd) && usd > 0 ? usd : null, priceLoading: priceInfo.loading };
}
