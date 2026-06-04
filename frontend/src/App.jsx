// src/App.jsx
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect, useLayoutEffect, useState } from "react";
import "./App.css";

import Header from "./components/Header";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import About from "./pages/About";
import Findadoctor from "./pages/Findadoctor";
import AskDoctor from "./pages/AskDoctor";
import Services from "./pages/Services";
import Blogs from "./pages/Blogs/Blogs";
import Corporates from "./pages/Corporates";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Login from "./pages/Login";
// import Register from "./pages/Register";
import BookAppointment from "./pages/BookAppointment";
import VideoCall from "./pages/VideoCall";

import socket from "./socket";
import { useAdmin } from "./context/AdminContext";
import { useAuth } from "./context/AuthContext";
import useLenis from "./hooks/useLenis";
import api from "./api";

// import DoctorRegister from "./pages/doctors/DoctorRegister";
import DoctorLogin from "./pages/doctors/DoctorLogin";
import DoctorLayout from "./pages/doctors/DoctorLayout";
import Dashbord from "./pages/doctors/Dashbord";
import DoctorEnrollments from "./pages/doctors/DoctorEnrollments";
import { useDoctorAuth } from "./context/DoctorAuthContext";
import DoctorProfile from "./pages/doctors/DoctorProfile";
import DoctorPendingApproval from "./pages/doctors/DoctorPendingApproval";
import DoctorAppointments from "./pages/doctors/DoctorAppointments";
import DoctorPatients from "./pages/doctors/DoctorPatients";
import DoctorMessages from "./pages/doctors/DoctorMessages";
import RaiseTicket from "./pages/doctors/RaiseTicket";
import DoctorQnA from "./pages/doctors/DoctorQnA";
import DoctorAnalytics from "./pages/doctors/DoctorAnalytics";
import DoctorSettings from "./pages/doctors/DoctorSettings";
import DoctorProfileForUser from "./pages/doctors/DoctorProfileForUser";


import AdminAuthPage from "./pages/admin/AdminAuth";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import OurDoctors from "./pages/admin/OurDoctors";
import ManageDoctors from "./pages/admin/ManageDoctors";
import AdminDoctorProfile from "./pages/admin/AdminDoctorProfile";
import DoctorPayments from "./pages/admin/DoctorPayments";
import ManageUsers from "./pages/admin/ManageUsers";
import AdminAppointments from "./pages/admin/AdminAppointments";
import AdminPayments from "./pages/admin/AdminPayments";
import QnAPage from "./pages/admin/QnAPage";
import SupportTickets from "./pages/admin/SupportTickets";
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import AuditLogs from "./pages/admin/AuditLogs";
import SecurityIncidents from "./pages/admin/SecurityIncidents";

import UserLayout from "./pages/user/UserLayout";
import Dashboard from "./pages/user/Dashboard";
import Appointments from "./pages/user/Appointments";
import MedicalQuestions from "./pages/user/MedicalQuestions";
import FavouriteDoctors from "./pages/user/FavouriteDoctors";
import LabAppointments from "./pages/user/LabAppointments";
import ProfileSettings from "./pages/user/ProfileSettings";
import ChangePassword from "./pages/user/ChangePassword";
import MyRecords from "./pages/user/MyRecords";
import UserRaiseTicket from "./pages/user/RaiseTicket";

import Home2 from "./pages/Home-2";
import Test from "./pages/Test";

// 
import Specialties from "./pages/Specialties";
import Symptoms from "./pages/Symptoms";
// Specialty pages
import Specialty1 from "./pages/Specialty/SpecialtyDetail";
import Specialty2 from "./pages/Specialty/PrimaryCare";


function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PrivateRoute({ children, allowedRoles }) {
  const { admin, loading } = useAdmin();

  if (loading) return null;
  if (!admin) return <Navigate to="/adminauth" replace />;
  if (!allowedRoles.includes(admin.role))
    return <Navigate to="/adminauth" replace />;

  return children;
}

function SessionTimeoutManager() {
  const { user, logout: logoutUser } = useAuth();
  const { doctor, logout: logoutDoctor } = useDoctorAuth();
  const { admin, logout: logoutAdmin } = useAdmin();
  const navigate = useNavigate();
  const [warningOpen, setWarningOpen] = useState(false);
  const [remaining, setRemaining] = useState(300);

  const isAuthenticated = Boolean(user || doctor || admin);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let lastActivity = Date.now();
    let warningTimer;
    let logoutTimer;
    let countdownTimer;
    let refreshTimer;

    const logoutAll = async () => {
      await Promise.allSettled([logoutUser(), logoutDoctor(), logoutAdmin()]);
      setWarningOpen(false);
      navigate("/login", { replace: true });
    };

    const schedule = () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      clearInterval(countdownTimer);
      setWarningOpen(false);

      warningTimer = setTimeout(() => {
        setWarningOpen(true);
        setRemaining(300);
        countdownTimer = setInterval(() => {
          const seconds = Math.max(0, Math.ceil((30 * 60 * 1000 - (Date.now() - lastActivity)) / 1000));
          setRemaining(seconds);
        }, 1000);
      }, 25 * 60 * 1000);

      logoutTimer = setTimeout(logoutAll, 30 * 60 * 1000);
    };

    const markActive = () => {
      lastActivity = Date.now();
      schedule();
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, markActive, { passive: true }));
    window.addEventListener("hc:session-expired", logoutAll);

    refreshTimer = setInterval(() => {
      api.post("/api/auth/refresh").catch(() => {});
    }, 10 * 60 * 1000);

    schedule();

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActive));
      window.removeEventListener("hc:session-expired", logoutAll);
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      clearInterval(countdownTimer);
      clearInterval(refreshTimer);
    };
  }, [isAuthenticated, logoutUser, logoutDoctor, logoutAdmin, navigate]);

  if (!warningOpen) return null;

  return (
    <div className="hc-session-warning" role="dialog" aria-modal="true">
      <div className="hc-session-warning__panel">
        <h2>Session expiring</h2>
        <p>You will be logged out in {Math.ceil(remaining / 60)} minute(s) due to inactivity.</p>
        <button type="button" onClick={() => api.post("/api/auth/refresh").then(() => setWarningOpen(false))}>
          Stay signed in
        </button>
      </div>
    </div>
  );
}

// Standalone wrapper — no DoctorLayout. The enrollment wizard has its own UI.
function DoctorEnrollmentsWrapper() {
  const { doctor, loading, updateDoctor } = useDoctorAuth();
  const navigate = useNavigate();
  const [enrollmentData, setEnrollmentData] = useState(null);
  const [fetchDone, setFetchDone] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!doctor) {
      navigate("/doctor-login", { replace: true });
      return;
    }
    const doctorId = doctor._id || doctor.id;
    api.get(`/api/doctor/enrollment/${doctorId}`)
      .then(res => setEnrollmentData(res.data || null))
      .catch(() => {})
      .finally(() => setFetchDone(true));
  }, [doctor, loading, navigate]);

  if (loading || !fetchDone) return null;

  const doctorId = doctor?._id || doctor?.id;

  const handleComplete = (data) => {
    setEnrollmentData(data);
    const approved = data?.approvalStatus === "approved";
    updateDoctor({ ...doctor, isEnrolled: approved });
  };

  return (
    <DoctorEnrollments
      doctorId={doctorId}
      initialData={enrollmentData}
      onComplete={handleComplete}
    />
  );
}

function AppLayout() {
  const location = useLocation();

  const hideLayout =
    location.pathname.startsWith("/doctor-dashboard") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/superadmin") ||
    location.pathname.startsWith("/user") ||
    location.pathname.startsWith("/video-call");

  const { user } = useAuth();
  const { doctor } = useDoctorAuth();

  useEffect(() => {
    if (user?._id) {
      if (!socket.connected) socket.connect();
      socket.emit("user-online", { userId: user._id, role: user.role });
    }
  }, [user]);

  useEffect(() => {
    if (doctor?._id || doctor?.id) {
      const doctorId = doctor._id || doctor.id;
      if (!socket.connected) socket.connect();
      socket.emit("user-online", { userId: doctorId, role: "doctor" });
    }
  }, [doctor]);

  return (
    <>
      <ScrollToTop />
      <SessionTimeoutManager />
      {!hideLayout && <Header />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/find-a-doctor" element={<Findadoctor />} />
        <Route path="/ask-a-question" element={<AskDoctor />} />
        <Route path="/medical-services" element={<Services />} />
        <Route path="/blogs" element={<Blogs />} />
        <Route path="/corporates" element={<Corporates />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/login" element={<Login />} />
        {/* <Route path="/register" element={<Register />} /> */}
        <Route path="/book-appointment" element={<BookAppointment />} />
        <Route path="/home-demo" element={<Home2 />} />
        <Route path="/test" element={<Test />} />


{/* SEO-friendly doctor profile: /doctors/12345-doctor-name */}
        <Route path="/doctors/:slug" element={<DoctorProfileForUser />} />
        {/* Legacy redirect: old /doctor/:id links resolve gracefully */}
        <Route path="/doctor/:id" element={<DoctorProfileForUser legacyId />} />

        <Route
          path="/user/dashboard"
          element={
            <UserLayout>
              <Dashboard />
            </UserLayout>
          }
        />
        <Route
          path="/user/appointments"
          element={
            <UserLayout>
              <Appointments />
            </UserLayout>
          }
        />
        <Route
          path="/user/medical-questions"
          element={
            <UserLayout>
              <MedicalQuestions />
            </UserLayout>
          }
        />
        <Route
          path="/user/favourite-doctors"
          element={
            <UserLayout>
              <FavouriteDoctors />
            </UserLayout>
          }
        />
        <Route
          path="/user/lab-appointments"
          element={
            <UserLayout>
              <LabAppointments />
            </UserLayout>
          }
        />
        <Route
          path="/user/profile-settings"
          element={
            <UserLayout>
              <ProfileSettings />
            </UserLayout>
          }
        />
        <Route
          path="/user/change-password"
          element={
            <UserLayout>
              <ChangePassword />
            </UserLayout>
          }
        />
        <Route
          path="/user/my-records"
          element={
            <UserLayout>
              <MyRecords />
            </UserLayout>
          }
        />
        <Route
          path="/user/raise-ticket"
          element={
            <UserLayout>
              <UserRaiseTicket />
            </UserLayout>
          }
        />

        <Route
          path="/profile"
          element={<Navigate to="/user/dashboard" replace />}
        />

        {/* <Route path="/doctor-register" element={<DoctorRegister />} /> */}
        <Route path="/doctor-login" element={<DoctorLogin />} />
        <Route path="/doctor-pending" element={<DoctorPendingApproval />} />

        <Route
          path="/doctor-dashboard"
          element={
            <DoctorLayout>
              <Dashbord />
            </DoctorLayout>
          }
        />
        <Route
          path="/doctor-dashboard/profile"
          element={
            <DoctorLayout>
              <DoctorProfile />
            </DoctorLayout>
          }
        />
        {/* Enrollment is standalone — no sidebar/header until approved */}
        <Route path="/doctor-dashboard/enrollments" element={<DoctorEnrollmentsWrapper />} />
        <Route
          path="/doctor-dashboard/appointments"
          element={
            <DoctorLayout>
              <DoctorAppointments />
            </DoctorLayout>
          }
        />
        <Route
          path="/doctor-dashboard/patients"
          element={
            <DoctorLayout>
              <DoctorPatients />
            </DoctorLayout>
          }
        />
        <Route
          path="/doctor-dashboard/messages"
          element={
            <DoctorLayout>
              <DoctorMessages />
            </DoctorLayout>
          }
        />
        <Route
          path="/doctor-dashboard/raise-ticket"
          element={
            <DoctorLayout>
              <RaiseTicket />
            </DoctorLayout>
          }
        />
        <Route
          path="/doctor-dashboard/qna"
          element={
            <DoctorLayout>
              <DoctorQnA />
            </DoctorLayout>
          }
        />
        <Route
          path="/doctor-dashboard/analytics"
          element={
            <DoctorLayout>
              <DoctorAnalytics />
            </DoctorLayout>
          }
        />
        <Route
          path="/doctor-dashboard/settings"
          element={
            <DoctorLayout>
              <DoctorSettings />
            </DoctorLayout>
          }
        />

        <Route path="/adminauth" element={<AdminAuthPage />} />
        <Route
          path="/admin-auth"
          element={<Navigate to="/adminauth" replace />}
        />
        <Route
          path="/admin-dashboard"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/our-doctors"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <OurDoctors />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/doctors/:slug"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <DoctorProfileForUser adminView />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/manage-doctors"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <ManageDoctors />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/doctor-profile/:id"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <AdminDoctorProfile />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/doctor-payments"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <DoctorPayments />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/manage-users"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <ManageUsers />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/appointments"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <AdminAppointments />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/payments"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <AdminPayments />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/qna"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <QnAPage />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/tickets"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <SupportTickets />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/superadmin-dashboard"
          element={
            <PrivateRoute allowedRoles={["superadmin"]}>
              <SuperAdminDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/audit-logs"
          element={
            <PrivateRoute allowedRoles={["superadmin"]}>
              <AdminLayout>
                <AuditLogs />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/security-incidents"
          element={
            <PrivateRoute allowedRoles={["superadmin"]}>
              <AdminLayout>
                <SecurityIncidents />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route path="/video-call/:appointmentId" element={<VideoCall />} />

        {/* Specialties */}
     <Route path="/specialty" element={<Specialties />} />
     <Route path="/symptoms" element={<Symptoms />} />
     <Route path="/Specialty1" element={<Specialty1 />} />
     <Route path="/Specialty2" element={<Specialty2 />} />




      </Routes>
      {!hideLayout && <Footer />}


      
    </>
  );
}

export default function App() {
  useLenis();

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
