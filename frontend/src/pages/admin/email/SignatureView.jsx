import { signaturesApi, emailApi } from "../../../api/emailApi";
import { useAuthImage } from "./useAuthImage";

// A signature image behind the session, shown as a normal picture. While it loads there is a
// quiet placeholder; if it cannot be loaded (network, storage) the placeholder says so, so a
// broken image never silently shows only alt text.
// The size a signature is SHOWN at (the file is stored at 2x): the server sends it as
// displayWidth/displayHeight; the fallback is the same rule (at most 500 px wide, proportional).
function shownSize({ width, height, displayWidth, displayHeight }) {
  if (displayWidth && displayHeight) return { width: displayWidth, height: displayHeight };
  const w = Math.min(500, width);
  return { width: w, height: Math.round((w * height) / width) };
}

function AuthImage({ load, cacheKey, width, height, alt, className, maxWidth }) {
  const { url, failed } = useAuthImage(load, cacheKey);
  if (url) {
    return <img className={className} src={url} alt={alt} width={width} height={height} style={maxWidth ? { maxWidth } : undefined} />;
  }
  return (
    <div className={`${className} sg-img-wait`} style={{ width: Math.min(width, maxWidth || width), height: 40 }} role={failed ? "alert" : undefined}>
      {failed ? "The image could not be loaded." : ""}
    </div>
  );
}

// MY signature image (fetched with the session; nobody else's can be loaded).
// `signature` is the GET /signatures view: { image: { width, height, bytes } | null, updatedAt }.
export function SignatureImage({ signature, className = "sg-img", maxWidth, alt = "Signature" }) {
  if (!signature?.image) return null;
  const { bytes } = signature.image;
  const { width, height } = shownSize(signature.image);
  return (
    <AuthImage
      load={() => signaturesApi.imageBlob()}
      cacheKey={`${signature.updatedAt}:${bytes}`}
      width={width}
      height={height}
      alt={alt}
      className={className}
      maxWidth={maxWidth}
    />
  );
}

// The image a SENT mail went out with: its own stored copy, not the signature's current image.
export function SentSignatureImage({ messageId, image, className = "sg-img" }) {
  return (
    <AuthImage
      load={() => emailApi.signatureImageBlob(messageId)}
      cacheKey={`${messageId}:${image.width}x${image.height}`}
      width={shownSize(image).width}
      height={shownSize(image).height}
      alt={image.alt || "Signature"}
      className={className}
    />
  );
}
