import "./RetryButton.css";

// "Try again" button shown next to a load-error message; onRetry re-runs the page's fetch.
export default function RetryButton({ onRetry, className = "" }) {
  return (
    <button type="button" className={`hc-retry-btn ${className}`.trim()} onClick={onRetry}>
      Try again
    </button>
  );
}
