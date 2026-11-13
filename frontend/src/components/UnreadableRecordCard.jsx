// Stands in for a prescription / certificate card whose content cannot be read. Uses the same card classes as the real cards.
import { UNREADABLE_RECORD_TEXT } from "../utils/unreadableRecord";

export default function UnreadableRecordCard({ className, icon }) {
  return (
    <div className={className} role="status">
      <div className="mr-card-top">
        <div className="mr-card-icon" aria-hidden="true">{icon}</div>
        <div className="mr-card-meta">
          <h3 className="mr-card-title">{UNREADABLE_RECORD_TEXT}</h3>
        </div>
      </div>
    </div>
  );
}
