// Live Chat pages that are built in a later phase. They exist now so the sidebar group is complete.
const PHASES = {
  "AI chats": "Phase 3",
  "Live agent chats": "Phase 3",
  Team: "Phase 5",
  Reports: "Phase 5",
  "AI agent settings": "Phase 5",
};

export default function LiveChatPlaceholder({ title }) {
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", color: "#1d4ed8", textTransform: "uppercase" }}>
        Humancare Admin · Live Chat
      </div>
      <h2 style={{ margin: "4px 0 10px", fontSize: 22, fontWeight: 800 }}>{title}</h2>
      <p style={{ color: "#5b6b8c", margin: 0 }}>
        This page is coming in {PHASES[title] || "a later phase"} of the Live Chat build. Real-time visitors is live now.
      </p>
    </div>
  );
}
