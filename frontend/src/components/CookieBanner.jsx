import { useEffect, useState } from "react";
import "./CookieBanner.css";

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  const loadGTM = () => {
    if (window.__gtmLoaded) return;

    window.__gtmLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      "gtm.start": new Date().getTime(),
      event: "gtm.js",
    });

    const script = document.createElement("script");
    script.async = true;
    script.src =
      "https://www.googletagmanager.com/gtm.js?id=GTM-5DQTLVD4";

    document.head.appendChild(script);
  };



  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent");

    if (!consent) {
      setShow(true);
      return;
    }

    if (consent === "accepted") {
      loadGTM();
      loadLiveChat();
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookieConsent", "accepted");
    loadGTM();
    setShow(false);
  };

  const handleReject = () => {
    localStorage.setItem("cookieConsent", "rejected");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="cookie-banner-overlay">
      <div className="cookie-banner">
        <div className="cookie-banner-content">
          <h4>Cookie Preferences</h4>

          <p>
            We use cookies and similar technologies to improve your experience,
            and analyze website traffic.
          </p>
        </div>

        <div className="cookie-banner-actions">
          <button
            className="cookie-btn cookie-btn-secondary"
            onClick={handleReject}
          >
            Reject
          </button>

          <button
            className="cookie-btn cookie-btn-primary"
            onClick={handleAccept}
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}