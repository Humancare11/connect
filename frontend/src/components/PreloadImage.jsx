// Preloads the page's hero (LCP) image with high priority. React 19 hoists the <link rel="preload"> into
// <head>, including in the prerendered HTML, so the browser starts the download before the CSS or JS that
// would otherwise reveal it. Renders nothing.
import { preload } from "react-dom";

export default function PreloadImage({ src }) {
  if (src) preload(src, { as: "image", fetchPriority: "high" });
  return null;
}
