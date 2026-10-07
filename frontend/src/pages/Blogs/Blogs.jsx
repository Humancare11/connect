import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./Blogs.css";
import SEO from "../../components/Seo";
import { fetchBlogs, blogImageSrc } from "../../api/blogApi";

import heroBg from "../../assets/BannerImages/blog-banner.webp";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [data, setData] = useState({ blogs: [], page: 1, total: 0, totalPages: 1 });
  const [loadedKey, setLoadedKey] = useState(null);

  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const rawPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Blogs come from the API (published posts only); search and pagination are
  // done server-side.
  const requestKey = `${rawPage}|${debouncedSearch}|${activeCategory}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    fetchBlogs(
      {
        page: rawPage,
        limit: CARDS_PER_PAGE,
        search: debouncedSearch,
        category: activeCategory === "All" ? "" : activeCategory,
      },
      controller.signal,
    )
      .then((res) => {
        setData(res);
        setLoadedKey(requestKey);
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.code === "ERR_CANCELED") return;
        console.error("Failed to load blogs:", err);
        setData({ blogs: [], page: 1, total: 0, totalPages: 1 });
        setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [requestKey, rawPage, debouncedSearch, activeCategory]);

  // Same card shape as before. Category is intentionally not mapped: the list
  // cards do not show a category badge (it appears on the article page only).
  const visibleBlogs = data.blogs.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    image: blogImageSrc(b.image),
    path: b.path,
  }));
  const totalPages = Math.max(1, data.totalPages);
  const currentPage = Math.min(rawPage, totalPages);

  useEffect(() => {
    if (currentPage > 1) {
      const timer = setTimeout(() => {
        document
          .getElementById("blog-grid")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentPage]);

  // eslint-disable-next-line no-unused-vars
  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    if (searchParams.has("page")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("page");
      setSearchParams(nextParams, { replace: true });
    }
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    if (searchParams.has("page")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("page");
      setSearchParams(nextParams, { replace: true });
    }
  };

  const goTo = (page) => {
    if (page < 1 || page > totalPages) return;
    const nextParams = new URLSearchParams(searchParams);
    if (page === 1) {
      nextParams.delete("page");
    } else {
      nextParams.set("page", String(page));
    }
    setSearchParams(nextParams);
    document
      .getElementById("blog-grid")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <SEO />
      <div className="blog-page">
        {/* ── HERO ── */}
        <section>
          <div
            className="corp-hero"
            style={{
              backgroundImage: `
                linear-gradient(
                  rgba(51, 71, 121, 0.75),
                  rgba(0, 0, 0, 0.75)
                ),
                url(${heroBg})
              `,
            }}
          >
            <div className="corp-hero-inner">
              <h1>Stay Informed. Stay Healthy.</h1>
              <p>
                Explore expert guidance, practical wellness tips, and trusted
                healthcare information tailored to your everyday needs.
              </p>

              {/* Search bar */}
              <div className="hero-search" style={{ marginTop: "20px" }}>
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
                      if (searchParams.has("page")) {
                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.delete("page");
                        setSearchParams(nextParams, { replace: true });
                      }
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
          </div>
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
              {!debouncedSearch && activeCategory === "All"
                ? "Stay informed with our most recent health guides"
                : `${data.total} article${data.total !== 1 ? "s" : ""} found`}
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
                    state={{ fromPage: currentPage }}
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
                        <h3 className="card-title">{blog.title}</h3>
                        <p className="card-desc">{blog.description}</p>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          ) : loading ? null : (
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
                  if (searchParams.has("page")) {
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.delete("page");
                    setSearchParams(nextParams, { replace: true });
                  }
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
    </>
  );
}
