import { useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import "./BlogEditor.css";
import { resolveBlogImages, relativizeBlogImages, blogImageSrc } from "../../api/blogApi";

const SAFE_LINK_RE = /^(https?:\/\/|mailto:|tel:|\/)/i;

function ToolButton({ active, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={!!active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        minWidth: 34,
        height: 32,
        padding: "0 8px",
        borderRadius: 6,
        border: "1px solid " + (active ? "#6d28d9" : "#e5e7eb"),
        background: active ? "#ede9fe" : "#fff",
        color: active ? "#6d28d9" : "#374151",
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

// TipTap rich-text editor for blog content. `value` is the saved HTML (relative
// image URLs); `onChange` receives HTML in the same relative form. Remount it
// (change `key`) when switching to a different post.
//
// `compact` is the small variant used for FAQ answers: only bold, italic, link
// and bullet / numbered lists (no headings, quote, images or undo toolbar).
export default function BlogEditor({ value, onChange, onUploadImage, disabled, compact = false, label = "Blog content" }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: compact ? false : { levels: [2, 3, 4] },
        blockquote: compact ? false : undefined,
        horizontalRule: compact ? false : undefined,
        link: { openOnClick: false, autolink: false, HTMLAttributes: { rel: "noopener noreferrer" } },
        codeBlock: false,
        code: false,
        strike: false,
      }),
      ...(compact ? [] : [Image.configure({ inline: false, allowBase64: false })]),
    ],
    content: resolveBlogImages(value || ""),
    editable: !disabled,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        "aria-label": label,
        style: `min-height: ${compact ? 90 : 360}px; padding: ${compact ? "10px 12px" : "14px 16px"}; outline: none; font-size: 15px; line-height: 1.7;`,
      },
    },
    onUpdate: ({ editor: ed }) => onChange(relativizeBlogImages(ed.isEmpty ? "" : ed.getHTML())),
  });

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("Link URL (https://…, mailto:, tel: or /path). Leave empty to remove the link.", previous);
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!SAFE_LINK_RE.test(trimmed)) {
      setError("Links must start with https://, http://, mailto:, tel: or /.");
      return;
    }
    setError("");
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      const alt = window.prompt("Image description (alt text, helps accessibility and SEO):", "") || "";
      editor.chain().focus().setImage({ src: blogImageSrc(url), alt: alt.trim() }).run();
    } catch (err) {
      setError(err.response?.data?.msg || err.message || "Image upload failed.");
    }
    setUploading(false);
  };

  const run = (fn) => () => fn(editor.chain().focus()).run();

  return (
    <div className="blog-editor" style={{ border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
      <div
        role="toolbar"
        aria-label="Formatting"
        style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 8, borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}
      >
        {compact ? (
          <>
          <ToolButton title="Bold" active={editor.isActive("bold")} onClick={run((c) => c.toggleBold())}><b>B</b></ToolButton>
          <ToolButton title="Italic" active={editor.isActive("italic")} onClick={run((c) => c.toggleItalic())}><i>I</i></ToolButton>
          <ToolButton title="Bulleted list" active={editor.isActive("bulletList")} onClick={run((c) => c.toggleBulletList())}>• List</ToolButton>
          <ToolButton title="Numbered list" active={editor.isActive("orderedList")} onClick={run((c) => c.toggleOrderedList())}>1. List</ToolButton>
          <ToolButton title="Link" active={editor.isActive("link")} onClick={setLink}>Link</ToolButton>
          </>
        ) : (
          <>
          <ToolButton title="Heading 2 (appears in the table of contents)" active={editor.isActive("heading", { level: 2 })} onClick={run((c) => c.toggleHeading({ level: 2 }))}>H2</ToolButton>
          <ToolButton title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={run((c) => c.toggleHeading({ level: 3 }))}>H3</ToolButton>
          <ToolButton title="Paragraph" active={editor.isActive("paragraph")} onClick={run((c) => c.setParagraph())}>¶</ToolButton>
          <ToolButton title="Bold" active={editor.isActive("bold")} onClick={run((c) => c.toggleBold())}><b>B</b></ToolButton>
          <ToolButton title="Italic" active={editor.isActive("italic")} onClick={run((c) => c.toggleItalic())}><i>I</i></ToolButton>
          <ToolButton title="Bulleted list" active={editor.isActive("bulletList")} onClick={run((c) => c.toggleBulletList())}>• List</ToolButton>
          <ToolButton title="Numbered list" active={editor.isActive("orderedList")} onClick={run((c) => c.toggleOrderedList())}>1. List</ToolButton>
          <ToolButton title="Quote" active={editor.isActive("blockquote")} onClick={run((c) => c.toggleBlockquote())}>❝</ToolButton>
          <ToolButton title="Link" active={editor.isActive("link")} onClick={setLink}>Link</ToolButton>
          <ToolButton title="Insert image" disabled={uploading || disabled} onClick={() => fileRef.current?.click()}>
            {uploading ? "Uploading…" : "Image"}
          </ToolButton>
          <ToolButton title="Undo" disabled={!editor.can().undo()} onClick={run((c) => c.undo())}>↶</ToolButton>
          <ToolButton title="Redo" disabled={!editor.can().redo()} onClick={run((c) => c.redo())}>↷</ToolButton>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onPickImage} />
      </div>
      {error && (
        <div role="alert" style={{ padding: "8px 12px", fontSize: 13, color: "#b91c1c", background: "#fef2f2" }}>
          {error}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
