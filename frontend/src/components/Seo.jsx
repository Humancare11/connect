// components/Seo.jsx
//
// Head tags for a page. Everything comes from the central map in src/seo/routes.js, resolved
// from the current pathname (self-referencing canonical, robots, title, description, JSON-LD).
// Props are overrides only: pass one when a page genuinely differs from its map entry.
//
// One emitter per route: on React 19 react-helmet-async renders real elements and does NOT
// de-duplicate, so two emitters for the same route would produce duplicate tags.
//   - indexable route   -> the page's own <SEO/> (default export below)
//   - non-public route  -> <RouteSeo/> only (default export renders nothing there)
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { getRouteSeo, SITE_ORIGIN, SITE_NAME, DEFAULT_OG_IMAGE } from "../seo/routes";
import { buildSchema, schemaScriptContent } from "../seo/schema";

const ROBOTS_INDEX = "index, follow, max-image-preview:large";
const ROBOTS_NOINDEX = "noindex, nofollow";

const absolute = (url) => (url && !/^https?:\/\//i.test(url) ? SITE_ORIGIN + url : url);

export function SeoTags({ title, description, robots, image, type = "website", schemaData }) {
  const { pathname } = useLocation();
  const { path, entry, noindex: routeNoindex, canonical } = getRouteSeo(pathname);

  const noindex = routeNoindex || /noindex/i.test(robots || "");
  const finalTitle = title ?? entry?.title;
  const finalDescription = description ?? entry?.description;
  const finalImage = absolute(image || DEFAULT_OG_IMAGE);
  const usingDefaultImage = !image;

  let jsonLd = null;
  if (!noindex) {
    const nodes = schemaData
      ? [].concat(schemaData)
      : buildSchema({
          path,
          canonical,
          title: finalTitle,
          description: finalDescription,
          image: finalImage,
          types: entry?.schema,
        });
    jsonLd = schemaScriptContent(nodes);
  }

  return (
    <Helmet>
      {finalTitle && <title>{finalTitle}</title>}
      {finalDescription && <meta name="description" content={finalDescription} />}
      <meta name="robots" content={noindex ? ROBOTS_NOINDEX : ROBOTS_INDEX} />
      {!noindex && canonical && <link rel="canonical" href={canonical} />}

      {!noindex && <meta property="og:type" content={type} />}
      {!noindex && <meta property="og:locale" content="en_US" />}
      {!noindex && <meta property="og:site_name" content={SITE_NAME} />}
      {!noindex && finalTitle && <meta property="og:title" content={finalTitle} />}
      {!noindex && finalDescription && (
        <meta property="og:description" content={finalDescription} />
      )}
      {!noindex && canonical && <meta property="og:url" content={canonical} />}
      {!noindex && <meta property="og:image" content={finalImage} />}
      {!noindex && usingDefaultImage && <meta property="og:image:width" content="1200" />}
      {!noindex && usingDefaultImage && <meta property="og:image:height" content="630" />}

      {!noindex && <meta name="twitter:card" content="summary_large_image" />}
      {!noindex && finalTitle && <meta name="twitter:title" content={finalTitle} />}
      {!noindex && finalDescription && (
        <meta name="twitter:description" content={finalDescription} />
      )}
      {!noindex && <meta name="twitter:image" content={finalImage} />}

      {jsonLd && <script type="application/ld+json">{jsonLd}</script>}
    </Helmet>
  );
}

const SEO = (props) => {
  const { pathname } = useLocation();
  if (getRouteSeo(pathname).noindex) return null; // <RouteSeo/> owns non-public routes
  return <SeoTags {...props} />;
};

export default SEO;
