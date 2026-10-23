import Modal from "../../../components/ui/Modal";
import { BULK_ACTIONS, summaryText } from "./selectionLogic";

const OUTCOME_LABEL = { skipped: "Skipped", failed: "Failed" };

// What happened to each booking after a bulk action: the ones that were not done first, with the reason,
// then the ones that were (folded away, since that is the expected case).
export default function BulkResultModal({ result, onClose }) {
  const { action, items, summary, refundNote } = result;
  const notDone = items.filter((i) => i.outcome !== "done");
  const done = items.filter((i) => i.outcome === "done");

  return (
    <Modal open onClose={onClose} title={`${BULK_ACTIONS[action].title}: ${summaryText(summary)}`} className="adp-bk-modal">
      <div className="adp-bk-modal-body" data-testid="bulk-result">
        {notDone.length > 0 && (
          <ul className="adp-bk-results" aria-label="Not done">
            {notDone.map((item) => (
              <li key={item.id} className={`adp-bk-result adp-bk-result--${item.outcome}`}>
                <span className="adp-bk-result-tag">{OUTCOME_LABEL[item.outcome]}</span>
                <span className="adp-bk-result-main">
                  <b>{item.name}</b>
                  <small>{item.reason}</small>
                </span>
              </li>
            ))}
          </ul>
        )}

        {done.length > 0 && (
          <details className="adp-bk-done" open={notDone.length === 0 && done.length <= 8}>
            <summary>
              Done ({done.length})
            </summary>
            <ul className="adp-bk-results" aria-label="Done">
              {done.map((item) => (
                <li key={item.id} className="adp-bk-result adp-bk-result--done">
                  <span className="adp-bk-result-tag">Done</span>
                  <span className="adp-bk-result-main">
                    <b>{item.name}</b>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {refundNote && (
          <p className="adp-bk-modal-warning" role="note">
            {refundNote}
          </p>
        )}

        <div className="hc-modal__actions">
          <button type="button" className="adp-bk-btn adp-bk-btn--ok" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
