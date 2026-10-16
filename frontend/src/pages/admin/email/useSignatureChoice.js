import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { signaturesApi } from "../../../api/emailApi";
import { SIGNATURES_KEY, startsTicked } from "./signatureUtils";

// The "Add my signature" box of a compose or reply form.
//
// It starts ticked when I have an image and "Add to new mails automatically" is on, and follows
// that until I tick or untick it myself. Nothing is put into the message text: the server adds
// the image when the mail is sent.
//
// → { signature, loading, use, setUse }
//   use  true when the mail will go out with my image: this is what the server is sent
export function useSignatureChoice() {
  const q = useQuery({
    queryKey: SIGNATURES_KEY,
    queryFn: signaturesApi.get,
    staleTime: 10_000,
    // I may have just uploaded one in the other tab.
    refetchOnWindowFocus: "always",
  });
  const signature = q.data?.signature || null;
  // null = not touched: follow the setting.
  const [chosen, setChosen] = useState(null);
  const use = Boolean(signature?.image) && (chosen ?? startsTicked(signature));
  return { signature, loading: q.isLoading, use, setUse: setChosen };
}
