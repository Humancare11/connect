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
    }
  }, []);

  // Tells the rest of the app (e.g. the live-chat visitor tracker) about the choice without polling.
  const announce = (value) => {
    window.dispatchEvent(new CustomEvent("hc:cookie-consent", { detail: { value } }));
  };

  const handleAccept = () => {
    localStorage.setItem("cookieConsent", "accepted");
    loadGTM();
    setShow(false);
    announce("accepted");
  };

  const handleReject = () => {
    localStorage.setItem("cookieConsent", "rejected");
    setShow(false);
    announce("rejected");
  };

  // Lets the live-chat launcher move out of the banner's way while the banner is on screen.
  useEffect(() => {
    document.documentElement.classList.toggle("hc-cookie-open", show);
    return () => document.documentElement.classList.remove("hc-cookie-open");
  }, [show]);

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