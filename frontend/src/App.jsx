// src/App.jsx
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
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

// import DoctorRegister from "./pages/doctors/DoctorRegister";
import DoctorLogin from "./pages/doctors/DoctorLogin";
import DoctorLayout from "./pages/doctors/DoctorLayout";
import Dashbord from "./pages/doctors/Dashbord";
import DoctorEnrollments from "./pages/doctors/DoctorEnrollments";
import { useDoctorAuth } from "./context/DoctorAuthContext";
import DoctorAppointments from "./pages/doctors/DoctorAppointments";
import DoctorPatients from "./pages/doctors/DoctorPatients";
import DoctorMessages from "./pages/doctors/DoctorMessages";
import RaiseTicket from "./pages/doctors/RaiseTicket";
import DoctorQnA from "./pages/doctors/DoctorQnA";
import DoctorAnalytics from "./pages/doctors/DoctorAnalytics";
import DoctorSettings from "./pages/doctors/DoctorSettings";

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

import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageDoctors from "./pages/admin/ManageDoctors";
import ManageUsers from "./pages/admin/ManageUsers";
import AdminAppointments from "./pages/admin/AdminAppointments";
import AdminQnA from "./pages/admin/QnAPage";
import AdminTickets from "./pages/admin/SupportTickets";
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import AdminAuth from "./pages/admin/AdminAuth";

import Home2 from "./pages/Home-2";
import Test from "./pages/Test";



// import MDemo from "./pages/MDemo";

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

function DoctorEnrollmentsWrapper() {
  const { doctor, updateDoctor } = useDoctorAuth();
  const [enrollmentData, setEnrollmentData] = useState(null);
  const [fetchDone, setFetchDone] = useState(false);

  useEffect(() => {
    if (!doctor) return;
    const doctorId = doctor._id || doctor.id;
    api.get(`/api/doctor/enrollment/${doctorId}`)
      .then(res => setEnrollmentData(res.data || null))
      .catch(() => {})
      .finally(() => setFetchDone(true));
  }, [doctor]);

  if (!fetchDone) return null;

  const doctorId = doctor?._id || doctor?.id;

  const handleComplete = (data) => {
    setEnrollmentData(data);
    updateDoctor({ ...doctor, isEnrolled: true });
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

  useEffect(() => {
    if (user?._id) {
      if (!socket.connected) socket.connect();
      socket.emit("user-online", { userId: user._id, role: user.role });
    }
  }, [user]);

  return (
    <>
      <ScrollToTop />
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

        {/* <Route path="/m" element={<MDemo />} /> */}

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

        <Route
          path="/doctor-dashboard"
          element={
            <DoctorLayout>
              <Dashbord />
            </DoctorLayout>
          }
        />
        <Route
          path="/doctor-dashboard/enrollments"
          element={
            <DoctorLayout>
              <DoctorEnrollmentsWrapper />
            </DoctorLayout>
          }
        />
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

        <Route path="/video-call/:appointmentId" element={<VideoCall />} />

        <Route path="/adminauth" element={<AdminAuth />} />
        {/* Compatibility redirect for older/alternate URL */}
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
          path="/admin-dashboard/qna"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <AdminQnA />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard/tickets"
          element={
            <PrivateRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout>
                <AdminTickets />
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
        <Route path="/home-demo" element={<Home2 />} />
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
