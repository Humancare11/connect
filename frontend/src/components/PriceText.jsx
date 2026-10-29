import { priceTextState } from "../utils/currencyDisplay";
import "./PriceText.css";

/**
 * A price slot: a skeleton while loading, "Price unavailable" when there is no price, else the formatted price ($30, €30, £30).
 * `info` is what useCategoryPriceInfo / selectionPriceInfo return.
 */
export default function PriceText({ info }) {
  const state = priceTextState(info);
  if (state.kind === "skeleton") {
    // The USD price (when known: prerendered pages) is in the markup but not visible; the visitor sees the skeleton.
    return (
      <span className={`pt-skeleton${state.text ? " pt-skeleton--text" : ""}`} role="status" aria-busy="true" aria-label="Loading price">
        {state.text ? <span className="pt-hidden-text">{state.text}</span> : null}
      </span>
    );
  }
  if (state.kind === "unavailable") return <span className="pt-unavailable">{state.text}</span>;
  return <>{state.text}</>;
}
