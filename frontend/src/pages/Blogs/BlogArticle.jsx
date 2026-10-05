import { useEffect, useMemo, useRef, useState } from "react";
import "./telemedicine.css";
import "./BlogArticle.css";
import { blogImageSrc } from "../../api/blogApi";
import { prepareBlogHtml, formatBlogDate, prepareFaqAnswer, usableFaqs } from "../../utils/blogContent";

// Generic article template for blogs created in the Super Admin panel. It reuses
// the existing article classes from telemedicine.css (hero, progress bar, sticky
// TOC, mobile TOC, content column) and renders the editor content plus an
// optional FAQ accordion (same markup and classes as the legacy pages). No
// comparison or other special boxes.
//
// `preview` is used by the admin form: the sticky bars are pinned to the top of
// the preview overlay instead of below the site header.
export default function BlogArticle({ blog, preview = false }) {
  const [scrollPct, setScrollPct] = useState(0);
  const [activeSection, setActiveSection] = useState("");
  const tocCardRef = useRef(null);

  const [openFaq, setOpenFaq] = useState(null);

  const { html, toc: headingToc } = useMemo(() => prepareBlogHtml(blog.content), [blog.content]);
  const faqs = useMemo(() => usableFaqs(blog.faqs), [blog.faqs]);
  // "FAQs" goes last in the TOC, like the legacy pages.
  const toc = useMemo(
    () => (faqs.length ? [...headingToc, { id: "faq", label: "FAQs" }] : headingToc),
    [headingToc, faqs.length],
  );
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

  // TOC scrollspy: the active section is the last h2 whose top has reached the
  // reading line (just under the sticky bars). Position-based rather than an
  // IntersectionObserver on the (short) headings, so something is always
  // highlighted while scrolling, including fast wheel / Lenis scrolling.
  useEffect(() => {
    if (!toc.length) return undefined;
    const scroller = preview ? document.getElementById("blog-preview-scroll") : window;
    if (!scroller) return undefined;
    const READING_LINE = 151; // matches the 150px scroll-margin used by the jump links
    let frame = 0;

    const update = () => {
      frame = 0;
      const base = preview ? scroller.getBoundingClientRect().top : 0;
      const atBottom = preview
        ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
        : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      let current = toc[0].id;
      for (const item of toc) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - base <= READING_LINE) current = item.id;
        else break;
      }
      if (atBottom) current = toc[toc.length - 1].id;
      setActiveSection(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [toc, preview]);

  // Keep the active item visible inside the TOC card. Only the card scrolls
  // (element.scrollBy), never the page.
  useEffect(() => {
    const card = tocCardRef.current;
    const link = card?.querySelector("a.active");
    if (!card || !link) return;
    const pad = 12;
    const c = card.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    if (l.top < c.top + pad) card.scrollBy({ top: l.top - c.top - pad, behavior: "smooth" });
    else if (l.bottom > c.bottom - pad) card.scrollBy({ top: l.bottom - c.bottom + pad, behavior: "smooth" });
  }, [activeSection]);

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
          <section className="hero blog-hero">
            <div className="hero-top">
              {/* Always rendered, like the legacy pages: the row's margins create
                  the space between the reading strip and the title. */}
              <div className="badge-row">
                {blog.category ? <span className="badge">{blog.category}</span> : null}
                {blog.tags?.[0] ? <span className="badge outline">{blog.tags[0]}</span> : null}
              </div>
              <h1 className="article-title">{blog.title}</h1>
            </div>

            {blog.coverImage ? (
              <figure className="hero-media">
                <img src={blogImageSrc(blog.coverImage)} alt={blog.title} loading="eager" />
              </figure>
            ) : null}
          </section>

          <div className="article-layout blog-layout">
            {/* Desktop sticky TOC. The (possibly empty) aside always renders so the
                content keeps its grid column when a post has no h2 headings. */}
            <aside className="toc-col" aria-label="Table of contents">
              {toc.length > 0 && (
                <nav className="toc-card" ref={tocCardRef} data-lenis-prevent>
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

            <article className="content-col blog-richtext">
              <div id="articleBody" dangerouslySetInnerHTML={{ __html: html }} />

              {faqs.length > 0 && (
                <section id="faq" className="faq-section">
                  <h2>Frequently asked questions</h2>
                  {faqs.map((item, idx) => (
                    <details
                      key={`${idx}-${item.question}`}
                      className="faq-item"
                      open={openFaq === idx}
                      onToggle={(e) => setOpenFaq(e.currentTarget.open ? idx : null)}
                    >
                      <summary className="faq-q">
                        {item.question}
                        <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <div className="faq-a" dangerouslySetInnerHTML={{ __html: prepareFaqAnswer(item.answer) }} />
                    </details>
                  ))}
                </section>
              )}
            </article>
          </div>
        </div>
      </main>
    </div>
  );
}
