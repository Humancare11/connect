// components/booking/BookingCard.jsx
import { Link } from "react-router-dom";
import { FiShield, FiCheckCircle } from "react-icons/fi";

const DEFAULT_FEATURES = [
    "Board-certified physician",
    "Rx to your pharmacy",
    "Doctor's note included",
    "24hr follow-up support",
    "HIPAA secure session",
];

function BookingCard({
    price,
    priceLoading,
    ctaHref,
    ctaLabel = "Start Consultation →",
    features = DEFAULT_FEATURES,
    badgeLabel = "Doctors Available Now",
}) {
    return (
        <div className="hcc-booking-card">
            <div className="hcc-booking-badge">
                <span className="hcc-booking-badge-dot" />
                {badgeLabel}
            </div>

            <div className="hcc-booking-price-block">
                <div className="hcc-booking-price">
                    {priceLoading ? (
                        <span style={{ opacity: 0.5, color: "#FFF" }}>Loading...</span>
                    ) : (price !== null && price !== undefined && Number(price) > 0) ? (
                        `$${price}`
                    ) : (
                        `$49`
                    )}
                </div>
                <p className="hcc-booking-price-sub">
                    One-time consultation fee · No subscription required
                </p>
            </div>

            <div className="hcc-booking-info">
                <FiShield size={15} className="hcc-booking-info-icon" />
                <p className="hcc-booking-info-text">
                    No extra fee for doctor notes, prescriptions, or specialist referrals.{" "}
                    <strong className="hcc-booking-info-strong">Everything is included.</strong>
                </p>
            </div>

            <div className="hcc-booking-features">
                {features.map((item, i) => (
                    <div
                        key={item}
                        className="hcc-booking-feature-row"
                        style={{ animationDelay: `${0.35 + i * 0.07}s` }}
                    >
                        <FiCheckCircle size={15} className="hcc-booking-check" />
                        <span className="hcc-booking-feature-text">{item}</span>
                    </div>
                ))}
            </div>

            <Link to={ctaHref}>
                <button className="hcc-booking-cta">{ctaLabel}</button>
            </Link>
            <p className="hcc-booking-terms">
                By continuing, you agree to our{" "}
                <a href="/terms-of-service" className="hcc-booking-link">Terms of Service</a> and{" "}
                <a href="/privacy-policy" className="hcc-booking-link">Privacy Policy</a>
            </p>
        </div>
    );
}

export default BookingCard;