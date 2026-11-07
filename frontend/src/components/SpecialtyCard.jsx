import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowRight } from "react-icons/fi";

// One "Specialties Covered" card, shared by every category landing page
// (styles: .hcc-specialty-* in pages/Categories/categoriesGlobal.css).
//   sp    { name, desc, path? }  — a card without a path is shown but not linked
//   index position in the grid, used to stagger the entrance animation
export default function SpecialtyCard({ sp, index = 0 }) {
  // Some page data has stray whitespace in `path` (e.g. "/women-health/menopause-care "),
  // which would never match a route, so trim it here once for every page.
  const path = sp.path?.trim();
  const card = (
    <motion.div
      className="hcc-specialty-card"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
    >
      <div className="hcc-specialty-name">{sp.name}</div>
      <p className="hcc-specialty-desc">{sp.desc}</p>
      {path && (
        <div className="hcc-specialty-footer">
          Learn more <FiArrowRight size={13} />
        </div>
      )}
    </motion.div>
  );

  return path ? (
    <Link
      to={path}
      className="hcc-specialty-link"
      aria-label={`View ${sp.name}`}
    >
      {card}
    </Link>
  ) : (
    card
  );
}
