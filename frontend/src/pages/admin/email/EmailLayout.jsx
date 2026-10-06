import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import emailApi from "../../../api/emailApi";
import { useAdmin } from "../../../context/AdminContext";
import EmailComposer from "./EmailComposer";
import { Icon } from "./EmailParts";
import { EMAIL_BASE, EmailShellContext, FOLDERS, POLL_MS, folderPath } from "./emailUtils";
import "./email.css";

// Where in the module the URL is: a list or a mail page. The selected Mail ID is
// the ?mb= query (older /box/<id>/<folder> links still resolve to it).
function parseLocation(pathname, search, state) {
  const rest = pathname.replace(EMAIL_BASE, "").replace(/^\/+/, "");
  const parts = rest.split("/").filter(Boolean);
  const mbParam = new URLSearchParams(search).get("mb") || "";
  if (parts[0] === "box") return { kind: "list", mbParam: mbParam || parts[1], folder: parts[2] };
  if (parts[0] === "mail") {
    // A mail page keeps the rail on the folder it was opened from.
    const from = String(state?.from || "").replace(EMAIL_BASE, "").split("?")[0].split("/").filter(Boolean);
    return { kind: "mail", mbParam, folder: from[0] === "box" ? from[2] : from[0] };
  }
  return { kind: "list", mbParam, folder: parts[0] };
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

  const here = parseLocation(location.pathname, location.search, location.state);

  // The Mail ID switcher drives every folder. "" = All. No ?mb= → the first active
  // mail ID (Support). Until the mail IDs have loaded nothing is queried.
  const mailboxesReady = mailboxesQ.isSuccess;
  const selectedMailboxId = !mailboxesReady
    ? ""
    : here.mbParam === "all"
      ? ""
      : mailboxes.find((m) => m.id === here.mbParam)?.id || mailboxes[0]?.id || "";
  const mbValue = selectedMailboxId || (mailboxes.length ? "all" : "");
  const selectedMailbox = mailboxes.find((m) => m.id === selectedMailboxId) || null;

  // Unread counts follow one rule everywhere: not opened by any admin in the dashboard
  // and not read in Gmail. /mailboxes returns them per Mail ID (and in total for All).
  const spamCount = selectedMailbox ? selectedMailbox.spam || 0 : counts.spam;
  const receivedCount = selectedMailbox ? selectedMailbox.unread : counts.received;

  // Global search: always lands on a list (the current one, or Received).
  const onSearch = (value) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const onList = here.kind === "list";
      const base = onList ? location.pathname : folderPath("inbox");
      const params = new URLSearchParams(location.search);
      if (!onList) for (const k of [...params.keys()]) if (k !== "mb") params.delete(k);
      params.delete("page");
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      const qs = params.toString();
      navigate(`${base}${qs ? `?${qs}` : ""}`, { replace: true });
    }, 300);
  };

  // Switching the Mail ID keeps the folder and the search text, and drops the filters.
  const chooseMailbox = (id) => {
    clearTimeout(searchTimer.current);
    const params = new URLSearchParams();
    params.set("mb", id);
    if (search.trim()) params.set("q", search.trim());
    const folder = FOLDERS.some((f) => f.id === here.folder) ? here.folder : "inbox";
    navigate(`${EMAIL_BASE}/${folder}?${params.toString()}`);
  };

  const shell = useMemo(
    () => ({
      admin,
      mailboxes,
      mailboxesReady,
      selectedMailboxId,
      mbValue,
      tracking,
      showToast,
      refreshCounts,
      clearSearchText: resetSearch,
      openCompose: () => setCompose({ key: Date.now(), mailboxId: selectedMailboxId }),
    }),
    [admin, mailboxes, mailboxesReady, selectedMailboxId, mbValue, tracking, showToast, refreshCounts, resetSearch]
  );

  const folderCounts = { inbox: receivedCount, spam: spamCount };
  const switcher = [
    ...mailboxes.map((m) => ({ id: m.id, label: m.displayName, title: m.address, color: m.color, unread: m.unread })),
    { id: "all", label: "All", title: "All mail IDs", unread: counts.received },
  ];

  return (
    <EmailShellContext.Provider value={shell}>
      <div className="em-root">
        <div className="em-srow">
          <label className="em-search">
            <Icon name="search" />
            <input type="search" placeholder="Search mail" aria-label="Search mail" value={search} onChange={(e) => onSearch(e.target.value)} />
          </label>

          {mailboxes.length > 0 && (
            <div className="em-mbsw">
              <span className="em-mbsw-lab">Mail ID</span>
              <div className="em-seg" role="group" aria-label="Choose mail ID">
                {switcher.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    title={o.title}
                    aria-pressed={mbValue === o.id}
                    className={mbValue === o.id ? "on" : ""}
                    onClick={() => chooseMailbox(o.id)}
                  >
                    {o.color && <span className="em-dot" style={{ background: o.color }} />}
                    {o.label}
                    {o.unread > 0 && <span className="em-seg-n">{o.unread}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="em-shell">
          <nav className="em-rail" aria-label="Mail folders">
            <button className="em-compose-btn" onClick={() => shell.openCompose()} disabled={!mailboxes.length}>
              <Icon name="compose" />
              Compose
            </button>

            <div className="em-nav">
              {FOLDERS.map((f) => (
                <NavLink
                  key={f.id}
                  to={folderPath(f.id, here.mbParam)}
                  onClick={resetSearch}
                  className={`em-nav-item${here.folder === f.id ? " on" : ""}`}
                >
                  <Icon name={f.id} />
                  <span className="em-lbl">{f.label}</span>
                  <span className={`em-count${f.id === "spam" ? " dim" : ""}`}>{folderCounts[f.id] || ""}</span>
                </NavLink>
              ))}
            </div>

            {mailboxesQ.isSuccess && !mailboxes.length && <div className="em-sub em-rail-note">No mail IDs are set up yet.</div>}
            {/* Super Admin only (the page and its API refuse everyone else too). */}
            {admin?.role === "superadmin" && (
              <Link to={`${EMAIL_BASE}/settings/mail-ids`} className="em-manage">
                <Icon name="mailbox" size={16} />
                Manage Mail IDs
              </Link>
            )}
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
                  navigate(folderPath("sent", message.mailbox?.id || here.mbParam));
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
