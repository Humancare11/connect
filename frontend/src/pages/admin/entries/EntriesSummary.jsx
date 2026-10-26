import { formatMoney, rowsText } from "./entriesFormat";

// The three boxes at the top. They follow the Doctor and Month filters, not the tab or the search (the server works them out).
export default function EntriesSummary({ summary, busy }) {
  const s = summary || { toPayCents: 0, paidCents: 0, feeNotEnteredCount: 0 };
  return (
    <div className="en-sum" aria-label="Summary" aria-busy={busy || undefined}>
      <div className="en-kpi en-kpi--warn">
        <small>To pay doctors</small>
        <b>{formatMoney(s.toPayCents)}</b>
      </div>
      <div className="en-kpi en-kpi--ok">
        <small>Paid to doctors</small>
        <b>{formatMoney(s.paidCents)}</b>
      </div>
      <div className="en-kpi">
        <small>Fee not entered</small>
        <b>{rowsText(s.feeNotEnteredCount)}</b>
      </div>
    </div>
  );
}
