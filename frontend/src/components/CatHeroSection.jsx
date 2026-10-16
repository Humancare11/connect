import { useId } from "react";
import ServiceSwitcher from "./ServiceSwitcher";
import "./CatHeroSection.css";

/**
 * CatHeroSection — shared two-column hero for the Categories, Specialties and
 * Symptoms directory pages.
 *
 * Left column: optional badge, page heading, description and stat tiles.
 * Right column: the interactive ServiceSwitcher card (featured panel, 2×2
 * service grid, info bar, pagination). All content comes from the page.
 *
 * @param {string} [props.id] - Optional section id (e.g. "top" for in-page anchors).
 * @param {{icon?: React.ReactNode, label: string}} [props.badge] - Optional pill above the heading.
 * @param {React.ReactNode} props.title - Page <h1> content.
 * @param {React.ReactNode} props.description - Supporting paragraph.
 * @param {Array<{value: string, label: string}>} [props.stats] - Stat tiles under the copy.
 * @param {Array<object>} props.services - Passed straight to ServiceSwitcher.
 * @param {object} [props.switcherProps] - Extra ServiceSwitcher props (eyebrow, accent, rowConfig, …).
 */
export default function CatHeroSection({
  id,
  badge,
  title,
  description,
  stats = [],
  services,
  switcherProps = {},
}) {
  const headingId = useId();

  return (
    <section id={id} className="cat-hero-section" aria-labelledby={headingId}>
      <div className="cat-hero-section__inner">
        <div className="cat-hero-section__content">
          {badge && (
            <div className="cat-hero-section__badge">
              {badge.icon}
              {badge.label}
            </div>
          )}

          <h1 id={headingId} className="cat-hero-section__title">
            {title}
          </h1>

          <p className="cat-hero-section__copy">{description}</p>

          {stats.length > 0 && (
            <div className="cat-hero-section__stats">
              {stats.map(({ value, label }) => (
                <div key={label} className="cat-hero-section__stat">
                  <div className="cat-hero-section__stat-num">{value}</div>
                  <div className="cat-hero-section__stat-label">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cat-hero-section__panel">
          <ServiceSwitcher services={services} {...switcherProps} />
        </div>
      </div>
    </section>
  );
}
