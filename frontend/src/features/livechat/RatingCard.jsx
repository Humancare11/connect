import { useState } from "react";

// After the team resolves a chat: 1-5 stars, once (docs/chat-demo.html .rating). A rated chat shows a thank-you.
export default function RatingCard({ rating, canRate, onRate }) {
  const [hover, setHover] = useState(0);
  const [sending, setSending] = useState(false);

  if (rating) {
    return (
      <div className="lcw-rating" role="status">
        Thanks for your feedback! <span className="lcw-stars-done">{"★".repeat(rating.stars)}</span>
      </div>
    );
  }
  if (!canRate) return null;
  return (
    <div className="lcw-rating">
      This chat has ended. How did we do?
      <div className="lcw-stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n <= hover ? "is-on" : ""}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            disabled={sending}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={async () => {
              setSending(true);
              await onRate(n);
              setSending(false);
            }}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
