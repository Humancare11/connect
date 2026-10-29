import { priceTextState } from "../utils/currencyDisplay";
import "./PriceText.css";

/**
 * A price slot: a skeleton while loading, "Price unavailable" when there is no price, else the formatted price ($30, €30, £30).
 * `info` is what useCategoryPriceInfo / selectionPriceInfo return.
 */
export default function PriceText({ info }) {
  const state = priceTextState(info);
  if (state.kind === "skeleton") {
    return <span className="pt-skeleton" role="status" aria-busy="true" aria-label="Loading price" />;
  }
  if (state.kind === "unavailable") return <span className="pt-unavailable">{state.text}</span>;
  return <>{state.text}</>;
}
