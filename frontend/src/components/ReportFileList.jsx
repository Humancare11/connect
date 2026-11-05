// The list of medical reports a patient attached to a booking: icon, name, size and a remove button. Shared by the header
// "Book Appointment" form (files picked, uploaded when the patient continues) and the "Get Help With" confirm page (files uploaded as
// soon as they are picked: `uploaded` adds a "Uploaded" tick). Classes come from pages/Appointment.css.
const FILE_ICONS = { pdf: "📄", image: "🖼️", doc: "📝", default: "📎" };

function fileIcon(type = "") {
  if (type.includes("pdf")) return FILE_ICONS.pdf;
  if (type.startsWith("image/")) return FILE_ICONS.image;
  if (type.includes("word") || type.includes("doc")) return FILE_ICONS.doc;
  return FILE_ICONS.default;
}

function formatBytes(b) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function ReportFileList({ files, onRemove, uploaded = false }) {
  if (!Array.isArray(files) || files.length === 0) return null;
  return (
    <div className="ap-report-list">
      {uploaded && (
        <span role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          {files.length === 1 ? "1 file uploaded" : `${files.length} files uploaded`}
        </span>
      )}
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="ap-report-item">
          <span className="ap-report-icon">{fileIcon(f.type)}</span>
          <div className="ap-report-meta">
            <span className="ap-report-name">{f.name}</span>
            <span className="ap-report-size">
              {formatBytes(f.size)}
              {uploaded && (
                <span className="ap-report-uploaded" style={{ marginLeft: 8, color: "#15803d", fontWeight: 600 }}>
                  ✓ Uploaded
                </span>
              )}
            </span>
          </div>
          <button type="button" className="ap-report-remove" aria-label={`Remove ${f.name}`} onClick={() => onRemove(i)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
