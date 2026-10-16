import { useCallback, useState } from "react";

// Dark by default (as in the design); the choice is remembered per browser. Storage may be blocked, so every
// access is wrapped and the page works without it.
const KEY = "hc-livechat-theme";

const read = () => {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
};

export function useLiveChatTheme() {
  const [theme, setTheme] = useState(read);
  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* private window or blocked storage: the choice just is not remembered */
      }
      return next;
    });
  }, []);
  return { theme, toggle };
}
