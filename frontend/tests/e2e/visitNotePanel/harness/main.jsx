/* eslint-disable react-refresh/only-export-components -- test harness, not part of the app bundle */
// Mounts the REAL VisitNoteEditor the way the call page does (a panel that is opened and closed with a button, with the
// app's real smooth-scroll hook running) and as the Notes page (variant "page"). The doctor's access token comes from ?t=.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import "./base.css";
import VisitNoteEditor from "../../../../src/components/VisitNoteEditor.jsx";
import useLenis from "../../../../src/hooks/useLenis.jsx";
import { setUserAuthToken } from "../../../../src/api.js";

const params = new URLSearchParams(window.location.search);
setUserAuthToken(params.get("t") || "", "", "doctor");
const start = params.get("start") || "/panel/none";

function Panel() {
  const { id } = useParams();
  const [open, setOpen] = useState(true);
  useLenis();
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#020b16" }}>
      <button id="toggle" onClick={() => setOpen((o) => !o)}>{open ? "Close notes" : "Open notes"}</button>
      {open && (
        <div className="hc-vc__notes" style={{ width: 380, height: 420, display: "flex", flexDirection: "column", background: "#081a2f", color: "#e5edf8" }}>
          <VisitNoteEditor key={id} appointmentId={id} variant="panel" />
        </div>
      )}
    </div>
  );
}
const Page = () => {
  const { id } = useParams();
  return <div style={{ padding: 20, maxWidth: 720 }}><VisitNoteEditor key={id} appointmentId={id} variant="page" /></div>;
};

createRoot(document.getElementById("root")).render(
  <MemoryRouter initialEntries={[start]}>
    <Routes>
      <Route path="/panel/:id" element={<Panel />} />
      <Route path="/page/:id" element={<Page />} />
      <Route path="/doctor-dashboard/visit-notes/:id/review" element={<div id="review-page">REVIEW PAGE</div>} />
    </Routes>
  </MemoryRouter>,
);
