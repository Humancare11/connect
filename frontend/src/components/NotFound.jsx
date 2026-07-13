import "./NotFound.css";
import notFoundIllustration from "../assets/404-hero.png";

export default function NotFound() {
  return (
    <main className="nf-page">
      {/* ---------- HERO ---------- */}
      <section className="nf-hero">
        <div className="nf-hero-left">
          <p className="nf-404">404</p>
          <h1 className="nf-heading">
            Oops! This page <br /> can't be found.
          </h1>
          <p className="nf-sub">
            The page you're looking for may have been moved, deleted, or
            never existed.
          </p>
          <a href="/" className="nf-home-btn">
            <span className="nf-arrow">&larr;</span> Go Back Home
          </a>
        </div>

        <div className="nf-hero-right">
          <div className="nf-illustration-card">
            <img
              src={notFoundIllustration}
              alt="Illustration of a person looking at a signpost with two directional signs: 'We're here to support you' and 'Let's get you back on track'"
              className="nf-illustration"
            />
          </div>
        </div>
      </section>

      {/* ---------- SUPPORT BANNER ---------- */}
      <section className="nf-links-section">
        <div className="nf-support-banner">
          <div className="nf-support-left">
            <span className="nf-support-logo" aria-hidden="true">
              💙
            </span>
            <div>
              <p className="nf-support-title">
                We're here to support you.
              </p>
              <p className="nf-support-desc">
                If you need assistance or have any questions, our team is ready
                to help.
              </p>
            </div>
          </div>
          <a href="/contact-us" className="nf-support-btn">
            Contact Us
          </a>
        </div>
      </section>
    </main>
  );
}
