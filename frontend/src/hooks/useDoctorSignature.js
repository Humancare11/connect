import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api";
import { blobToDataUrl } from "../utils/visitNote";

// The doctor's ONE reusable signature (Prescriptions, Medical Certificates and Visit Notes all use it).
// Everything goes through /api/doctor/signature: the image is private, fetched as a data: URL (usable in the PDF).
//   hasSignature / imageUrl   current saved signature
//   preview(file, removeBackground)  -> { previewDataUrl, sourceType, backgroundRemoved }   (stores nothing)
//   save(file, removeBackground)     -> stores it, refreshes imageUrl
export default function useDoctorSignature() {
  const [state, setState] = useState({ loading: true, hasSignature: false, imageUrl: "", error: "" });
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/api/doctor/signature", { authRole: "doctor" });
      if (!data?.hasSignature) {
        if (alive.current) setState({ loading: false, hasSignature: false, imageUrl: "", error: "" });
        return;
      }
      const img = await api.get("/api/doctor/signature/image", { authRole: "doctor", responseType: "blob" });
      const imageUrl = await blobToDataUrl(img.data);
      if (alive.current) setState({ loading: false, hasSignature: true, imageUrl, error: "" });
    } catch {
      // A failed load must never block the form: the doctor can still issue unsigned and retry.
      if (alive.current) setState((s) => ({ ...s, loading: false, error: "Could not load your saved signature." }));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    // refresh() only sets state after its awaited requests, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  const body = (file, removeBackground) => {
    const form = new FormData();
    form.append("signature", file);
    form.append("removeBackground", removeBackground ? "1" : "0");
    return form;
  };

  const preview = useCallback(async (file, removeBackground = true) => {
    const { data } = await api.post("/api/doctor/signature/preview", body(file, removeBackground), { authRole: "doctor" });
    return data;
  }, []);

  const save = useCallback(
    async (file, removeBackground = true) => {
      await api.put("/api/doctor/signature", body(file, removeBackground), { authRole: "doctor" });
      await refresh();
    },
    [refresh],
  );

  return { ...state, refresh, preview, save };
}
