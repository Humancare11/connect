// components/SEO.jsx
import { Helmet } from "react-helmet-async";

const SEO = ({ title, description, keywords, url, schemaType, schemaData }) => (
  <Helmet>
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta name="keywords" content={keywords} />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href={url} />

    {/* Open Graph */}
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="Humancare Connect" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={url} />
    <meta property="og:image" content="https://humancareconnect.co/Logo.png" />
    <meta property="og:image:width" content="250" />
    <meta property="og:image:height" content="250" />
    {/* single-logo.png is a square logo, not a proper 1200x630 banner —
        it works with twitter:card "summary" below but will look cramped
        on link previews. Swap in a dedicated 1200x630 image when one
        exists and switch twitter:card back to "summary_large_image". */}

    {/* Twitter */}
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content="https://humancareconnect.co/Logo.png" />

    <script type="application/ld+json">
      {JSON.stringify(schemaData)}
    </script>
  </Helmet>
);

export default SEO;