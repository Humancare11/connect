import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./ServiceSwitcher.css";

/**
 * Default row configuration for the featured card's detail list.
 * Override via the `rowConfig` prop if a dataset needs different labels
 * (e.g. "Symptom" / "Specialist" instead of "Condition" / "Route").
 */
const DEFAULT_ROW_CONFIG = [
  { key: "condition", label: "Condition" },
  { key: "need", label: "Need" },
  { key: "route", label: "Route" },
  { key: "status", label: "Status" },
];

/**
 * ServiceSwitcher — a fully data-driven, reusable "service picker" widget.
 *
 * Renders a dark featured card for the active service, a grid of selectable
 * service cards, a bottom info bar, and prev/next pagination. Auto-rotates
 * through `services` on an interval, which resets whenever the user
 * interacts (card click or arrow navigation).
 *
 * Nothing about the content is hardcoded — every page that uses this
 * component supplies its own `services` array and (optionally) its own
 * accent color per service, row labels, and rotation timing.
 *
 * @param {Array<{
 *   id?: string|number,
 *   icon: React.ComponentType,
 *   category: string,
 *   title: string,
 *   subtitle?: string,
 *   condition?: string,
 *   need?: string,
 *   route?: string,
 *   status?: string,
 *   tags?: string[],
 *   accent?: string,
 *   eyebrow?: string,
 *   path?: string,
 * }>} props.services - The list of services to display. Required. A
 *   service with a `path` renders its grid card as an internal `<Link>`
 *   (for interlinking to that service's own page) in addition to
 *   selecting it; without `path` the card just selects, as a `<button>`.
 * @param {string} [props.eyebrow="Wellness consultation"] - Default kicker
 *   label shown above the featured card's title; a service can override it
 *   with its own `eyebrow` field.
 * @param {string} [props.accent="#2F5DF6"] - Default accent color used for
 *   the active grid card, icons, and tag pills; a service can override it
 *   with its own `accent` field.
 * @param {Array<{key:string,label:string}>} [props.rowConfig] - Labels/keys
 *   for the featured card's detail rows.
 * @param {number} [props.autoRotateMs=5000] - Interval between automatic
 *   rotations. Pass 0/false to disable auto-rotation.
 * @param {string} [props.className] - Extra class name for the outer wrapper.
 */
export default function ServiceSwitcher({
  services,
  eyebrow = "Wellness consultation",
  accent = "#2F5DF6",
  rowConfig = DEFAULT_ROW_CONFIG,
  autoRotateMs = 5000,
  className = "",
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef(null);
  const count = services?.length ?? 0;

  const goTo = useCallback(
    (index) => {
      if (count === 0) return;
      setActiveIndex(((index % count) + count) % count);
    },
    [count],
  );

  const restartTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!autoRotateMs || count <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % count);
    }, autoRotateMs);
  }, [autoRotateMs, count]);

  useEffect(() => {
    restartTimer();
    return () => clearInterval(timerRef.current);
  }, [restartTimer]);

  // Keep the active index valid if the dataset shrinks/changes.
  useEffect(() => {
    if (activeIndex >= count) setActiveIndex(0);
  }, [count, activeIndex]);

  const handleSelect = (index) => {
    goTo(index);
    restartTimer();
  };
  const handlePrev = () => {
    goTo(activeIndex - 1);
    restartTimer();
  };
  const handleNext = () => {
    goTo(activeIndex + 1);
    restartTimer();
  };

  if (!count) return null;

  const active = services[activeIndex];
  const ActiveIcon = active.icon;
  const activeAccent = active.accent || accent;
  const activeEyebrow = active.eyebrow || eyebrow;

  return (
    <div
      className={`svc-switcher ${className}`}
      style={{ "--svc-accent": activeAccent }}
    >
      {/* ── Featured card ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active.id ?? activeIndex}
          className="svc-switcher__feature"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="svc-switcher__feature-top">
            <div className="svc-switcher__feature-heading">
              <p className="svc-switcher__eyebrow">{activeEyebrow}</p>
              <h3 className="svc-switcher__title">{active.title}</h3>
            </div>
            {ActiveIcon && (
              <span className="svc-switcher__icon-badge" aria-hidden="true">
                <ActiveIcon size={18} />
              </span>
            )}
          </div>

          <div className="svc-switcher__rows">
            {rowConfig.map(
              ({ key, label }) =>
                active[key] != null && (
                  <div className="svc-switcher__row" key={key}>
                    <span className="svc-switcher__row-label">{label}</span>
                    <span className="svc-switcher__row-value">
                      {active[key]}
                    </span>
                  </div>
                ),
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Service grid ── */}
      <div className="svc-switcher__grid">
        {services.map((service, index) => {
          const Icon = service.icon;
          const isActive = index === activeIndex;
          const cardChildren = (
            <>
              {Icon && (
                <span className="svc-switcher__card-icon" aria-hidden="true">
                  <Icon size={17} />
                </span>
              )}
              <span className="svc-switcher__card-title">
                {service.category}
              </span>
              {service.subtitle && (
                <span className="svc-switcher__card-subtitle">
                  {service.subtitle}
                </span>
              )}
            </>
          );
          const cardClassName = `svc-switcher__card ${isActive ? "is-active" : ""}`;
          const cardStyle = { "--svc-accent": service.accent || accent };

          // A service with a `path` interlinks to its own page; clicking
          // both selects it here and navigates there. Without a `path` the
          // card is just a local selector.
          return service.path ? (
            <Link
              key={service.id ?? index}
              to={service.path}
              className={cardClassName}
              style={cardStyle}
              onClick={() => handleSelect(index)}
              aria-current={isActive ? "true" : undefined}
            >
              {cardChildren}
            </Link>
          ) : (
            <button
              key={service.id ?? index}
              type="button"
              className={cardClassName}
              style={cardStyle}
              onClick={() => handleSelect(index)}
              aria-pressed={isActive}
            >
              {cardChildren}
            </button>
          );
        })}
      </div>

      {/* ── Bottom info bar ── */}
      <div className="svc-switcher__bottombar">
        <div className="svc-switcher__bottombar-left">
          {ActiveIcon && (
            <span className="svc-switcher__bottombar-icon" aria-hidden="true">
              <ActiveIcon size={15} />
            </span>
          )}
          <span className="svc-switcher__bottombar-category">
            {active.category}
          </span>
        </div>
        {active.tags?.length > 0 && (
          <div className="svc-switcher__tags">
            {active.tags.map((tag) => (
              <span className="svc-switcher__tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      <div className="svc-switcher__pagination">
        <button
          type="button"
          className="svc-switcher__nav-btn"
          onClick={handlePrev}
          aria-label="Previous service"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="svc-switcher__dots">
          {services.map((service, index) => (
            <span
              key={service.id ?? index}
              className={`svc-switcher__dot ${index === activeIndex ? "is-active" : ""}`}
            />
          ))}
        </div>

        <button
          type="button"
          className="svc-switcher__nav-btn"
          onClick={handleNext}
          aria-label="Next service"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
