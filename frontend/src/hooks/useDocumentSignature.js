import { useEffect, useState } from "react";
import api from "../api";
import { blobToDataUrl } from "../utils/visitNote";

// Fetches the signature image of an issued Prescription / Certificate through its authenticated, role-scoped route
// and returns it as a data: URL (the PDF capture needs data: URLs, not blob: URLs). Returns "" for unsigned or
// pre-signing documents, while loading, and on any failure: the slip then simply shows an empty signature area.
//   url       e.g. /api/medical/my-prescriptions/<id>/signature
//   authRole  "doctor" | "user"
export default function useDocumentSignature(url, authRole, isSigned) {
  const [state, setState] = useState({ url: "", data: "" });

  useEffect(() => {
    if (!isSigned || !url) return undefined;
    let cancelled = false;
    api
      .get(url, { authRole, responseType: "blob" })
      .then((res) => blobToDataUrl(res.data))
      .then((data) => {
        if (!cancelled) setState({ url, data });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, authRole, isSigned]);

  return isSigned && state.url === url ? state.data : "";
}
