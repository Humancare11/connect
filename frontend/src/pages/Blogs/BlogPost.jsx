import { lazy, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { fetchBlog, blogImageSrc } from "../../api/blogApi";
import BlogArticle from "./BlogArticle";
import { usableFaqs, faqAnswerText } from "../../utils/blogContent";
import { usePrerendered } from "../../seo/prerenderData";
import { setPageHints } from "../../utils/bookingSource";
import { DEFAULT_OG_IMAGE } from "../../seo/routes";

const NotFound = lazy(() => import("../../components/NotFound"));

const SITE_ORIGIN = "https://humancareconnect.co";
const DEFAULT_OG_IMAGE_URL = SITE_ORIGIN + DEFAULT_OG_IMAGE;

// Route for blogs created in the Super Admin panel (/:slug). Registered after
// every static route, so the hand-built articles keep their own pages; unknown
// or unpublished slugs fall through to the 404 page.
export default function BlogPost() {
  const { slug } = useParams();
  // Posts fetched at build time (scripts/prerender.mjs) are already in the prerendered HTML; start
  // from the same data so hydration matches, then refresh from the API below.
  const prerendered = usePrerendered(`blog:${slug}`);
  const [result, setResult] = useState(() =>
    prerendered ? { slug, status: "ready", blog: prerendered } : { slug: null, status: "loading", blog: null }
  );

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchBlog(slug, controller.signal)
      .then((blog) => setResult(blog && typeof blog === "object" ? { slug, status: "ready", blog } : { slug, status: "notfound", blog: null }))
      .catch((err) => {
        if (controller.signal.aborted || err?.code === "ERR_CANCELED") return;
        // A transient failure must not replace content that is already on screen.
        if (prerendered && err?.response?.status !== 404) return;
        setResult({ slug, status: err?.response?.status === 404 ? "notfound" : "error", blog: null });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, attempt]);

  // A result for a previous slug counts as "still loading".
  const state = result.slug === slug ? result : { status: "loading", blog: null };

  // Tell the booking source this page's title, so "Blog: <title>" is recorded if a booking starts here.
  const blogTitle = state.status === "ready" && !state.blog?.isLegacy ? state.blog?.title : "";
  useEffect(() => {
    if (blogTitle) setPageHints(`/${slug}`, { blogTitle });
  }, [slug, blogTitle]);

  if (state.status === "notfound") return <NotFound />;
  if (state.status === "error") {
    return (
      <div className="blog-page" style={{ padding: "120px 20px", textAlign: "center" }} role="alert">
        <h1 style={{ fontSize: "1.5rem" }}>We couldn't load this page</h1>
        <p>Something went wrong while loading this page. Please check your connection and try again.</p>
        <p>
          <button
            type="button"
            onClick={() => {
              setResult({ slug: null, status: "loading", blog: null });
              setAttempt((n) => n + 1);
            }}
          >
            Retry
          </button>{" "}
          <Link to="/">Go to Home</Link>
        </p>
      </div>
    );
  }
  if (state.status === "loading") {
    return (
      <div
        className="blog-page"
        style={{ minHeight: "60vh", padding: "120px 20px", textAlign: "center" }}
        role="status"
        aria-busy="true"
      >
        <p>Loading…</p>
      </div>
    );
  }

  const { blog } = state;
  // Legacy articles are rendered by their own page components; they have no body here.
  if (blog.isLegacy) return <NotFound />;
  const title = blog.metaTitle || blog.title;
  const description = blog.metaDescription || blog.description;
  const url = `${SITE_ORIGIN}/${blog.slug}`;
  const image = blog.image ? blogImageSrc(blog.image) : "";
  const articleJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: image || DEFAULT_OG_IMAGE_URL,
    datePublished: blog.publishedAt || undefined,
    mainEntityOfPage: url,
    publisher: { "@type": "Organization", name: "Humancare Connect", logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/single-logo.png` } },
  }).replace(/</g, "\\u003c");

  const faqs = usableFaqs(blog.faqs);
  // "\\u003c" is escaped so the JSON can never close the script tag.
  const faqJsonLd = faqs.length
    ? JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: String(f.question).trim(),
          acceptedAnswer: { "@type": "Answer", text: faqAnswerText(f.answer) },
        })),
      }).replace(/</g, "\u003c")
    : "";

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={image || DEFAULT_OG_IMAGE_URL} />
        <meta property="og:site_name" content="Humancare Connect" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {image && <meta name="twitter:image" content={image} />}
        {faqJsonLd && <script type="application/ld+json">{faqJsonLd}</script>}
      </Helmet>
      <BlogArticle
        blog={{
          title: blog.title,
          coverImage: blog.image,
          category: blog.category,
          tags: blog.tags,
          publishedAt: blog.publishedAt,
          readTime: blog.readTime,
          content: blog.content,
          faqs: blog.faqs,
        }}
      />
    </>
  );
}
