import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import emailApi from "../../../api/emailApi";
import { useAdmin } from "../../../context/AdminContext";
import EmailComposer from "./EmailComposer";
import { Icon } from "./EmailParts";
import { EMAIL_BASE, EmailShellContext, FOLDERS, POLL_MS, folderPath } from "./emailUtils";
import "./email.css";

// Where in the module the URL is: a list (optionally inside one mailbox) or a mail page.
function parseLocation(pathname, state) {
  const rest = pathname.replace(EMAIL_BASE, "").replace(/^\/+/, "");
  const parts = rest.split("/").filter(Boolean);
  if (parts[0] === "box") return { kind: "list", mailboxId: parts[1], folder: parts[2] };
  if (parts[0] === "mail") {
    // A mail page keeps the sidebar on the folder it was opened from.
    const m = String(state?.from || "").replace(EMAIL_BASE, "").split("?")[0].split("/").filter(Boolean);
    return m[0] === "box" ? { kind: "mail", mailboxId: m[1], folder: m[2] } : { kind: "mail", mailboxId: "", folder: m[0] };
  }
  return { kind: "list", mailboxId: "", folder: parts[0] };
}

export default function EmailLayout() {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const [compose, setCompose] = useState(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const searchTimer = useRef(null);
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get("q") || "");

  const mailboxesQ = useQuery({
    queryKey: ["email", "mailboxes"],
    queryFn: emailApi.mailboxes,
    refetchInterval: POLL_MS,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const mailboxes = useMemo(() => mailboxesQ.data?.mailboxes || [], [mailboxesQ.data]);
  const counts = mailboxesQ.data?.counts || { received: 0, spam: 0 };
  // Whether open tracking is switched on (the compose forms show "Track opens" only then).
  const trackingData = mailboxesQ.data?.tracking;
  const tracking = useMemo(() => trackingData || { available: false, disclosure: false }, [trackingData]);

  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  // Clears the box and cancels a pending debounced search, so a late timer
  // can't navigate away from the folder just clicked.
  const resetSearch = useCallback(() => {
    clearTimeout(searchTimer.current);
    setSearch("");
  }, []);

  const refreshCounts = useCallback(() => qc.invalidateQueries({ queryKey: ["email", "mailboxes"] }), [qc]);

  const here = parseLocation(location.pathname, location.state);

  // Global search: always lands on a list (the current one, or Received).
  const onSearch = (value) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const base = here.kind === "list" ? location.pathname : folderPath("inbox", here.mailboxId);
      const params = new URLSearchParams(here.kind === "list" ? location.search : "");
      params.delete("page");
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      const qs = params.toString();
      navigate(`${base}${qs ? `?${qs}` : ""}`, { replace: true });
    }, 300);
  };

  const shell = useMemo(
    () => ({
      admin,
      mailboxes,
      tracking,
      showToast,
      refreshCounts,
      clearSearchText: resetSearch,
      openCompose: (mailboxId) => setCompose({ key: Date.now(), mailboxId: mailboxId || here.mailboxId || "" }),
    }),
    [admin, mailboxes, tracking, showToast, refreshCounts, resetSearch, here.mailboxId]
  );

  const unreadByFolder = { inbox: counts.received, spam: counts.spam };
  const folderOn = (id) => here.folder === id && !here.mailboxId;

  return (
    <EmailShellContext.Provider value={shell}>
      <div className="em-root">
        <label className="em-search">
          <Icon name="search" />
          <input type="search" placeholder="Search mail" aria-label="Search mail" value={search} onChange={(e) => onSearch(e.target.value)} />
        </label>

        <div className="em-shell">
          <nav className="em-rail" aria-label="Mail folders">
            <button className="em-compose-btn" onClick={() => shell.openCompose("")} disabled={!mailboxes.length}>
              <Icon name="compose" />
              Compose
            </button>

            <div className="em-nav">
              {FOLDERS.map((f) => (
                <NavLink key={f.id} to={folderPath(f.id)} onClick={resetSearch} className={`em-nav-item${folderOn(f.id) ? " on" : ""}`}>
                  <Icon name={f.id} />
                  <span className="em-lbl">{f.label}</span>
                  <span className="em-count">{unreadByFolder[f.id] || ""}</span>
                </NavLink>
              ))}
            </div>

            <h4>Mail IDs</h4>
            <div className="em-nav">
              {mailboxes.map((m) => (
                <NavLink
                  key={m.id}
                  to={folderPath("inbox", m.id)}
                  title={m.address}
                  onClick={resetSearch}
                  className={`em-nav-item${here.mailboxId === m.id ? " on" : ""}`}
                >
                  <span className="em-box-dot" style={{ background: m.color }} />
                  <span className="em-lbl">{m.address}</span>
                  <span className="em-count">{m.unread || ""}</span>
                </NavLink>
              ))}
              {mailboxesQ.isSuccess && !mailboxes.length && <div className="em-sub" style={{ padding: "6px 24px" }}>No mail IDs are set up yet.</div>}
              {/* Super Admin only (the page and its API refuse everyone else too). */}
              {admin?.role === "superadmin" && (
                <NavLink to={`${EMAIL_BASE}/settings/mail-ids`} className="em-nav-item">
                  <Icon name="mailbox" />
                  <span className="em-lbl">Manage Mail IDs</span>
                </NavLink>
              )}
            </div>
          </nav>

          <section className="em-pane" aria-live="polite">
            <Outlet />
          </section>
        </div>

        {/* Rendered on <body>: the compose window, its backdrop and toasts must sit above
            the admin sidebar, which a position:fixed child of the page area cannot do. */}
        {createPortal(
          <div className="em-root">
            {compose && (
              <EmailComposer
                key={compose.key}
                mailboxes={mailboxes}
                tracking={tracking}
                defaultMailboxId={compose.mailboxId}
                adminName={admin.name}
                onClose={() => setCompose(null)}
                onSent={(message) => {
                  setCompose(null);
                  showToast(`Sent from ${message.mailbox.address} · by ${admin.name}`);
                  qc.invalidateQueries({ queryKey: ["email"] });
                  navigate(folderPath("sent"));
                }}
              />
            )}

            {toast && (
              <div className="em-toast" role="status">
                {toast}
              </div>
            )}
          </div>,
          document.body
        )}
      </div>
    </EmailShellContext.Provider>
  );
}
