import { useEffect, useState } from "react";

// Images behind the session (signature images) cannot be an <img src>: the request needs the
// Authorization header. This loads the image through the API client and hands back an object URL.
//   load  () => Promise<Blob>
//   key   changes when the image changes (id + updated time); falsy = no image
// → "" until loaded, or when there is no image or it failed.
export function useAuthImage(load, key) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!key) {
      setUrl("");
      return undefined;
    }
    let cancelled = false;
    let objectUrl = "";
    Promise.resolve()
      .then(load)
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl("");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `load` is a new closure every render; `key` says when the image really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return url;
}
