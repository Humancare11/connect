import { useState, useMemo } from "react";
import "./Blogs.css";

const blogs = [
  {
    id: 1,
    title: "Understanding Preventive Healthcare in 2025",
    description:
      "Discover how routine screenings and lifestyle adjustments can dramatically reduce the risk of chronic illnesses before they develop.",
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80",
    category: "Preventive Care",
    readTime: 5,
    date: "Jun 12, 2025",
  },
  {
    id: 2,
    title: "The Science Behind a Heart-Healthy Diet",
    description:
      "Cardiologists break down the foods, habits, and nutrients that keep your cardiovascular system performing at its best for decades.",
    image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80",
    category: "Nutrition",
    readTime: 7,
    date: "Jun 8, 2025",
  },
  {
    id: 3,
    title: "Mental Health at Work: Breaking the Stigma",
    description:
      "Workplace stress and burnout are at record highs. Learn evidence-based strategies to protect your mental wellbeing on the job.",
    image: "https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=600&q=80",
    category: "Mental Health",
    readTime: 6,
    date: "Jun 5, 2025",
  },
  {
    id: 4,
    title: "Children's Vaccinations: What Every Parent Should Know",
    description:
      "A comprehensive guide to the immunisation schedule, addressing common concerns and helping parents make informed decisions.",
    image: "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=600&q=80",
    category: "Paediatrics",
    readTime: 8,
    date: "May 30, 2025",
  },
  {
    id: 5,
    title: "Diabetes Management: New Approaches for 2025",
    description:
      "From continuous glucose monitors to personalised nutrition plans, explore the latest tools helping diabetics live fuller lives.",
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&q=80",
    category: "Chronic Care",
    readTime: 9,
    date: "May 25, 2025",
  },
  {
    id: 6,
    title: "Sleep Hygiene: The Forgotten Pillar of Good Health",
    description:
      "Quality sleep is as crucial as diet and exercise. Experts share practical steps to fix your sleep cycle and wake up restored.",
    image: "https://images.unsplash.com/photo-1541480601022-2308c0f02487?w=600&q=80",
    category: "Wellness",
    readTime: 5,
    date: "May 20, 2025",
  },
  {
    id: 7,
    title: "Gut Health and Immunity: What Research Reveals",
    description:
      "The gut-brain axis is reshaping how doctors treat everything from anxiety to autoimmune conditions. Here is what you need to know.",
    image: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=600&q=80",
    category: "Nutrition",
    readTime: 6,
    date: "May 15, 2025",
  },
  {
    id: 8,
    title: "Telehealth in India: A New Era of Patient Care",
    description:
      "How digital consultations are closing the healthcare access gap across tier-2 and tier-3 cities, saving time and improving outcomes.",
    image: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&q=80",
    category: "Digital Health",
    readTime: 7,
    date: "May 10, 2025",
  },
  {
    id: 9,
    title: "Managing Hypertension Naturally",
    description:
      "Beyond medication — lifestyle, mindfulness, and dietary changes that can help bring blood pressure under control sustainably.",
    image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&q=80",
    category: "Chronic Care",
    readTime: 5,
    date: "May 5, 2025",
  },
];

const CARDS_PER_PAGE = 9;

const categoryColors = {
  "Preventive Care": { bg: "#E6F5F3", text: "#0C8B7A" },
  Nutrition:         { bg: "#FEF3E2", text: "#C97B1A" },
  "Mental Health":   { bg: "#EEF2FF", text: "#4F46E5" },
  Paediatrics:       { bg: "#FFF0F6", text: "#C2185B" },
  "Chronic Care":    { bg: "#F0FDF4", text: "#16A34A" },
  Wellness:          { bg: "#F0F9FF", text: "#0284C7" },
  "Digital Health":  { bg: "#F5F3FF", text: "#7C3AED" },
};

const ALL_CATEGORIES = ["All", ...Object.keys(categoryColors)];

// const stats = [
//   { value: "50+", label: "Expert Authors" },
//   { value: "200+", label: "Articles Published" },
//   { value: "1M+", label: "Monthly Readers" },
// ];

export default function BlogPage() {
  const [currentPage, setCurrentPage]     = useState(1);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery]     = useState("");

  const filtered = useMemo(() => {
    return blogs.filter((b) => {
      const matchCat   = activeCategory === "All" || b.category === activeCategory;
      const matchSearch =
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  const totalPages  = Math.ceil(filtered.length / CARDS_PER_PAGE);
  const start       = (currentPage - 1) * CARDS_PER_PAGE;
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
    document.getElementById("blog-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
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
                onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                aria-label="Clear search"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Stats row */}
          {/* <div className="hero-stats">
            {stats.map((s) => (
              <div className="hero-stat" key={s.label}>
                <span className="stat-value">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div> */}
        </div>

        {/* Decorative blobs */}
        <div className="hero-blob hero-blob--1" aria-hidden="true" />
        <div className="hero-blob hero-blob--2" aria-hidden="true" />
      </section>

      {/* ── CATEGORY FILTER ── */}
      <div className="filter-bar">
        <div className="filter-bar-inner">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-btn${activeCategory === cat ? " filter-btn--active" : ""}`}
              onClick={() => handleCategoryChange(cat)}
              style={
                activeCategory === cat && cat !== "All" && categoryColors[cat]
                  ? { background: categoryColors[cat].bg, color: categoryColors[cat].text, borderColor: categoryColors[cat].text + "44" }
                  : {}
              }
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

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
              const color = categoryColors[blog.category] || { bg: "#F4F7FB", text: "#223A5E" };
              return (
                <article className="blog-card" key={blog.id}>
                  <div className="card-img-wrap">
                    <img src={blog.image} alt={blog.title} className="card-img" loading="lazy" />
                    <span
                      className="card-category"
                      style={{ background: color.bg, color: color.text }}
                    >
                      {blog.category}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="card-meta">
                      <span className="meta-date">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                        </svg>
                        {blog.date}
                      </span>
                      {/* <span className="meta-read">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" strokeLinecap="round" />
                        </svg>
                        {blog.readTime} min read
                      </span> */}
                    </div>
                    <h3 className="card-title">{blog.title}</h3>
                    <p className="card-desc">{blog.description}</p>
                    {/* <button type="button" className="card-btn">
                      Read More
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button> */}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
            </div>
            <h3>No articles found</h3>
            <p>Try a different search term or category.</p>
            <button
              type="button"
              className="card-btn"
              onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Pagination — only shown when results span multiple pages */}
        {totalPages > 1 && (
          <div className="pagination" role="navigation" aria-label="Article pagination">
            <button
              type="button"
              className="page-btn nav-btn"
              onClick={() => goTo(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </section>

      {/* ── NEWSLETTER STRIP ── */}
      {/* <section className="newsletter-strip">
        <div className="newsletter-inner">
          <div className="newsletter-text">
            <h3>Get weekly health insights</h3>
            <p>No spam, just curated articles delivered to your inbox.</p>
          </div>
          <div className="newsletter-form">
            <input
              type="email"
              placeholder="Your email address"
              className="newsletter-input"
              aria-label="Email address for newsletter"
            />
            <button type="button" className="newsletter-btn">Subscribe</button>
          </div>
        </div>
      </section> */}
    </div>
  );
}