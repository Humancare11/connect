import { useEffect, useState } from "react";
import api from "../api";
import "./Services.css";
import SEO from "../components/Seo";

function ServiceIcon({ icon, name }) {
  const value = String(icon || "").trim();

  if (/^(https?:)?\/\//.test(value) || value.startsWith("/") || value.startsWith("data:image/")) {
    return <img className="dynamic-service-icon-img" src={value} alt="" loading="lazy" />;
  }

  return (
    <span className="dynamic-service-icon-text" aria-hidden="true">
      {value || name?.charAt(0) || "S"}
    </span>
  );
}

export default function HealthcareAlternating() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    api
      .get("/api/services")
      .then((res) => {
        if (active) setServices(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (active) setError("Services are not available right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
                  <SEO
        title="Online Healthcare Services | Doctor Consultation, Prescriptions & Telehealth Care"
        description="Access reliable online healthcare services including doctor consultations, online prescriptions, lab tests, home care, and medical certificates. Fast, secure, and available anytime, anywhere."
        keywords="Online healthcare services, Virtual doctor consultation, Online prescriptions, Telehealth services"
        url="https://humancareconnect.co/medical-services"
      />
      <div className="ha-page">
      <section>
        <div className="ms-hero">
          <div className="ms-hero-inner">
            <h1>Our Healthcare Services</h1>
            <p>Reliable, fast & professional medical support available anytime, anywhere.</p>
          </div>
        </div>
      </section>

      <main className="dynamic-services-main">
        {loading ? (
          <p className="dynamic-services-state">Loading services...</p>
        ) : error ? (
          <p className="dynamic-services-state">{error}</p>
        ) : services.length === 0 ? (
          <p className="dynamic-services-state">No services are available yet.</p>
        ) : (
          <section className="dynamic-services-grid" aria-label="Healthcare services">
            {services.map((service) => (
              <article className="dynamic-service-card" key={service._id}>
                <div className="dynamic-service-icon">
                  <ServiceIcon icon={service.icon} name={service.name} />
                </div>
                <div>
                  <h2>{service.name}</h2>
                  <p className="dynamic-service-description">{service.description}</p>
                  <p>${Number(service.price || 0).toFixed(2)}</p>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
    </>
  );
}
