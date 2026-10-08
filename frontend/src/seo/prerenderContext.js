import { createContext } from "react";

// Build-time data for the page being prerendered (blog posts, doctor profiles); see prerenderData.js.
export const PrerenderDataContext = createContext(null);
