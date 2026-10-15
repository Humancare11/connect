import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { signaturesApi } from "../../../api/emailApi";
import { NO_SIGNATURE, SIGNATURES_KEY, forceSwap, pickSignature, splitCompose, swapSignature } from "./signatureUtils";

// The signature dropdown of a compose or reply box.
//
//   mailboxId   the mailbox the mail goes out from (its per-mailbox default is used)
//   body/setBody  the textarea's text: the signature lives INSIDE it, below a "-- " line
//   textRef     the textarea, so the caret can stay above the signature
//   ask         async ({ title, message, confirmText }) => boolean  (the app's confirm dialog)
//
// Until the admin picks something, the box follows the default for the current mailbox
// (so switching From switches the signature). Once they pick, their choice stays.
// A signature the admin edited in the text is never replaced without asking.
//
// → { signatures, signatureId, choose(id), removedByHand, loading }
//   signatureId  "none" or one of MY signature ids: this is what the server is sent
export function useSignatureField({ mailboxId, body, setBody, textRef, ask }) {
  const q = useQuery({ queryKey: SIGNATURES_KEY, queryFn: signaturesApi.get, staleTime: 30_000 });
  const data = q.data;
  const signatures = useMemo(() => data?.signatures || [], [data]);

  const [signatureId, setSignatureId] = useState(NO_SIGNATURE);
  // null = the admin has not chosen: follow the default.
  const [chosen, setChosen] = useState(null);
  // The signature text WE put into the box last, to tell "untouched" from "edited".
  const inserted = useRef("");
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const [caretAt, setCaretAt] = useState(null);

  const apply = useCallback(
    (text, signatureText, id) => {
      inserted.current = signatureText;
      setBody(text);
      setSignatureId(id);
      // Keep typing above the signature: put the caret at the end of the message part.
      setCaretAt(splitCompose(text).message.length);
    },
    [setBody]
  );

  // Follow the default (for this mailbox) until the admin chooses.
  useEffect(() => {
    if (!data || chosen !== null) return;
    const pick = pickSignature(data, mailboxId);
    const id = pick?.id || NO_SIGNATURE;
    if (id === signatureId) return;
    const r = swapSignature(bodyRef.current, inserted.current, pick?.content || "");
    if (r.needsConfirm) return; // they changed it by hand: leave their text alone
    apply(r.text, pick?.content || "", id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mailboxId, chosen]);

  useLayoutEffect(() => {
    if (caretAt === null) return;
    const el = textRef?.current;
    if (el && document.activeElement === el) el.setSelectionRange(caretAt, caretAt);
    setCaretAt(null);
  }, [caretAt, textRef]);

  const choose = useCallback(
    async (id) => {
      const next = id === NO_SIGNATURE ? "" : signatures.find((s) => s.id === id)?.content ?? "";
      if (id !== NO_SIGNATURE && !signatures.some((s) => s.id === id)) return;
      let r = swapSignature(bodyRef.current, inserted.current, next);
      if (r.needsConfirm) {
        const ok = await ask({
          title: "Replace your edited signature?",
          message: "You changed the signature in this mail. Replace it with the one you chose?",
          confirmText: "Replace",
        });
        if (!ok) return;
        r = { text: forceSwap(bodyRef.current, next), needsConfirm: false };
      }
      setChosen(id);
      apply(r.text, next, id);
    },
    [signatures, ask, apply]
  );

  // The dropdown says "signature" but the text is gone: tell the admin what that means.
  const removedByHand = signatureId !== NO_SIGNATURE && !splitCompose(body).hasDivider;

  return { signatures, signatureId, choose, removedByHand, loading: q.isLoading };
}
