import React from "react";
import "./LogoMarquee.css";

const labels = [
  "24/7 ACCESS",
  "LICENSED PROVIDERS",
  "SAME-DAY APPOINTMENTS",
  "SECURE PRESCRIPTIONS",
  "PRIVATE CONSULTATIONS",
  "GLOBAL SERVICES",
];

export default function MM() {
  const items = [...labels, ...labels, ...labels, ...labels];

  return (
    <div className="logo-marquee">
      <div className="lm-mask">
        <div className="lm-track">
          {items.map((name, i) => (
            <React.Fragment key={i}>
              <span>{name}</span>
              <span className="lm-separator">•</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}