// Server entry used only at build time by scripts/prerender.mjs (vite build --ssr).
// Renders the real app for a URL with StaticRouter and resolves once every lazy route and
// Suspense boundary has finished, so the HTML contains the page's full content.
import { renderToPipeableStream } from "react-dom/server";
import { Writable } from "node:stream";
import { StaticRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import AppProviders from "./AppProviders";
import { AppLayout } from "./App.jsx";
import { PrerenderDataProvider } from "./seo/PrerenderDataProvider";

export function render(url, data = null) {
  return new Promise((resolve, reject) => {
    const errors = [];
    let html = "";
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        html += chunk.toString();
        callback();
      },
      final(callback) {
        resolve({ html, errors });
        callback();
      },
    });

    const timer = setTimeout(() => {
      abort();
      reject(new Error(`Timed out rendering ${url}`));
    }, 60000);

    const { pipe, abort } = renderToPipeableStream(
      <HelmetProvider>
        <PrerenderDataProvider data={data}>
          <AppProviders>
            <StaticRouter location={url}>
              <AppLayout />
            </StaticRouter>
          </AppProviders>
        </PrerenderDataProvider>
      </HelmetProvider>,
      {
        onAllReady() {
          clearTimeout(timer);
          pipe(sink);
        },
        onShellError(error) {
          clearTimeout(timer);
          reject(error);
        },
        onError(error) {
          errors.push(error);
        },
      }
    );
  });
}
