import { useState, useMemo, useEffect } from "react";
import "./Findadoctor.css";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../hooks/useCurrency";

const specialities = [
  "Adolescent Medicine",
  "Adult Reconstructive Orthopaedics",
  "Andrologist",
  "Anesthesiologist",
  "Audiologist",
  "Cardiologist",
  "Dermatologist",
  "ENT Specialist",
  "Gastroenterologist",
  "General Physician",
  "Ophthalmologist",
  "Dental Surgeon",
  "Dentist",
  "Maxillofacial Surgeon / Oral Surgeon",
  "Psychology/Psychotherapist",
  "Neurologist",
  "Orthopedic Surgeon",
];

const languages = [
  "Arabic",
  "Armenian",
  "Assamese",
  "Bengali",
  "Bhojpuri",
  "Chinese",
  "English",
  "Gujarati",
  "Hindi",
  "Kannada",
  "Malayalam",
  "Marathi",
];

const allDoctors = [];

const DOCTORS_PER_PAGE = 10;

const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#F5A623">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
const VerifiedIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="#0C8B7A" />
    <path
      d="M9 12l2 2 4-4"
      stroke="white"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const LocationIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
      fill="#6B7280"
    />
    <circle cx="12" cy="9" r="2.5" fill="white" />
  </svg>
);
const HeartIcon = ({ filled }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill={filled ? "#e53935" : "none"}
    stroke="#e53935"
    strokeWidth="2"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const SearchIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#9CA3AF"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);
const FilterIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="10" y1="18" x2="14" y2="18" />
  </svg>
);
const ChevronLeft = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <path d="M15 18l-6-6 6-6" strokeLinecap="round" />
  </svg>
);
const ChevronRight = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <path d="M9 18l6-6-6-6" strokeLinecap="round" />
  </svg>
);

// Normalize a doctor object from the API so all fields are always defined
const normalizeDoctor = (doc) => ({
  id: "",
  name: "Unknown Doctor",
  degree: "",
  specialty: "General",
  rating: "N/A",
  experience: 0,
  location: "Location not specified",
  languages: [],
  price: 0,
  color: "#6366f1",
  initials: "DR",
  gender: "Any",
  source: "",
  ...doc,
  languages: Array.isArray(doc.languages) ? doc.languages : [],
  price: typeof doc.price === "number" ? doc.price : Number(doc.price) || 0,
});

export default function DoctorFinder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [dynamicDoctors, setDynamicDoctors] = useState(allDoctors);

  // ✅ All hooks moved to top level of the component (not inside handleBook)
  const [searchSpecialty, setSearchSpecialty] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [pendingSpecialities, setPendingSpecialities] = useState([]);
  const [pendingGender, setPendingGender] = useState("Any");
  const [pendingLanguages, setPendingLanguages] = useState([]);
  const [appliedSpecialities, setAppliedSpecialities] = useState([]);
  const [appliedGender, setAppliedGender] = useState("Any");
  const [appliedLanguages, setAppliedLanguages] = useState([]);
  const [appliedSearchSpecialty, setAppliedSearchSpecialty] = useState("");
  const [appliedSearchLocation, setAppliedSearchLocation] = useState("");
  const [specialitySearch, setSpecialitySearch] = useState("");
  const [languageSearch, setLanguageSearch] = useState("");
  const [favorites, setFavorites] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    api
      .get("/api/doctor/approved")
      .then((res) => {
        const normalized = res.data.map(normalizeDoctor);
        setDynamicDoctors([...normalized, ...allDoctors]);
      })
      .catch(() => setDynamicDoctors(allDoctors));
  }, []);

  // ✅ handleBook is now a clean, simple function at component level
  const handleBook = (doc) => {
    if (!user) {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
    }
    navigate("/book-appointment", { state: { doctor: doc } });
  };

  const toggleFavorite = (id) => setFavorites((p) => ({ ...p, [id]: !p[id] }));
  const toggleSpeciality = (s) =>
    setPendingSpecialities((p) =>
      p.includes(s) ? p.filter((x) => x !== s) : [...p, s],
    );
  const toggleLanguage = (l) =>
    setPendingLanguages((p) =>
      p.includes(l) ? p.filter((x) => x !== l) : [...p, l],
    );

  const clearAll = () => {
    setPendingSpecialities([]);
    setPendingGender("Any");
    setPendingLanguages([]);
    setAppliedSpecialities([]);
    setAppliedGender("Any");
    setAppliedLanguages([]);
    setAppliedSearchSpecialty("");
    setAppliedSearchLocation("");
    setSearchSpecialty("");
    setSearchLocation("");
    setCurrentPage(1);
  };

  const applyFilters = () => {
    setAppliedSpecialities(pendingSpecialities);
    setAppliedGender(pendingGender);
    setAppliedLanguages(pendingLanguages);
    setAppliedSearchSpecialty(searchSpecialty);
    setAppliedSearchLocation(searchLocation);
    setCurrentPage(1);
  };

  const handleSearch = () => {
    setAppliedSearchSpecialty(searchSpecialty);
    setAppliedSearchLocation(searchLocation);
    setCurrentPage(1);
  };

  const filteredSpecialities = specialities.filter((s) =>
    s.toLowerCase().includes(specialitySearch.toLowerCase()),
  );
  const filteredLanguages = languages.filter((l) =>
    l.toLowerCase().includes(languageSearch.toLowerCase()),
  );

  const filteredDoctors = useMemo(() => {
    return dynamicDoctors.filter((doc) => {
      if (appliedSearchSpecialty) {
        const q = appliedSearchSpecialty.toLowerCase();
        if (
          !(doc.specialty ?? "").toLowerCase().includes(q) &&
          !(doc.name ?? "").toLowerCase().includes(q) &&
          !(doc.degree ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      if (
        appliedSearchLocation &&
        !(doc.location ?? "")
          .toLowerCase()
          .includes(appliedSearchLocation.toLowerCase())
      )
        return false;
      if (
        appliedSpecialities.length > 0 &&
        !appliedSpecialities.includes(doc.specialty)
      )
        return false;
      if (appliedGender !== "Any" && doc.gender !== appliedGender) return false;
      if (
        appliedLanguages.length > 0 &&
        !appliedLanguages.some((l) => (doc.languages ?? []).includes(l))
      )
        return false;
      return true;
    });
  }, [
    dynamicDoctors,
    appliedSearchSpecialty,
    appliedSearchLocation,
    appliedSpecialities,
    appliedGender,
    appliedLanguages,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredDoctors.length / DOCTORS_PER_PAGE),
  );
  const paginatedDoctors = filteredDoctors.slice(
    (currentPage - 1) * DOCTORS_PER_PAGE,
    currentPage * DOCTORS_PER_PAGE,
  );
  const activeFilterCount =
    appliedSpecialities.length +
    (appliedGender !== "Any" ? 1 : 0) +
    appliedLanguages.length;
  const hasAnyFilter =
    activeFilterCount > 0 || appliedSearchSpecialty || appliedSearchLocation;

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("…");
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      )
        pages.push(i);
      if (currentPage < totalPages - 2) pages.push("…");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="fd-wrapper">
      <div className="fd-hero">
        <div className="fd-hero-inner">
          <div className="fd-hero-text">
            <h1>Find the right doctor for you</h1>
            <p>
              Book in minutes with top-rated specialists across Maharashtra. No
              referral needed.
            </p>
          </div>
          <div className="fd-search-bar">
            <div className="fd-search-field">
              <label>Condition or Specialty</label>
              <input
                value={searchSpecialty}
                onChange={(e) => setSearchSpecialty(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="e.g. Cardiologist, back pain…"
              />
            </div>
            <div className="fd-search-divider" />
            <div className="fd-search-field">
              <label>Location</label>
              <input
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="City or area…"
              />
            </div>
            <button className="fd-search-btn" onClick={handleSearch}>
              Search
            </button>
          </div>
          {(appliedSearchSpecialty || appliedSearchLocation) && (
            <div className="fd-active-tags">
              {appliedSearchSpecialty && (
                <span className="fd-tag fd-tag-blue">
                  🔍 "{appliedSearchSpecialty}"{" "}
                  <button
                    onClick={() => {
                      setSearchSpecialty("");
                      setAppliedSearchSpecialty("");
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
              {appliedSearchLocation && (
                <span className="fd-tag fd-tag-red">
                  📍 "{appliedSearchLocation}"{" "}
                  <button
                    onClick={() => {
                      setSearchLocation("");
                      setAppliedSearchLocation("");
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="fd-main">
        <aside className="fd-sidebar">
          <div className="fd-sidebar-head">
            <span className="fd-sidebar-title">
              <FilterIcon /> Filters{" "}
              {activeFilterCount > 0 && (
                <span className="fd-badge">{activeFilterCount}</span>
              )}
            </span>
            <button className="fd-clear-btn" onClick={clearAll}>
              Clear all
            </button>
          </div>

          <div className="fd-filter-group">
            <div className="fd-filter-label">Speciality</div>
            <div className="fd-filter-search">
              <SearchIcon />
              <input
                value={specialitySearch}
                onChange={(e) => setSpecialitySearch(e.target.value)}
                placeholder="Search…"
              />
            </div>
            <div className="fd-check-list">
              {filteredSpecialities.map((s) => (
                <label
                  key={s}
                  className={`fd-check-item${pendingSpecialities.includes(s) ? " checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={pendingSpecialities.includes(s)}
                    onChange={() => toggleSpeciality(s)}
                  />
                  <span className="fd-checkmark" />
                  {s}
                </label>
              ))}
              {filteredSpecialities.length === 0 && (
                <div className="fd-empty-filter">No results</div>
              )}
            </div>
          </div>

          <div className="fd-filter-group">
            <div className="fd-filter-label">Gender</div>
            <div className="fd-radio-group">
              {["Any", "Male", "Female"].map((g) => (
                <label
                  key={g}
                  className={`fd-radio-item${pendingGender === g ? " selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={pendingGender === g}
                    onChange={() => setPendingGender(g)}
                  />
                  {g}
                </label>
              ))}
            </div>
          </div>

          <div className="fd-filter-group">
            <div className="fd-filter-label">Language</div>
            <div className="fd-filter-search">
              <SearchIcon />
              <input
                value={languageSearch}
                onChange={(e) => setLanguageSearch(e.target.value)}
                placeholder="Search…"
              />
            </div>
            <div className="fd-check-list">
              {filteredLanguages.map((l) => (
                <label
                  key={l}
                  className={`fd-check-item${pendingLanguages.includes(l) ? " checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={pendingLanguages.includes(l)}
                    onChange={() => toggleLanguage(l)}
                  />
                  <span className="fd-checkmark" />
                  {l}
                </label>
              ))}
              {filteredLanguages.length === 0 && (
                <div className="fd-empty-filter">No results</div>
              )}
            </div>
          </div>

          <button className="fd-apply-btn" onClick={applyFilters}>
            Apply Filters
          </button>
        </aside>

        <div className="fd-listings">
          <div className="fd-listings-head">
            <div className="fd-results-label">
              {hasAnyFilter ? (
                <>
                  <strong>{filteredDoctors.length}</strong> result
                  {filteredDoctors.length !== 1 ? "s" : ""} found
                </>
              ) : (
                <>
                  {/* <strong>1,407,546</strong> doctors available */}
                </>
              )}
            </div>
            {hasAnyFilter && (
              <button className="fd-clear-link" onClick={clearAll}>
                Clear all filters
              </button>
            )}
          </div>

          {paginatedDoctors.length === 0 ? (
            <div className="fd-empty">
              <div className="fd-empty-emoji">🔍</div>
              <h3>No doctors found</h3>
              <p>Try adjusting your filters or search terms</p>
              <button className="fd-reset-btn" onClick={clearAll}>
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="fd-card-list">
              {paginatedDoctors.map((doc, i) => {
                const langs = Array.isArray(doc.languages) ? doc.languages : [];
                const price =
                  typeof doc.price === "number"
                    ? doc.price
                    : Number(doc.price) || 0;

                return (
                  <div
                    className="fd-card"
                    key={doc.id ?? i}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {/* Avatar Section */}
                    <div className="fd-avatar-section">
                      <div
                        className="fd-avatar"
                        style={{
                          background: `${doc.color ?? "#6366f1"}18`,
                          color: doc.color ?? "#6366f1",
                          borderColor: `${doc.color ?? "#6366f1"}30`,
                        }}
                      >
                        {doc.initials ?? "DR"}
                      </div>
                    </div>

                    {/* Info Section */}
                    <div className="fd-card-info">
                      <div className="fd-name-row">
                        <span className="fd-name">
                          {doc.name ?? "Unknown Doctor"}
                        </span>
                        {doc.source !== "enrollment" && <VerifiedIcon />}
                      </div>
                      <div className="fd-degree">{doc.degree ?? ""}</div>
                      <div className="fd-meta">
                        <span className="fd-rating">
                          <StarIcon /> {doc.rating ?? "N/A"}
                        </span>
                        <span className="fd-dot">·</span>
                        <span className="fd-exp">
                          {doc.experience ?? 0} yrs exp
                        </span>
                      </div>
                    </div>

                    {/* Center Details */}
                    <div className="fd-card-center">
                      <div className="fd-spec-tag">
                        {doc.specialty ?? "General"}
                      </div>
                      <div className="fd-langs">
                        {langs.slice(0, 3).join(" · ")}
                        {langs.length > 3 ? ` +${langs.length - 3}` : ""}
                      </div>
                      <div className="fd-loc">
                        <LocationIcon />{" "}
                        {doc.location ?? "Location not specified"}
                      </div>
                    </div>

                    {/* Price Section */}
                    <div className="fd-price-section">
                      <div className="fd-price-row">
                        <span className="fd-price">
                          {formatPrice(price, doc.feeCurrency || "USD")}
                        </span>
                        <button
                          className="fd-heart"
                          onClick={() => toggleFavorite(doc.id)}
                        >
                          <HeartIcon filled={favorites[doc.id]} />
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="fd-card-actions">
                      <button
                        className="fd-book-btn"
                        onClick={() => handleBook(doc)}
                      >
                        Book Appointment
                      </button>
                      <button className="fd-profile-link" onClick={() => navigate(`/doctor/${doc.id}`)}>
                        View Profile →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="fd-pagination">
              <button
                className="fd-page-btn fd-nav-btn"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft /> Prev
              </button>
              {pageNumbers().map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="fd-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    className={`fd-page-btn${currentPage === p ? " active" : ""}`}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                className="fd-page-btn fd-nav-btn"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next <ChevronRight />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
