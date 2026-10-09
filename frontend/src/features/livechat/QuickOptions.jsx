// The quick-option cards shown after the greeting (icon, label, chevron). Options come from AI settings.
const svg = (children, fill = "none") => (
  <svg viewBox="0 0 24 24" fill={fill} stroke={fill === "none" ? "currentColor" : "none"} strokeWidth="1.8" aria-hidden="true">
    {children}
  </svg>
);

const ICONS = {
  stethoscope: svg(
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8 17c.6-2 2.1-3 4-3s3.4 1 4 3" />
    </>
  ),
  pill: svg(
    <>
      <rect x="6" y="3" width="12" height="4" rx="1" />
      <path d="M5 10h14M5 14h14M5 18h14" />
    </>
  ),
  clipboard: svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </>
  ),
  document: svg(
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
    </>
  ),
  dots: svg(
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="sans-serif">
        ?
      </text>
    </>,
    "currentColor"
  ),
  agent: svg(
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="13" width="4" height="6" rx="1.5" />
      <rect x="17" y="13" width="4" height="6" rx="1.5" />
      <path d="M19 19c0 1.5-2 2.5-5 2.5" />
    </>
  ),
};

export default function QuickOptions({ options, onPick, disabled }) {
  if (!options?.length) return null;
  return (
    <div className="lcw-opts" role="group" aria-label="Quick options">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={`lcw-opt${option.key === "live" ? " lcw-opt--live" : ""}`}
          onClick={() => onPick(option.key)}
          disabled={disabled}
        >
          {ICONS[option.icon] || ICONS.dots}
          <span className="lcw-opt-label">{option.label}</span>
          <span className="lcw-opt-chev" aria-hidden="true">
            ›
          </span>
        </button>
      ))}
    </div>
  );
}
