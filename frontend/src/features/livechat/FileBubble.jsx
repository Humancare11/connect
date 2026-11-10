import { useEffect, useRef, useState } from "react";
import { fileUrlCache, isImage, kindLabel, sizeLabel } from "./fileUrls";

// A file in the chat, the same for the patient and the team.
//   image (jpg/png)   a thumbnail you click to open full size, with the name, size and a Download button
//   pdf / other       a card with an icon, the name, the type and size, and Open and Download buttons
// `getUrl(file, purpose)` -> Promise<string> asks the server for a 5-minute link; purpose "preview" is for the thumbnail
// (not logged), "open" and "download" are logged. `onOpen(file)` / `onDownload(file)` do what a click means (a new tab /
// a saved file). `prefix` is the CSS prefix of the host page ("lcw" widget, "wk" admin), so each page keeps its own styles.
export default function FileBubble({ file, getUrl, onOpen, onDownload, prefix = "lcw" }) {
  const hasId = Boolean(file?.id);
  const image = hasId && isImage(file.mime);
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  // The thumbnail is on (or near) the screen: only then is its link asked for (at once if the browser cannot tell).
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  const boxRef = useRef(null);
  const retried = useRef(false);

  useEffect(() => {
    if (!image || near) return undefined;
    const el = boxRef.current;
    if (!el) return undefined;
    const watch = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          watch.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, [image, near]);

  useEffect(() => {
    if (!image || !near) return undefined;
    let cancelled = false;
    fileUrlCache
      .resolve(`${file.id}:preview`, () => getUrl(file, "preview"))
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [image, near, file, getUrl]);

  // The picture did not load (an expired link): one new link, then the plain card.
  const onImageError = () => {
    fileUrlCache.forget(`${file.id}:preview`);
    if (retried.current) {
      setFailed(true);
      return;
    }
    retried.current = true;
    setSrc("");
    fileUrlCache
      .resolve(`${file.id}:preview`, () => getUrl(file, "preview"))
      .then(setSrc)
      .catch(() => setFailed(true));
  };

  const meta = `${kindLabel(file.mime)} · ${sizeLabel(file.size)}`;
  const buttons = hasId && (
    <span className={`${prefix}-fb-actions`}>
      <button type="button" className={`${prefix}-fb-btn`} onClick={() => onOpen(file)}>
        Open
      </button>
      <button type="button" className={`${prefix}-fb-btn`} onClick={() => onDownload(file)}>
        Download
      </button>
    </span>
  );

  if (image && !failed) {
    return (
      <span className={`${prefix}-fb ${prefix}-fb--image`} ref={boxRef}>
        <button type="button" className={`${prefix}-fb-thumb`} onClick={() => onOpen(file)} aria-label="Open image">
          {src ? <img src={src} alt="Image attachment" loading="lazy" onError={onImageError} /> : <span className={`${prefix}-fb-skeleton`} aria-hidden="true" />}
        </button>
        <span className={`${prefix}-fb-caption`}>
          <span className={`${prefix}-fb-name`}>{file.name}</span>
          <small>{meta}</small>
        </span>
        {hasId && (
          <span className={`${prefix}-fb-actions`}>
            <button type="button" className={`${prefix}-fb-btn`} onClick={() => onDownload(file)}>
              Download
            </button>
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={`${prefix}-fb ${prefix}-fb--card`}>
      <span className={`${prefix}-fb-icon`} aria-hidden="true">
        {kindLabel(file.mime) === "PDF" ? "PDF" : "FILE"}
      </span>
      <span className={`${prefix}-fb-caption`}>
        <span className={`${prefix}-fb-name`}>{file.name}</span>
        <small>{meta}</small>
      </span>
      {buttons}
    </span>
  );
}
