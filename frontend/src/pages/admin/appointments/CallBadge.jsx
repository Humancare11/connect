import { Link } from "react-router-dom";

// Did a video call happen, how long, did it connect, was anything wrong. Links to the call report. `summary` comes from
// POST /api/call-reports/summaries (undefined: no call recorded). One report URL serves both booking kinds.
export default function CallBadge({ summary, row }) {
  if (!summary) return <span className="adp-bk-call adp-bk-call--none">-</span>;
  const tone = summary.hasProblem ? "problem" : summary.connected ? "ok" : "idle";
  return (
    <Link
      className={`adp-bk-call adp-bk-call--${tone}`}
      to={`/admin-dashboard/appointments/${row.id}/call-report`}
      title={summary.firstProblem || (summary.connected ? "Call connected" : "Joined, but never connected")}
    >
      <span aria-hidden="true">📞</span> {summary.durationLabel || "0s"}
      {summary.inProgress ? " · live" : ""}
      <br />
      {summary.connected ? "Connected" : "Not connected"}
      {summary.hasProblem && <span className="adp-bk-call-warn">⚠ {summary.problemCount}</span>}
    </Link>
  );
}
