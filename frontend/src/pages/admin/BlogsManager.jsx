import { useEffect, useState } from "react";
import api from "../../api";
import { blogImageSrc } from "../../api/blogApi";
import BlogEditor from "./BlogEditor";
import BlogArticle from "../Blogs/BlogArticle";

const EMPTY_FORM = {
  title: "",
  slug: "",
  coverImage: "",
  excerpt: "",
  content: "",
  category: "",
  tags: "",
  readTime: "",
  metaTitle: "",
  metaDescription: "",
};

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString() : "—");

function StatusBadge({ status }) {
  const live = status === "published";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: live ? "#f0fdf4" : "#fef3c7",
        color: live ? "#16a34a" : "#92400e",
      }}
    >
      {live ? "Published" : "Draft"}
    </span>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="sa-field">
      <label>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export default function BlogsManager() {
  // view: "list" | "form"; editingId null = new post
  const [view, setView] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState({ type: "", text: "" });

  const flash = (type, text) => {
    setNotice({ type, text });
    if (type === "success") setTimeout(() => setNotice({ type: "", text: "" }), 4000);
  };

  const load = () => {
    api
      .get("/api/superadmin/blogs")
      .then((res) => setBlogs(res.data))
      .catch((err) => flash("error", err.response?.data?.msg || "Could not load blogs."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const setStatus = async (blog, status) => {
    setBusyId(blog._id);
    try {
      const res = await api.patch(`/api/superadmin/blogs/${blog._id}/status`, { status });
      setBlogs((prev) => prev.map((b) => (b._id === blog._id ? { ...b, ...res.data } : b)));
      flash("success", status === "published" ? `"${blog.title}" is now live.` : `"${blog.title}" was unpublished.`);
    } catch (err) {
      flash("error", err.response?.data?.msg || "Could not change status.");
    }
    setBusyId(null);
  };

  const remove = async (blog) => {
    if (!window.confirm(`Delete "${blog.title}"? This cannot be undone.`)) return;
    setBusyId(blog._id);
    try {
      await api.delete(`/api/superadmin/blogs/${blog._id}`);
      setBlogs((prev) => prev.filter((b) => b._id !== blog._id));
      flash("success", "Blog deleted.");
    } catch (err) {
      flash("error", err.response?.data?.msg || "Could not delete the blog.");
    }
    setBusyId(null);
  };

  if (view === "form") {
    return (
      <BlogForm
        key={editingId || "new"}
        blogId={editingId}
        onClose={() => {
          setView("list");
          setEditingId(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="dash-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 className="dash-section-title" style={{ margin: 0 }}>All Blogs ({blogs.length})</h2>
        <button
          className="sa-create-btn"
          onClick={() => {
            setEditingId(null);
            setView("form");
          }}
        >
          + New Blog
        </button>
      </div>

      {notice.text && (
        <div className={notice.type === "error" ? "sa-form-error" : "sa-form-success"} style={{ marginBottom: 14 }}>
          {notice.text}
        </div>
      )}

      {loading ? (
        <p className="dash-empty">Loading blogs…</p>
      ) : blogs.length === 0 ? (
        <p className="dash-empty">No blogs yet. Create one above.</p>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                {["Title", "Status", "Date", "Actions"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blogs.map((b, i) => (
                <tr key={b._id} className={i % 2 === 0 ? "" : "alt"}>
                  <td className="bold">
                    {b.title}
                    {b.isLegacy && (
                      <span
                        title="Article body is managed in code"
                        style={{ marginLeft: 8, padding: "1px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#e0e7ff", color: "#4338ca" }}
                      >
                        Legacy
                      </span>
                    )}
                    <div className="muted" style={{ fontWeight: 400 }}>/{b.slug}</div>
                  </td>
                  <td><StatusBadge status={b.status} /></td>
                  <td className="muted">{fmtDate(b.status === "published" ? b.publishedAt : b.updatedAt)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        className="btn-approve"
                        style={{ fontSize: 12, padding: "4px 12px" }}
                        onClick={() => {
                          setEditingId(b._id);
                          setView("form");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        disabled={busyId === b._id}
                        onClick={() => setStatus(b, b.status === "published" ? "draft" : "published")}
                        style={{
                          fontSize: 12,
                          padding: "4px 12px",
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 600,
                          background: b.status === "published" ? "#fff3cd" : "#f0fdf4",
                          color: b.status === "published" ? "#92400e" : "#16a34a",
                        }}
                      >
                        {b.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        className="btn-reject"
                        style={{ fontSize: 12, padding: "4px 12px", opacity: b.isLegacy ? 0.4 : 1 }}
                        disabled={busyId === b._id || b.isLegacy}
                        title={b.isLegacy ? "Legacy articles cannot be deleted. Unpublish it instead." : "Delete"}
                        onClick={() => remove(b)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BlogForm({ blogId, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [meta, setMeta] = useState({ isLegacy: false, status: "draft", publishedAt: null });
  const [slugTouched, setSlugTouched] = useState(!!blogId);
  const [loading, setLoading] = useState(!!blogId);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  // id of the saved post; set after the first save of a new post
  const [savedId, setSavedId] = useState(blogId);

  useEffect(() => {
    if (!blogId) return;
    api
      .get(`/api/superadmin/blogs/${blogId}`)
      .then((res) => {
        const b = res.data;
        setForm({
          title: b.title || "",
          slug: b.slug || "",
          coverImage: b.coverImage || "",
          excerpt: b.excerpt || "",
          content: b.content || "",
          category: b.category || "",
          tags: (b.tags || []).join(", "),
          readTime: b.readTime ? String(b.readTime) : "",
          metaTitle: b.metaTitle || "",
          metaDescription: b.metaDescription || "",
        });
        setMeta({ isLegacy: !!b.isLegacy, status: b.status, publishedAt: b.publishedAt });
      })
      .catch((err) => setError(err.response?.data?.msg || "Could not load the blog."))
      .finally(() => setLoading(false));
  }, [blogId]);

  useEffect(() => {
    if (!showPreview) return undefined;
    const onKey = (e) => e.key === "Escape" && setShowPreview(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showPreview]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onTitleChange = (title) => {
    update(slugTouched || meta.isLegacy ? { title } : { title, slug: slugify(title) });
  };

  const uploadImage = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post("/api/superadmin/blogs/image", fd);
    return res.data.url;
  };

  const onCoverPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploadingCover(true);
    try {
      update({ coverImage: await uploadImage(file) });
    } catch (err) {
      setError(err.response?.data?.msg || "Cover image upload failed.");
    }
    setUploadingCover(false);
  };

  // status: "draft" | "published" | undefined (keep current status)
  const save = async (status) => {
    setError("");
    setSuccess("");
    if (!form.title.trim()) return setError("Title is required.");
    if (!form.slug.trim()) return setError("Slug is required.");
    setSaving(true);
    const payload = {
      title: form.title,
      slug: form.slug,
      coverImage: form.coverImage,
      excerpt: form.excerpt,
      category: form.category,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      readTime: form.readTime ? Number(form.readTime) : null,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
    };
    if (!meta.isLegacy) payload.content = form.content;
    if (status) payload.status = status;
    try {
      const res = savedId
        ? await api.put(`/api/superadmin/blogs/${savedId}`, payload)
        : await api.post("/api/superadmin/blogs", payload);
      const b = res.data;
      setSavedId(b._id);
      setSlugTouched(true);
      setForm((f) => ({ ...f, slug: b.slug, readTime: b.readTime ? String(b.readTime) : f.readTime }));
      setMeta({ isLegacy: !!b.isLegacy, status: b.status, publishedAt: b.publishedAt });
      setSuccess(
        status === "published" && b.status === "published"
          ? "Published. The blog is live on the website."
          : b.status === "published"
            ? "Changes saved and live."
            : "Draft saved.",
      );
    } catch (err) {
      setError(err.response?.data?.msg || "Could not save the blog.");
    }
    setSaving(false);
  };

  if (loading) return <div className="dash-section"><p className="dash-empty">Loading blog…</p></div>;

  const live = meta.status === "published";
  const busy = saving || uploadingCover;

  return (
    <div className="dash-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 className="dash-section-title" style={{ margin: 0 }}>
          {savedId ? "Edit Blog" : "New Blog"} <StatusBadge status={meta.status} />
          {meta.isLegacy && <span style={{ marginLeft: 8, fontSize: 12, color: "#4338ca" }}>Legacy</span>}
        </h2>
        <button type="button" className="btn-view" style={{ background: "#6b7280" }} onClick={onClose}>
          ← Back to list
        </button>
      </div>

      {error && <div className="sa-form-error" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      {success && <div className="sa-form-success" role="status" style={{ marginBottom: 14 }}>{success}</div>}

      <form className="sa-form" onSubmit={(e) => e.preventDefault()}>
        <div className="sa-form-row">
          <Field label="Title *">
            <input disabled={busy} value={form.title} onChange={(e) => onTitleChange(e.target.value)} maxLength={300} />
          </Field>
          <Field
            label="Slug *"
            hint={meta.isLegacy ? "Fixed: this article keeps its existing URL." : `URL: /${form.slug || "your-slug"}`}
          >
            <input
              disabled={busy || meta.isLegacy}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                update({ slug: slugify(e.target.value) });
              }}
              maxLength={100}
            />
          </Field>
        </div>

        <Field label="Cover image" hint="JPG, PNG, WEBP or GIF, up to 5 MB. Required to publish.">
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            {form.coverImage && (
              <img
                src={blogImageSrc(form.coverImage)}
                alt="Cover preview"
                style={{ width: 160, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={onCoverPick} />
            {form.coverImage && (
              <button type="button" className="btn-reject" style={{ fontSize: 12, padding: "4px 12px" }} onClick={() => update({ coverImage: "" })}>
                Remove
              </button>
            )}
            {uploadingCover && <span className="muted">Uploading…</span>}
          </div>
        </Field>

        <Field label="Short description (excerpt) *" hint="Shown on the blog list card.">
          <textarea rows={3} disabled={busy} value={form.excerpt} onChange={(e) => update({ excerpt: e.target.value })} maxLength={1000} />
        </Field>

        <div className="sa-form-row">
          <Field label="Category" hint="Shown on the article page only.">
            <input disabled={busy} value={form.category} onChange={(e) => update({ category: e.target.value })} maxLength={80} />
          </Field>
          <Field label="Tags" hint="Comma separated. The first tag is shown next to the category on the article page.">
            <input disabled={busy} value={form.tags} onChange={(e) => update({ tags: e.target.value })} maxLength={200} />
          </Field>
          <Field label="Read time (minutes)" hint="Leave empty to calculate automatically.">
            <input
              type="number"
              min={1}
              max={120}
              disabled={busy}
              value={form.readTime}
              onChange={(e) => update({ readTime: e.target.value })}
            />
          </Field>
        </div>

        <div className="sa-form-row">
          <Field label="SEO title">
            <input disabled={busy} value={form.metaTitle} onChange={(e) => update({ metaTitle: e.target.value })} maxLength={200} />
          </Field>
          <Field label="SEO description">
            <textarea rows={2} disabled={busy} value={form.metaDescription} onChange={(e) => update({ metaDescription: e.target.value })} maxLength={400} />
          </Field>
        </div>

        {meta.isLegacy ? (
          <div className="sa-form-success" style={{ background: "#eef2ff", borderColor: "#c7d2fe", color: "#3730a3" }}>
            This is a legacy article. Its body is managed in code, so only the list-card details above can be edited here.
          </div>
        ) : (
          <Field label="Content" hint="Use H2 headings to build the table of contents on the article page.">
            <BlogEditor
              key={savedId || "new"}
              value={form.content}
              onChange={(html) => update({ content: html })}
              onUploadImage={uploadImage}
              disabled={saving}
            />
          </Field>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {meta.isLegacy ? (
            <a className="btn-view" style={{ textDecoration: "none", display: "inline-block" }} href={`/${form.slug}`} target="_blank" rel="noopener noreferrer">
              View live
            </a>
          ) : (
            <button type="button" className="btn-view" disabled={busy} onClick={() => setShowPreview(true)}>
              Preview
            </button>
          )}
          <button type="button" className="sa-create-btn" style={{ background: "#6b7280" }} disabled={busy} onClick={() => save("draft")}>
            {saving ? "Saving…" : live ? "Unpublish (save as draft)" : "Save Draft"}
          </button>
          <button type="button" className="sa-create-btn" style={{ background: "#059669" }} disabled={busy} onClick={() => save("published")}>
            {saving ? "Saving…" : live ? "Update" : "Publish"}
          </button>
        </div>
      </form>

      {showPreview && (
        <div
          id="blog-preview-scroll"
          data-lenis-prevent
          role="dialog"
          aria-modal="true"
          aria-label="Blog preview"
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#fff", overflowY: "auto" }}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 70,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              background: "#1f2937",
              color: "#fff",
              fontSize: 14,
            }}
          >
            <span>Preview — not saved or published</span>
            <button type="button" className="btn-reject" onClick={() => setShowPreview(false)}>
              Close preview
            </button>
          </div>
          <BlogArticle
            preview
            blog={{
              title: form.title || "Untitled",
              coverImage: form.coverImage,
              category: form.category,
              tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
              publishedAt: meta.publishedAt || new Date().toISOString(),
              readTime: form.readTime ? Number(form.readTime) : null,
              content: form.content,
            }}
          />
        </div>
      )}
    </div>
  );
}
