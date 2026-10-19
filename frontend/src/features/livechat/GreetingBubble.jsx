import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// The greeting above the round launcher. It is shown 3 seconds after every page load, refresh and client-side page
// change, nothing is remembered between loads. The X hides it until the next load or page change. It never shows
// while the chat window is open, and once the chat has been open on a page it does not come back on that page.
const DELAY_MS = 3000;
export const TYPING_MS = 1200; // blue typing dots show this long before the message

export default function GreetingBubble({ open, blocked, onOpen }) {
  const { pathname } = useLocation();
  const [shownPath, setShownPath] = useState(null); // the page the bubble is currently showing on
  const [typedPath, setTypedPath] = useState(null); // the page whose message has finished "typing"
  const [prevOpen, setPrevOpen] = useState(open);
  const openNow = useRef(open);
  const openedOnPage = useRef(open);

  // Opening the chat takes the bubble away for the rest of this page.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setShownPath(null);
  }

  useEffect(() => {
    openNow.current = open;
    if (open) openedOnPage.current = true;
  }, [open]);

  // A new page (or a full load): start the 3 second wait again, unless the chat is open.
  useEffect(() => {
    openedOnPage.current = openNow.current;
    const timer = setTimeout(() => {
      if (!openNow.current && !openedOnPage.current) {
        setTypedPath(null);
        setShownPath(pathname);
      }
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  // The dots come first, then the message.
  useEffect(() => {
    if (shownPath === null) return undefined;
    const timer = setTimeout(() => setTypedPath(shownPath), TYPING_MS);
    return () => clearTimeout(timer);
  }, [shownPath]);

  if (open || blocked || shownPath !== pathname) return null;

  if (typedPath !== pathname) {
    return (
      <div className="lcw-greet lcw-greet--typing" role="status" aria-label="Typing">
        <span className="lcw-greet-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    );
  }

  return (
    <div className="lcw-greet" role="status">
      <button type="button" className="lcw-greet-text" onClick={onOpen}>
        Hello <span aria-hidden="true">👋</span>, Are you looking to consult with a doctor?
      </button>
      <button type="button" className="lcw-greet-x" onClick={() => setShownPath(null)} aria-label="Dismiss greeting">
        ✕
      </button>
    </div>
  );
}
