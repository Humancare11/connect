// Data fetched at build time (blog posts, doctor profiles) and handed to the page that renders it,
// so the prerendered HTML contains the content and the browser hydrates with identical data.
//
//   server: entry-server.jsx wraps the app in <PrerenderDataProvider data={...}>
//   client: scripts/prerender.mjs embeds the same object as <script id="__PRERENDER_DATA__">;
//           main.jsx calls readPrerenderData() before hydrating.
import { useContext } from "react";
import { PrerenderDataContext } from "./prerenderContext";

let clientData = null;

export function readPrerenderData() {
  try {
    const el = document.getElementById("__PRERENDER_DATA__");
    clientData = el ? JSON.parse(el.textContent) : null;
  } catch {
    clientData = null;
  }
}

// Returns the prerendered record for a key such as "blog:my-slug", or null.
export function usePrerendered(key) {
  const fromContext = useContext(PrerenderDataContext);
  const source = fromContext || clientData;
  return source && key in source ? source[key] : null;
}
