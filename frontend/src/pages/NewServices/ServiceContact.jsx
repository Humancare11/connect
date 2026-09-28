import React, { useState } from "react";
import { FiCheckCircle, FiMessageSquare, FiLock } from "react-icons/fi";
import api from "../../api";
import "./newservices.css";

const ConsultationForm = ({ s }) => {
  const [values, setValues] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field) => (e) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const { data } = await api.post("/api/contact", values);

      if (data.success) {
        setSubmitted(true);
        setValues({
          name: "",
          email: "",
          message: "",
        });
      } else {
        alert(data.message || "Failed to submit request.");
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Unable to submit request.");
    }
  };

  return (
    <div
      className="service-contact-card"
      style={{ "--service-accent": s?.accentColor || "#2563EB" }}
    >
      {submitted ? (
        <div style={{ textAlign: "center", padding: "32px 8px" }}>
          <div className="service-contact-icon-wrap service-contact-icon-wrap--success">
            <FiCheckCircle style={{ fontSize: 24, color: s?.accentColor || "var(--service-accent)" }} />
          </div>

          <h3 className="service-contact-title">
            Request received
          </h3>

          <p style={{ color: "var(--service-text-body)", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            A member of our care team will reach out to{" "}
            {values.email || "you"} shortly.
          </p>

          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setValues({
                name: "",
                email: "",
                message: "",
              });
            }}
            className="service-contact-reset-btn"
          >
            Send another request
          </button>
        </div>
      ) : (
        <>
          <div className="service-contact-icon-wrap">
            <FiMessageSquare style={{ fontSize: 20, color: s?.accentColor || "var(--service-accent)" }} />
          </div>

          <h3 className="service-contact-title">
            Request a Consultation
          </h3>

          <p className="service-contact-desc">
            Tell us a little about what you need, and a care coordinator
            will follow up within one business day.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="service-form-group">
              <label htmlFor="consult-name" className="service-form-label">
                Full name
              </label>

              <input
                id="consult-name"
                type="text"
                required
                placeholder="Jordan Lee"
                value={values.name}
                onChange={handleChange("name")}
                className="service-form-input"
              />
            </div>

            <div className="service-form-group">
              <label htmlFor="consult-email" className="service-form-label">
                Email address
              </label>

              <input
                id="consult-email"
                type="email"
                required
                placeholder="jordan@email.com"
                value={values.email}
                onChange={handleChange("email")}
                className="service-form-input"
              />
            </div>

            <div className="service-form-group service-form-group--textarea">
              <label htmlFor="consult-message" className="service-form-label">
                What can we help with?
              </label>

              <textarea
                id="consult-message"
                rows={4}
                required
                placeholder="Briefly describe your symptoms..."
                value={values.message}
                onChange={handleChange("message")}
                className="service-form-textarea"
              />
            </div>

            <button
              type="submit"
              className="service-btn service-btn--primary service-btn--full"
            >
              Submit Request
            </button>

            <div className="service-form-privacy">
              <FiLock className="service-form-privacy__icon" />
              Your information is encrypted and never shared without
              consent.
            </div>
          </form>
        </>
      )}
    </div>
  );
};

function ServiceContact({ s }) {
  return (
    <section>
      <ConsultationForm s={s} />
    </section>
  );
}

export default ServiceContact;