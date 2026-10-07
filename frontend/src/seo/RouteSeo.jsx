// Emits head tags for routes whose page component renders no <SEO> of its own:
//   - every non-public route (login, dashboards, booking steps, /pay, ...): noindex,nofollow
//   - map entries flagged `global: true` (e.g. legal pages)
// Mounted once in App.jsx. Pages that render <SEO> themselves are not duplicated: the tags
// are identical for a given pathname and react-helmet-async keeps a single instance of each.
import { useLocation } from "react-router-dom";
import SEO from "../components/Seo";
import { getRouteSeo } from "./routes";

export default function RouteSeo() {
  const { pathname } = useLocation();
  const { entry, noindex } = getRouteSeo(pathname);
  if (!noindex && !entry?.global) return null;
  return <SEO />;
}
