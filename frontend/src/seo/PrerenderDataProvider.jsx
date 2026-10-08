import { PrerenderDataContext } from "./prerenderContext";

// Server only (entry-server.jsx): hands the page's build-time data to usePrerendered().
export function PrerenderDataProvider({ data, children }) {
  return <PrerenderDataContext.Provider value={data}>{children}</PrerenderDataContext.Provider>;
}
