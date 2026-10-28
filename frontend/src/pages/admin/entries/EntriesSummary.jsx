import { summaryBoxes } from "./entriesFormat";

// The money boxes at the top, for a super admin only: the server sends `summary` to nobody else, so an admin gets no boxes at all.
// They follow the month, not the tab or the search.
export default function EntriesSummary({ view, summary, busy }) {
  const boxes = summaryBoxes(view, summary);
  if (!boxes.length) return null;
  return (
    <div className="en-sum" aria-label="Summary" aria-busy={busy || undefined} data-testid="summary">
      {boxes.map((box) => (
        <div key={box.key} className={`en-kpi${box.tone ? ` en-kpi--${box.tone}` : ""}`}>
          <small>{box.label}</small>
          <b>{box.text}</b>
        </div>
      ))}
    </div>
  );
}
