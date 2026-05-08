import React from "react";
import "./LogoMarquee.css";

const companies = [
  "FIGMA",
  "FRAMER",
  "WEBFLOW",
  "RAYCAST",
  "SUPABASE",
  "CLERK",
];

export default function MM() {
 
  const items = [...companies, ...companies, ...companies, ...companies];

  return (
    <div className="logo-marquee">
      {/* <div className="lm-label">Trusted by 1,200+ companies</div> */}
      <div className="lm-mask">
        <div className="lm-track">
          {items.map((name, i) => (
            <span key={i}>{name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
