import { Component } from "react";
import "./ErrorBoundary.css";

// Catches render errors below it and shows a recoverable fallback instead of a blank page.
// `resetKey` (e.g. the current pathname) clears the error when it changes, so navigating away recovers.
export default class ErrorBoundary extends Component {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    console.error("[ui] render error", error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.crashed && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ crashed: false });
    }
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="hc-eb" role="alert">
        <h1 className="hc-eb__title">Something went wrong</h1>
        <p className="hc-eb__text">
          An unexpected error occurred while showing this page. Reloading usually fixes it.
        </p>
        <div className="hc-eb__actions">
          <button type="button" className="hc-eb__btn" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a className="hc-eb__link" href="/">
            Go to Home
          </a>
        </div>
      </div>
    );
  }
}
