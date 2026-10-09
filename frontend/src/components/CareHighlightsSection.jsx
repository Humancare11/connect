import "./CareHighlightsSection.css";

/**
 * CareHighlightsSection — shared "eyebrow + heading + copy | card grid"
 * section used by the Categories, Specialties and Symptoms pages.
 *
 * @param {string} [props.id] - Optional section id for in-page anchors.
 * @param {string} props.eyebrow - Small uppercase label above the heading.
 * @param {React.ReactNode} props.title - Section <h2> content.
 * @param {React.ReactNode} props.description - Supporting paragraph.
 * @param {Array<{title: string, desc: string}>} props.items - Cards on the right.
 */
export default function CareHighlightsSection({ id, eyebrow, title, description, items = [] }) {
  return (
    <section id={id} className="care-highlights">
      <div className="care-highlights__wrap">
        <div className="care-highlights__grid">
          <div className="care-highlights__left">
            <span className="care-highlights__eyebrow">{eyebrow}</span>
            <h2 className="care-highlights__title">{title}</h2>
            <p className="care-highlights__copy">{description}</p>
          </div>
          <div className="care-highlights__cards">
            {items.map((item) => (
              <div className="care-highlights__card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
