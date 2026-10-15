import { useEffect, useState } from "react";

// Images behind the session (signature images) cannot be an <img src>: the request needs the
// Authorization header. This loads the image through the API client and hands back an object URL.
// (That URL is a blob: address, so the page's Content-Security-Policy `img-src` must allow blob:.)
//   load  () => Promise<Blob>
//   key   changes when the image changes (updated time); falsy = no image
// → { url, failed }  url is "" until loaded, or when there is no image or it failed.
export function useAuthImage(load, key) {
  const [state, setState] = useState({ url: "", failed: false });

  useEffect(() => {
    if (!key) {
      setState({ url: "", failed: false });
      return undefined;
    }
    let cancelled = false;
    let objectUrl = "";
    setState({ url: "", failed: false });
    Promise.resolve()
      .then(load)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setState({ url: "", failed: true });
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ url: "", failed: true });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `load` is a new closure every render; `key` says when the image really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
