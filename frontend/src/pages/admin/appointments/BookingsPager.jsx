import { pageWindow, rangeText } from "./bookingFormat";

// "Showing 26-50 of 132" and the page buttons.
export default function BookingsPager({ page, totalPages, shown, total, onPage }) {
  return (
    <div className="adp-bk-foot">
      <span>{rangeText(page, shown, total)}</span>
      {totalPages > 1 && (
        <nav className="adp-bk-pager" aria-label="Appointment pages">
          <button type="button" className="adp-bk-pager-btn" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <span className="adp-bk-pager-text">Previous</span>
            <span className="adp-bk-pager-chev" aria-hidden="true">{"‹"}</span>
          </button>
          {pageWindow(page, totalPages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="adp-bk-pager-gap" aria-hidden="true">{"…"}</span>
            ) : (
              <button
                key={p}
                type="button"
                className={`adp-bk-pager-btn${p === page ? " adp-bk-pager-btn--active" : ""}`}
                aria-current={p === page ? "page" : undefined}
                onClick={() => p !== page && onPage(p)}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" className="adp-bk-pager-btn" aria-label="Next page" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            <span className="adp-bk-pager-text">Next</span>
            <span className="adp-bk-pager-chev" aria-hidden="true">{"›"}</span>
          </button>
        </nav>
      )}
    </div>
  );
}
