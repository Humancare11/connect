import { Component } from "react";

// Route-level safety net for the video call pages. WebRTC setup touches a lot
// of browser APIs (RTCPeerConnection, getUserMedia, MediaStream) that can
// throw in environments we don't fully control (locked-down browsers,
// extensions that shim WebRTC incorrectly, old devices) — without this,
// an uncaught error in that path unmounts the tree and leaves a blank page
// with no explanation and no way to recover except guessing to hit reload.
class CallErrorBoundary extends Component {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    console.error("[video-call] fatal render error", error, info);
  }

  render() {
    if (this.state.crashed) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
            background: "#0d1f35",
            color: "#f1f5f9",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20 }}>Something went wrong</h2>
          <p style={{ margin: 0, color: "#94a3b8", maxWidth: 360 }}>
            The video call crashed unexpectedly. Please reload the page to try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: "9px 22px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CallErrorBoundary;
