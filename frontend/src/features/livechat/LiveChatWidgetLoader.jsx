import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { isTrackablePath } from "./useVisitorTracker";
import { DEFAULT_AI_NAME } from "./aiName";
import { apiBaseOf } from "./apiBase";

// Mounts the chat widget on public pages only, client-side, after the browser is idle, and only when the server
// says the module is on (GET /api/livechat/config answers 404 while LIVECHAT_ENABLED=false). The widget code is a
// separate chunk, so prerendering, SEO and LCP are unaffected.
const ENABLED = import.meta.env.VITE_LIVECHAT_ENABLED === "true";
const API_BASE = apiBaseOf(import.meta.env.VITE_API_URL);
const LiveChatWidget = lazy(() => import("./LiveChatWidget"));

const whenIdle = (callback) => {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(callback, { timeout: 5000 });
    return () => window.cancelIdleCallback?.(handle);
  }
  const handle = window.setTimeout(callback, 3000);
  return () => window.clearTimeout(handle);
};

export default function LiveChatWidgetLoader() {
  const { pathname } = useLocation();
  const [serverOn, setServerOn] = useState(false);
  const [aiName, setAiName] = useState(DEFAULT_AI_NAME);
  const [showAiNotice, setShowAiNotice] = useState(false); // Super Admin setting: the AI notice above "Start chat"
  const publicPage = isTrackablePath(pathname) && pathname !== "/cookies";

  useEffect(() => {
    if (!ENABLED || !publicPage || serverOn) return undefined;
    let cancelled = false;
    const cancelIdle = whenIdle(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/livechat/config`, { cache: "no-store" });
        if (!cancelled && res.ok) {
          const config = await res.json().catch(() => ({}));
          if (!cancelled) {
            if (config.aiName) setAiName(config.aiName);
            setShowAiNotice(config.showAiNotice === true);
            setServerOn(true);
          }
        }
      } catch {
        /* server unreachable: no widget */
      }
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [publicPage, serverOn]);

  if (!ENABLED || !serverOn || !publicPage) return null;
  return (
    <Suspense fallback={null}>
      <LiveChatWidget configAiName={aiName} showAiNotice={showAiNotice} />
    </Suspense>
  );
}
