// Data fetched at build time (blog posts, doctor profiles) and handed to the page that renders it,
// so the prerendered HTML contains the content and the browser hydrates with identical data.
//
//   server: entry-server.jsx wraps the app in <PrerenderDataProvider data={...}>
//   client: scripts/prerender.mjs embeds the same object as <script id="__PRERENDER_DATA__">;
//           main.jsx calls readPrerenderData() before hydrating.
import { createContext, useContext } from "react";

const PrerenderDataContext = createContext(null);

let clientData = null;

export function PrerenderDataProvider({ data, children }) {
  return <PrerenderDataContext.Provider value={data}>{children}</PrerenderDataContext.Provider>;
}

export function readPrerenderData() {
  try {
    const el = document.getElementById("__PRERENDER_DATA__");
    clientData = el ? JSON.parse(el.textContent) : null;
  } catch {
    clientData = null;
  }
}

// Returns the prerendered record for a key such as "blog:my-slug", or null.
// On the server it reads the context; in the browser it reads the embedded JSON, but only for the
// first render of the page it was embedded in (see consumePrerendered).
export function usePrerendered(key) {
  const fromContext = useContext(PrerenderDataContext);
  const source = fromContext || clientData;
  return source && key in source ? source[key] : null;
}
