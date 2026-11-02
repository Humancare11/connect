// Mounts the real doctor enrollment wizard (step 1 holds the Change Email panel) the way App.jsx's
// DoctorEnrollmentsWrapper does: it loads the doctor's enrollment from the real API (authenticated by the cookie the test
// logged in with), then renders the wizard. Nothing in src/ is changed.
//   ?doctorId=<the signed-in doctor's id>
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "../../../../src/fonts.css";
import "../../../../src/index.css";
import "../../../../src/App.css";

const doctorId = new URLSearchParams(window.location.search).get("doctorId");

async function main() {
  const [{ default: api }, { default: Wizard }] = await Promise.all([
    import("../../../../src/api.js"),
    import("../../../../src/pages/doctors/DoctorEnrollments.jsx"),
  ]);
  const { data } = await api.get(`/api/doctor/enrollment/${doctorId}`);
  createRoot(document.getElementById("root")).render(
    <MemoryRouter initialEntries={["/doctor-dashboard/enrollments"]}>
      <Wizard doctorId={doctorId} initialData={data} onComplete={() => {}} />
    </MemoryRouter>,
  );
}
main();
