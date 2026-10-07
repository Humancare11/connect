// Prerendered pages ship with their <title>, <meta> and <link> tags already in <head>, marked with
// data-prerendered-head. React 19 does not adopt head tags it did not create, so once the page has
// hydrated and <SEO> has rendered its own copy, this removes the server copies: exactly one set of
// tags remains. Until then the server tags stay, so crawlers and the first paint always have them.
//
// Client only (main.jsx). It renders nothing, so the hydrated markup is unaffected.
import { useEffect } from "react";

const SERVER_TAGS = "[data-prerendered-head]";

export default function PrerenderCleanup() {
  useEffect(() => {
    if (!document.head.querySelector(SERVER_TAGS)) return undefined;

    let done = false;
    const removeServerTags = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(fallback);
      document.head.querySelectorAll(SERVER_TAGS).forEach((el) => {
        // Keep a fallback <title> when the page rendered none of its own (dashboards, login).
        if (el.tagName === "TITLE" && !document.head.querySelector("title:not([data-prerendered-head])")) return;
        el.remove();
      });
    };

    // Every page that emits head tags emits a robots meta, so a robots meta that is NOT a server
    // copy means the client has rendered the page's own tags.
    const clientTagsReady = () => document.head.querySelector('meta[name="robots"]:not([data-prerendered-head])');

    const observer = new MutationObserver(() => {
      if (clientTagsReady()) removeServerTags();
    });
    observer.observe(document.head, { childList: true });
    // Lazy pages hydrate when their chunk arrives; give up waiting after a few seconds.
    const fallback = setTimeout(removeServerTags, 5000);
    if (clientTagsReady()) removeServerTags();

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return null;
}
