import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import "./Blogs.css";
import bestTelemedicineProvider from "../../assets/BlogImages/best-telemedicine-provider.webp";
import doctorConsultation from "../../assets/BlogImages/doctor-consultation.webp";
import futureOfTelemedicine from "../../assets/BlogImages/future-of-telemedicine.webp";
import medicalConditions from "../../assets/BlogImages/medical-conditions.webp";
import realDoctors from "../../assets/BlogImages/real-doctors.webp";
import telemedicineAppointment from "../../assets/BlogImages/telemedicine-appointment.webp";
import telemedicineCost from "../../assets/BlogImages/telemedicine-cost.webp";
import telemedicineSafe from "../../assets/BlogImages/telemedicine-safe.webp";
import telemedicineServices from "../../assets/BlogImages/telemedicine-services.webp";
import telemedicineVsInPersonDoctorVisits from "../../assets/BlogImages/telemedicine-vs-in-person-doctor-visits.webp";
import telemedicine from "../../assets/BlogImages/telemedicine.webp";
import topTelemedicinePlatforms from "../../assets/BlogImages/top-telemedicine-platforms.webp";

const blogs = [
  {
    id: 1,
    title:
      "What Is Telemedicine? Complete Guide to Meaning, Benefits, Types & How It Works",
    description:
      "Telemedicine refers to the delivery of healthcare services remotely through digital technologies, including video consultations, phone calls, mobile applications, and secure online platforms. It enables the patients to get the consultation of doctors and healthcare professionals without visiting the hospital or a clinic physically.",
    image: telemedicine,
    path: "/what-is-telemedicine",
    readTime: 5,
  },
  {
    id: 2,
    title:
      "Telemedicine Services: Everything You Need to Know About Virtual Healthcare",
    description:
      "Telemedicine services are healthcare services provided remotely using digital technologies such as video consultations, phone calls, secure messaging, and online healthcare platforms",
    image: telemedicineServices,
    path: "/top-telemedicine-platforms-providers",
  },
  {
    id: 3,
    title:
      "How Does a Telemedicine Appointment Work? A Complete Step-by-Step Guide",
    description:
      "The future of telemedicine involves a combination of artificial intelligence, remote patient monitoring, wearable health technology, improved digital platforms, and more personalized virtual healthcare experiences. ",
    image: telemedicineAppointment,
    path: "/future-of-telemedicine",
  },
  {
    id: 4,
    title:
      "Online Doctor Consultation: Benefits, Process & When to Choose Virtual Care",
    description:
      "An online doctor consultation is a virtual healthcare appointment where patients connect with doctors or specialists through video calls, phone calls, or secure digital platforms. It allows patients to discuss symptoms, share medical reports, receive professional medical guidance, and understand the next steps in their care without visiting a clinic or hospital in person.",
    image: doctorConsultation,
    path: "/online-doctor-consultation",
  },
  {
    id: 5,
    title:
      "What Medical Conditions Can Be Treated Through Telemedicine? Complete List",
    description:
      "Telemedicine can help manage many non-emergency health concerns, including common illnesses, chronic disease follow-ups, skin conditions, mental health concerns, medication reviews, specialist consultations, and medical second opinions.",
    image: medicalConditions,
    path: "/conditions-treated-through-telemedicine",
  },
  {
    id: 6,
    title:
      "How to Choose the Best Telemedicine Provider: 10 Important Factors to Consider",
    description:
      "The best telemedicine provider should offer qualified healthcare professionals, multiple medical specialties, secure technology, transparent pricing, convenient appointment scheduling, and reliable patient support. Patients should also consider privacy standards, ease of use, availability of second opinions, and the provider's overall healthcare approach before making a decision.",
    image: bestTelemedicineProvider,
    path: "/top-telemedicine-platforms-providers",
  },
  {
    id: 7,
    title:
      "Top Telemedicine Platforms & Providers: Features, Benefits & How to Choose",
    description:
      "The best telemedicine platforms provide access to qualified healthcare professionals, multiple medical specialties, secure technology, easy appointment scheduling, transparent communication, and reliable patient support.",
    image: topTelemedicinePlatforms,
    path: "/top-telemedicine-platforms-providers",
  },
  {
    id: 8,
    title:
      "Is Telemedicine Safe? A Complete Guide to Privacy, Security & Trust",
    description:
      "Yes, telemedicine can be a safe and secure way to receive healthcare when provided through reputable healthcare organizations using appropriate security practices and following applicable privacy and healthcare regulations.",
    image: telemedicineSafe,
    path: "/is-telemedicine-safe",
  },
  {
    id: 9,
    title:
      "Telemedicine vs In-Person Doctor Visits: Benefits, Differences & Limitations",
    description:
      "Telemedicine and in-person doctor visits each have unique advantages. Telemedicine provides convenience, faster access to healthcare professionals, easier follow-up care, and access to specialists without travel. In-person visits are essential for physical examinations, emergency treatment, diagnostic procedures, and complex medical situations requiring direct evaluation.",
    image: telemedicineVsInPersonDoctorVisits,
    path: "/telemedicine-vs-in-person-doctor-visits",
  },

  // ── PAGE 2 PLACEHOLDER ENTRIES ──
  // Replace these with your real articles once you have more content.
  // They exist so Next/Prev actually pages through a second set of 9 cards.
  // Delete this block once real posts replace them.
  {
    id: 10,
    title: "The Cost of Telemedicine: What You Should Know Before Booking",
    description:
      "Understanding telemedicine pricing, insurance coverage, and what to expect when comparing virtual care costs against traditional in-person visits.",
    image: telemedicineCost,
    path: "/telemedicine-cost",
    readTime: 6,
  },
  {
    id: 11,
    title: "Meet the Real Doctors Behind Virtual Healthcare",
    description:
      "A look at the licensed physicians and healthcare professionals who provide consultations through telemedicine platforms, and how their credentials are verified.",
    image: realDoctors,
    path: "/real-doctors",
    readTime: 6,
  },
  {
    id: 12,
    title: "The Future of Telemedicine: Trends Shaping Virtual Care",
    description:
      "Artificial intelligence, remote monitoring, and wearable technology are reshaping how patients and doctors connect. Here's what's coming next.",
    image: futureOfTelemedicine,
    path: "/future-of-telemedicine",
    readTime: 7,
  },
  // {
  //   id: 13,
  //   title: "What Is Telemedicine? A Refresher on the Basics",
  //   description:
  //     "A quick refresher on how telemedicine works, who it's for, and why more patients are choosing virtual care every year.",
  //   image: telemedicine,
  //   path: "/what-is-telemedicine",
  //   readTime: 4,
  // },
  // {
  //   id: 14,
  //   title: "Telemedicine Services Explained for First-Time Users",
  //   description:
  //     "New to virtual healthcare? Here's a plain-language walkthrough of what telemedicine services include and how to get started.",
  //   image: telemedicineServices,
  //   path: "/top-telemedicine-platforms-providers",
  //   readTime: 5,
  // },
  // {
  //   id: 15,
  //   title: "How a Telemedicine Appointment Actually Works",
  //   description:
  //     "From booking to follow-up, here is exactly what happens during a typical telemedicine appointment, step by step.",
  //   image: telemedicineAppointment,
  //   path: "/future-of-telemedicine",
  //   readTime: 5,
  // },
  // {
  //   id: 16,
  //   title: "Choosing Between Virtual Care and an In-Person Doctor Visit",
  //   description:
  //     "Not every health concern is right for a video call. Here's how to decide whether telemedicine or an in-person visit is the better choice.",
  //   image: telemedicineVsInPersonDoctorVisits,
  //   path: "/telemedicine-vs-in-person-doctor-visits",
  //   readTime: 6,
  // },
  // {
  //   id: 17,
  //   title: "10 Factors That Make a Great Telemedicine Provider",
  //   description:
  //     "Qualified professionals, transparent pricing, and secure technology are just the start. Here's the full checklist for choosing a provider.",
  //   image: bestTelemedicineProvider,
  //   path: "/top-telemedicine-platforms-providers",
  //   readTime: 5,
  // },
  // {
  //   id: 18,
  //   title: "Privacy & Security in Telemedicine: What Patients Should Ask",
  //   description:
  //     "Questions to ask any telemedicine provider about how your health data is stored, shared, and protected.",
  //   image: telemedicineSafe,
  //   path: "/is-telemedicine-safe",
  //   readTime: 6,
  // },
];

const CARDS_PER_PAGE = 9;

const categoryColors = {
  "Preventive Care": { bg: "#E6F5F3", text: "#0C8B7A" },
  Nutrition: { bg: "#FEF3E2", text: "#C97B1A" },
  "Mental Health": { bg: "#EEF2FF", text: "#4F46E5" },
  Paediatrics: { bg: "#FFF0F6", text: "#C2185B" },
  "Chronic Care": { bg: "#F0FDF4", text: "#16A34A" },
  Wellness: { bg: "#F0F9FF", text: "#0284C7" },
  "Digital Health": { bg: "#F5F3FF", text: "#7C3AED" },
};

const ALL_CATEGORIES = ["All"];
// Full category list kept for later — uncomment to restore all filters:
// const ALL_CATEGORIES = ["All", ...Object.keys(categoryColors)];

export default function BlogPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return blogs.filter((b) => {
      const matchCat =
        activeCategory === "All" || b.category === activeCategory;
      const matchSearch =
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE));
  const start = (currentPage - 1) * CARDS_PER_PAGE;
  const visibleBlogs = filtered.slice(start, start + CARDS_PER_PAGE);

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setCurrentPage(1);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const goTo = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    document
      .getElementById("blog-grid")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="blog-page">
      {/* ── HERO ── */}
      <section className="blog-hero">
        <div className="blog-hero-inner">
          <span className="hero-eyebrow">Trusted Health Insights</span>
          <h1>Health & Medical Blogs</h1>
          <p>
            Stay informed with expert insights, health tips, and the latest
            medical updates — curated by professionals you can trust.
          </p>

          {/* Search bar */}
          <div className="hero-search">
            <svg
              className="search-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search articles…"
              value={searchQuery}
              onChange={handleSearch}
              className="hero-search-input"
              aria-label="Search articles"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                aria-label="Clear search"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Decorative blobs */}
        <div className="hero-blob hero-blob--1" aria-hidden="true" />
        <div className="hero-blob hero-blob--2" aria-hidden="true" />
      </section>

      {/* ── CATEGORY FILTER (only "All" shown for now — ALL_CATEGORIES limits this) ── */}
      {/* <div className="filter-bar">
        <div className="filter-bar-inner">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-btn${activeCategory === cat ? " filter-btn--active" : ""}`}
              onClick={() => handleCategoryChange(cat)}
              style={
                activeCategory === cat && cat !== "All" && categoryColors[cat]
                  ? {
                      background: categoryColors[cat].bg,
                      color: categoryColors[cat].text,
                      borderColor: categoryColors[cat].text + "44",
                    }
                  : {}
              }
            >
              {cat}
            </button>
          ))}
        </div>
      </div> */}

      {/* ── GRID SECTION ── */}
      <section className="blog-grid-section" id="blog-grid">
        <div className="section-header">
          <h2 className="section-title">Latest Articles</h2>
          <p className="section-sub">
            {filtered.length === blogs.length
              ? "Stay informed with our most recent health guides"
              : `${filtered.length} article${filtered.length !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {visibleBlogs.length > 0 ? (
          <div className="blog-grid">
            {visibleBlogs.map((blog) => {
              const color = categoryColors[blog.category] || {
                bg: "#F4F7FB",
                text: "#223A5E",
              };
              return (
                <Link
                  to={blog.path}
                  className="blog-card"
                  key={blog.id}
                  aria-label={blog.title}
                >
                  <article>
                    <div className="card-img-wrap">
                      <img
                        src={blog.image}
                        alt={blog.title}
                        className="card-img"
                        loading="lazy"
                      />
                      {blog.category && (
                        <span
                          className="card-category"
                          style={{ background: color.bg, color: color.text }}
                        >
                          {blog.category}
                        </span>
                      )}
                    </div>
                    <div className="card-body">
                      <div className="card-meta">
                        {blog.date && (
                          <span className="meta-date">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                            >
                              <rect x="3" y="4" width="18" height="18" rx="2" />
                              <path
                                d="M16 2v4M8 2v4M3 10h18"
                                strokeLinecap="round"
                              />
                            </svg>
                            {blog.date}
                          </span>
                        )}
                        <span className="meta-read">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" strokeLinecap="round" />
                          </svg>
                          {blog.readTime} min read
                        </span>
                      </div>
                      <h3 className="card-title">{blog.title}</h3>
                      <p className="card-desc">{blog.description}</p>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
            </div>
            <h3>No articles found</h3>
            <p>Try a different search term or category.</p>
            <button
              type="button"
              className="card-btn"
              onClick={() => {
                setSearchQuery("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Pagination — Prev / page numbers / Next, always visible at the bottom */}
        <div
          className="pagination"
          role="navigation"
          aria-label="Article pagination"
        >
          <button
            type="button"
            className="page-btn nav-btn"
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                d="M15 18l-6-6 6-6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              type="button"
              className={`page-btn num-btn${currentPage === page ? " active" : ""}`}
              onClick={() => goTo(page)}
              aria-label={`Page ${page}`}
              aria-current={currentPage === page ? "page" : undefined}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            className="page-btn nav-btn"
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            Next
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                d="M9 18l6-6-6-6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </section>
    </div>
  );
}
