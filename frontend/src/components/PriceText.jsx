import { priceTextState } from "../utils/currencyDisplay";

// The prerendered USD price sits in the markup for crawlers. It is visually hidden with INLINE styles (the usual screen-reader-only
// pattern), so it can never show up - not before the stylesheet has loaded, not if it fails to load, not during hydration.
const HIDDEN_TEXT_STYLE = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
  color: "transparent",
  userSelect: "none",
};
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
        {state.text ? <span className="pt-hidden-text" style={HIDDEN_TEXT_STYLE}>{state.text}</span> : null}
      </span>
    );
  }
  if (state.kind === "unavailable") return <span className="pt-unavailable">{state.text}</span>;
  return <>{state.text}</>;
}
