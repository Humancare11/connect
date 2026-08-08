import { useState, useId } from "react";
import { motion } from "framer-motion";
import "./FAQ.css";

/**
 * FAQ — fully data-driven, reusable two-column FAQ block.
 *
 * <FAQ
 *   badge="FAQ"
 *   title="Frequently Asked Questions"
 *   description="..."
 *   stats={["Chat with our team", "Avg. response in 2 mins", "HIPAA secure & private", "Available in all 50 states"]}
 *   sections={[{ title: "Appoin
 * ments", items: [{ question, answer }] }]}
 *   cta={{ title, description, button, href, onClick }}
 *   initialLimit={4}
 * />
 */
export default function FAQ({
  badge,
  title,
  description,
  stats = [],
  sections = [],
  cta,
  className = "",
  initialLimit = 4,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Assign global indices to questions to filter by initialLimit
  let globalIndex = 0;
  const sectionsWithGlobalIndices = sections.map((section) => {
    const items = section.items.map((item) => {
      const idx = globalIndex;
      globalIndex++;
      return { ...item, globalIndex: idx };
    });
    return { ...section, items };
  });

  const totalQuestions = globalIndex;
  const hasMore = totalQuestions > initialLimit;

  return (
    <section
      className={`faq${isExpanded ? " faq--expanded" : ""}${className ? ` ${className}` : ""}`}
    >
      <div className="faq__inner">
        <div className="faq__main">
          <aside className="faq__side">
            {badge && (
              <span className="faq__badge">
                <span className="faq__badge-dot" aria-hidden="true" />
                {badge}
              </span>
            )}

            {title && <h2 className="faq__title">{title}</h2>}
            {description && <p className="faq__description">{description}</p>}

            {/* {stats.length > 0 && (
              <ul className="faq__stats">
                {stats.map((stat, i) => (
                  <FAQStat
                    key={typeof stat === "string" ? stat : stat.label}
                    stat={stat}
                    index={i}
                  />
                ))}
              </ul>
            )} */}
          </aside>

          <div className="faq__groups">
            {sectionsWithGlobalIndices.map((section) => (
              <FAQSection
                key={section.title}
                section={section}
                initialLimit={initialLimit}
                isExpanded={isExpanded}
              />
            ))}

            {hasMore && (
              <div className="faq__view-more-container">
                <button
                  type="button"
                  className={`faq__view-more-btn${isExpanded ? " faq__view-more-btn--expanded" : ""}`}
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? "View Less" : "View More"}
                  <ChevronDownIcon />
                </button>
              </div>
            )}
          </div>
        </div>

        {cta && <FAQCta cta={cta} />}
      </div>
    </section>
  );
}

function FAQStat({ stat, index }) {
  const data = typeof stat === "string" ? { label: stat } : stat;
  const isPrimary = index === 0;
  const Icon =
    data.icon ||
    (isPrimary
      ? ChatIcon
      : DEFAULT_STAT_ICONS[(index - 1) % DEFAULT_STAT_ICONS.length]);

  const inner = (
    <>
      <span className="faq__stat-icon">
        <Icon />
      </span>
      <span className="faq__stat-label">{data.label}</span>
    </>
  );

  const linkClass = `faq__stat-link${isPrimary ? " faq__stat-link--primary" : ""}`;

  let body;
  if (data.href) {
    body = (
      <a href={data.href} className={linkClass} onClick={data.onClick}>
        {inner}
      </a>
    );
  } else if (data.onClick) {
    body = (
      <button type="button" className={linkClass} onClick={data.onClick}>
        {inner}
      </button>
    );
  } else {
    body = <div className={linkClass}>{inner}</div>;
  }

  return (
    <li className={`faq__stat${isPrimary ? " faq__stat--primary" : ""}`}>
      {body}
    </li>
  );
}

function FAQSection({ section, initialLimit, isExpanded }) {
  const [openIndex, setOpenIndex] = useState(0);
  const uid = useId();

  const isSectionExtra = section.items.every(
    (item) => item.globalIndex >= initialLimit,
  );

  return (
    <motion.div
      initial={
        isSectionExtra
          ? { height: 0, opacity: 0, overflow: "hidden" }
          : undefined
      }
      animate={
        isSectionExtra
          ? {
              height: isExpanded ? "auto" : 0,
              opacity: isExpanded ? 1 : 0,
            }
          : undefined
      }
      transition={{ duration: 0.35, ease: [0.04, 0.62, 0.23, 0.98] }}
      style={{ overflow: "hidden" }}
      className={`faq__group${isSectionExtra && !isExpanded ? " faq__group--collapsed-extra" : ""}`}
    >
      <p className="faq__group-title">
        <span className="faq__group-marker" aria-hidden="true" />
        {section.title}
      </p>

      <ul className="faq__accordion">
        {section.items.map((item, i) => {
          const isOpen = openIndex === i;
          const isExtra = item.globalIndex >= initialLimit;
          const panelId = `${uid}-panel-${i}`;
          const triggerId = `${uid}-trigger-${i}`;

          return (
            <motion.li
              key={item.question}
              initial={
                isExtra
                  ? { height: 0, opacity: 0, overflow: "hidden" }
                  : undefined
              }
              animate={
                isExtra
                  ? {
                      height: isExpanded ? "auto" : 0,
                      opacity: isExpanded ? 1 : 0,
                    }
                  : undefined
              }
              transition={{ duration: 0.35, ease: [0.04, 0.62, 0.23, 0.98] }}
              style={{ overflow: "hidden" }}
              className="faq__item"
            >
              <h3 className="faq__item-heading">
                <button
                  type="button"
                  id={triggerId}
                  className="faq__trigger"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? -1 : i)}
                >
                  <span className="faq__question">{item.question}</span>
                  <span
                    className={`faq__icon${isOpen ? " faq__icon--open" : ""}`}
                    aria-hidden="true"
                  >
                    <PlusIcon />
                  </span>
                </button>
              </h3>

              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className={`faq__panel${isOpen ? " faq__panel--open" : ""}`}
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="faq__panel-inner">
                  <p className="faq__answer">{item.answer}</p>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}

function FAQCta({ cta }) {
  const { title, description, button, href, onClick } = cta;

  let buttonEl = null;
  if (button) {
    const buttonInner = (
      <>
        {button}
        <ArrowIcon />
      </>
    );
    buttonEl = href ? (
      <a href={href} className="faq__cta-button" onClick={onClick}>
        {buttonInner}
      </a>
    ) : (
      <button type="button" className="faq__cta-button" onClick={onClick}>
        {buttonInner}
      </button>
    );
  }

  return (
    <div className="faq__cta">
      <div className="faq__cta-copy">
        {title && <h3 className="faq__cta-title">{title}</h3>}
        {description && <p className="faq__cta-description">{description}</p>}
      </div>
      {buttonEl}
    </div>
  );
}

/* ---------- Inline icons (no external icon dependency) ---------- */

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <path
        d="M4 12.2C4 7.9 7.8 4.5 12.2 4.5C16.6 4.5 20.2 7.9 20.2 12.2C20.2 16.5 16.6 19.9 12.2 19.9C10.9 19.9 9.7 19.6 8.6 19.1L4 20.2L5.2 16.2C4.4 15 4 13.6 4 12.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path
        d="M5 12H19M19 12L13 6M19 12L13 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path
        d="M12 5V19M5 12H19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width="16"
      height="16"
      className="faq__view-more-icon"
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <path
        d="M12.5 3L5 13.5H11L10 21L18.5 9.5H12.5L12.5 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <path
        d="M12 3.5L19 6.3V11.3C19 15.9 16 19.5 12 20.7C8 19.5 5 15.9 5 11.3V6.3L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12L11.2 14L15 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4 12H20M12 4C14.2 6.4 15.3 9.1 15.3 12C15.3 14.9 14.2 17.6 12 20C9.8 17.6 8.7 14.9 8.7 12C8.7 9.1 9.8 6.4 12 4Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

const DEFAULT_STAT_ICONS = [BoltIcon, ShieldIcon, GlobeIcon];
