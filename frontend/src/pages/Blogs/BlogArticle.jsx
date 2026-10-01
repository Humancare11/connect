import { useEffect, useMemo, useState } from "react";
import "./telemedicine.css";
import "./BlogArticle.css";
import { blogImageSrc } from "../../api/blogApi";
import { prepareBlogHtml, formatBlogDate } from "../../utils/blogContent";

// Generic article template for blogs created in the Super Admin panel. It reuses
// the existing article classes from telemedicine.css (hero, progress bar, sticky
// TOC, mobile TOC, content column) and renders ONLY the editor content: no FAQ,
// comparison or other special boxes.
//
// `preview` is used by the admin form: the sticky bars are pinned to the top of
// the preview overlay instead of below the site header.
export default function BlogArticle({ blog, preview = false }) {
  const [scrollPct, setScrollPct] = useState(0);
  const [activeSection, setActiveSection] = useState("");

  const { html, toc } = useMemo(() => prepareBlogHtml(blog.content), [blog.content]);
  const date = formatBlogDate(blog.publishedAt);
  // In the admin preview the overlay has its own 52px header bar.
  const stickyTop = preview ? { top: 52 } : undefined;
  const stickyMetaTop = preview ? { top: 56 } : undefined;

  // Reading progress (same behaviour as the existing article pages).
  useEffect(() => {
    const scroller = preview ? document.getElementById("blog-preview-scroll") : document;
    const target = preview ? scroller : window;
    if (!scroller) return undefined;
    function onScroll() {
      const scrollTop = preview ? scroller.scrollTop : window.scrollY;
      const height = preview
        ? scroller.scrollHeight - scroller.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const pct = height > 0 ? Math.min(100, Math.max(0, (scrollTop / height) * 100)) : 0;
      setScrollPct(Math.round(pct));
    }
    target.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => target.removeEventListener("scroll", onScroll);
  }, [preview, html]);

  // TOC scrollspy over the h2 headings.
  useEffect(() => {
    if (!toc.length) return undefined;
    const headings = toc.map((item) => document.getElementById(item.id)).filter(Boolean);
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-140px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => spy.observe(h));
    return () => spy.disconnect();
  }, [toc]);

  // Smooth in-page jump that also works inside the preview overlay.
  function jumpTo(event, id) {
    const el = document.getElementById(id);
    if (!el) return;
    event.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
    if (!preview && window.history?.replaceState) window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="blog-page">
      <div className="progress-rail" aria-hidden="true" style={stickyTop}>
        <div className="progress-fill" style={{ width: `${scrollPct}%` }} />
      </div>
      <div className="progress-meta" style={stickyMetaTop}>
        <div className="wrap">
          {blog.readTime ? (
            <span>
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>{blog.readTime} min read</span>
            </span>
          ) : null}
          {date ? (
            <span>
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>{date}</span>
            </span>
          ) : null}
          <span>
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3v18M4 12l8-8 8 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                transform="rotate(90 12 12)"
              />
            </svg>
            <span>{scrollPct}% read</span>
          </span>
        </div>
      </div>

      <main id="main-content">
        <div className="wrap">
          <section className="hero">
            <div className="hero-top">
              {blog.category ? (
                <div className="badge-row">
                  <span className="badge">{blog.category}</span>
                </div>
              ) : null}
              <h1 className="article-title">{blog.title}</h1>
            </div>

            {blog.coverImage ? (
              <figure className="hero-media">
                <img src={blogImageSrc(blog.coverImage)} alt={blog.title} loading="eager" />
              </figure>
            ) : null}
          </section>

          <div className="article-layout">
            {/* Desktop sticky TOC. The (possibly empty) aside always renders so the
                content keeps its grid column when a post has no h2 headings. */}
            <aside className="toc-col" aria-label="Table of contents">
              {toc.length > 0 && (
                <nav className="toc-card">
                  <h2>In this guide</h2>
                  <ol>
                    {toc.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className={activeSection === item.id ? "active" : ""}
                          onClick={(e) => jumpTo(e, item.id)}
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
            </aside>

            {/* Mobile collapsible TOC */}
            {toc.length > 0 && (
              <details className="toc-mobile">
                <summary className="toc-mobile-summary">
                  Jump to a section
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </summary>
                <ol className="toc-mobile-list">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} onClick={(e) => jumpTo(e, item.id)}>
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            )}

            <article className="content-col blog-richtext" id="articleBody" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </main>
    </div>
  );
}
