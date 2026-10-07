import { lazy, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { fetchBlog, blogImageSrc } from "../../api/blogApi";
import BlogArticle from "./BlogArticle";
import { usePrerendered } from "../../seo/prerenderData";

// Blogs without a cover image fall back to the site-wide 1200x630 preview.
const DEFAULT_OG_IMAGE_URL = "https://humancareconnect.co/og-default.jpg";

const NotFound = lazy(() => import("../../components/NotFound"));

const SITE_ORIGIN = "https://humancareconnect.co";

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

  useEffect(() => {
    const controller = new AbortController();
    fetchBlog(slug, controller.signal)
      .then((blog) => setResult({ slug, status: "ready", blog }))
      .catch((err) => {
        if (controller.signal.aborted || err?.code === "ERR_CANCELED") return;
        // A transient failure must not replace content that is already on screen.
        if (prerendered && err?.response?.status !== 404) return;
        setResult({ slug, status: err?.response?.status === 404 ? "notfound" : "error", blog: null });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // A result for a previous slug counts as "still loading".
  const state = result.slug === slug ? result : { status: "loading", blog: null };

  if (state.status === "notfound") return <NotFound />;
  if (state.status === "error") {
    return (
      <div className="blog-page" style={{ padding: "120px 20px", textAlign: "center" }}>
        <p>This article could not be loaded right now. Please try again.</p>
      </div>
    );
  }
  if (state.status === "loading") {
    return <div className="blog-page" style={{ minHeight: "60vh" }} aria-busy="true" />;
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
        <meta name="twitter:image" content={image || DEFAULT_OG_IMAGE_URL} />
        <script type="application/ld+json">{articleJsonLd}</script>
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
        }}
      />
    </>
  );
}
