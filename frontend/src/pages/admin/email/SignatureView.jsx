import { signaturesApi, emailApi } from "../../../api/emailApi";
import { useAuthImage } from "./useAuthImage";

// The image of one of MY signatures (fetched with the session; nobody else's can be loaded).
export function SignatureImage({ signature, className = "sg-img", maxWidth }) {
  const url = useAuthImage(() => signaturesApi.imageBlob(signature.id), signature.image ? `${signature.id}:${signature.updatedAt}:${signature.image.bytes}` : "");
  if (!signature.image) return null;
  const w = signature.image.width;
  const h = signature.image.height;
  return url ? (
    <img
      className={className}
      src={url}
      alt={signature.imageAltEffective || signature.name}
      width={w}
      height={h}
      style={maxWidth ? { maxWidth } : undefined}
    />
  ) : (
    <div className={className} style={{ width: Math.min(w, maxWidth || w), height: 40 }} aria-label="Loading image" />
  );
}

// The image a SENT mail went out with: its own stored copy, not the signature's current image.
export function SentSignatureImage({ messageId, image, className = "sg-img" }) {
  const url = useAuthImage(() => emailApi.signatureImageBlob(messageId), `${messageId}:${image.width}x${image.height}`);
  return url ? (
    <img className={className} src={url} alt={image.alt || ""} width={image.width} height={image.height} />
  ) : (
    <div className={className} style={{ width: Math.min(image.width, 300), height: 40 }} aria-label="Loading image" />
  );
}

// How a mail ends, as the recipient sees it in HTML mail:
//   message, [image], [text lines], company footer
// layout: "text" shows the "-- " divider and the lines (as in plain text); the image layouts do not.
export function MailEnding({ message, layout, image, lines, company }) {
  return (
    <div className="sg-mail" aria-label="Preview">
      {message ? <div style={{ whiteSpace: "pre-wrap" }}>{message}</div> : null}
      {layout === "text" && lines ? (
        <div className="sg-mail-gap" style={{ whiteSpace: "pre-wrap" }}>
          {`-- \n${lines}`}
        </div>
      ) : null}
      {layout !== "text" && image ? <div className="sg-mail-gap">{image}</div> : null}
      {layout === "image_text" && lines ? <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{lines}</div> : null}
      {company ? (
        <div className="sg-mail-gap" style={{ whiteSpace: "pre-wrap" }}>
          {company}
        </div>
      ) : null}
    </div>
  );
}
