// Mounts the admin Appointments list, the admin appointment View page, the doctor's My Appointments page and the patient's
// My Appointments page (no layout, no login) so one test can walk all three roles through a reschedule.
// The first URL comes from ?start=.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "./base.css";
import { ToastProvider } from "../../../../src/components/ui/Toast.jsx";
import { ConfirmProvider } from "../../../../src/components/ui/ConfirmDialog.jsx";
import AdminAppointments from "../../../../src/pages/admin/AdminAppointments.jsx";
import AdminAppointmentDetails from "../../../../src/pages/admin/AdminAppointmentDetails.jsx";
import DoctorAppointments from "../../../../src/pages/doctors/DoctorAppointments.jsx";
import PatientAppointments from "../../../../src/pages/user/Appointments.jsx";
import { AdminContext } from "../../../../src/context/AdminContext.jsx";
import { DoctorAuthProvider } from "../../../../src/context/DoctorAuthContext.jsx";

const params = new URLSearchParams(window.location.search);
const start = params.get("start") || "/admin-dashboard/appointments?tab=all";
const admin = { name: "Test Admin", role: params.get("role") || "admin" };
const Frame = ({ children }) => <div style={{ padding: 24, background: "#f8fafc", minHeight: "100vh" }}>{children}</div>;

createRoot(document.getElementById("root")).render(
  <ToastProvider>
    <ConfirmProvider>
      <AdminContext.Provider value={{ admin, loading: false }}>
        <DoctorAuthProvider>
          <MemoryRouter initialEntries={[start]}>
            <Routes>
              <Route path="/admin-dashboard/appointments" element={<Frame><AdminAppointments /></Frame>} />
              <Route path="/admin-dashboard/appointments/:id" element={<Frame><AdminAppointmentDetails /></Frame>} />
              <Route path="/doctor-dashboard/appointments" element={<Frame><DoctorAppointments /></Frame>} />
              <Route path="/user-dashboard/appointments" element={<Frame><PatientAppointments /></Frame>} />
            </Routes>
          </MemoryRouter>
        </DoctorAuthProvider>
      </AdminContext.Provider>
    </ConfirmProvider>
  </ToastProvider>,
);
