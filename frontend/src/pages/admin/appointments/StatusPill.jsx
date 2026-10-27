import { STATUS_META } from "./bookingFormat";

export default function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.upcoming;
  return (
    <span className="adp-status-pill" style={{ background: meta.bg, color: meta.color, borderColor: meta.bg }}>
      {meta.label}
    </span>
  );
}
