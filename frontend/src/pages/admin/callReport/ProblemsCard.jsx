import { formatDate } from "./reportUtils";

// "Problems" section of an admin call report. Extracted verbatim from
// AdminDirectVideoCallDetail.jsx; renders nothing when there are no problems.
export default function ProblemsCard({ problems }) {
  if (!problems || problems.length === 0) return null;
  return (
    <div className="dvc-card dvc-problems">
      <div className="dvc-form__title">
        <h2>Problems</h2>
        <p>
          Things that went wrong during this call. Some causes are self-reported by the device
          right before it disconnects and aren't always caught in time — see each item's
          reliability note.
        </p>
      </div>
      <ul className="dvc-problems__list">
        {problems.map((p, i) => (
          <li key={i}>
            <div className="dvc-problems__head">
              <span className="dvc-problems__label">
                {p.who}: {p.label}
              </span>
              <span className={`dvc-problems__detectable dvc-problems__detectable--${p.detectable}`}>
                {p.detectable === "server"
                  ? "Reliable"
                  : p.detectable === "best-effort"
                    ? "Best-effort"
                    : "Not reliably detectable"}
              </span>
            </div>
            <p className="dvc-problems__suggestion">{p.suggestion}</p>
            <span className="dvc-problems__time">{formatDate(p.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
