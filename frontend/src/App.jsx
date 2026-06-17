// src/App.jsx
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react";
import "./App.css";

import Header from "./components/Header";
import Footer from "./components/Footer";

const Home = lazy(() => import("./pages/Home"));

const About = lazy(() => import("./pages/AboutPage"));

const AskDoctor = lazy(() => import("./pages/AskDoctor"));
const Services = lazy(() => import("./pages/Services"));
const Blogs = lazy(() => import("./pages/Blogs/Blogs"));
const Corporates = lazy(() => import("./pages/Corporates"));
const Contact = lazy(() => import("./pages/Contact"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Login = lazy(() => import("./pages/Login"));
// import Register from "./pages/Register";
const BookAppointment = lazy(() => import("./pages/BookAppointment"));
const VideoCall = lazy(() => import("./pages/VideoCall"));

import socket from "./socket";
import { useAdmin } from "./context/AdminContext";
import { useAuth } from "./context/AuthContext";
import useLenis from "./hooks/useLenis";
import api from "./api";
import {
  ROLE_TIMEOUT_MS,
  SESSION_ACTIVITY_EVENT,
  clearClientSession,
  getActiveSessionRole,
  getLogoutRedirectPath,
} from "./utils/session";

import AboutUs from "./pages/AboutPage"; // about us page
import PrivacyConcerns from "./pages/PrivacyConcerns"; // privacy concerns
// Specialty pages
import SPdemo from "./pages/Specialty/SPeDemo";
// category pages
import ChildFamilyCare from "./pages/Categories/ChildMain";
// condition pages
import Arthritis from "./pages/Conditions/Arthritis";
import CancerSecond from "./pages/Conditions/CancerSecondOpinion";
import ChestPain from "./pages/Conditions/ChestPain";
import ChronicKidney from "./pages/Conditions/ChronicKidneyDisease";
import ChronicMigraine from "./pages/Conditions/ChronicMigraine";
import ComplexDiagnosis from "./pages/Conditions/ComplexDiagnosisReview";
import FattyLiver from "./pages/Conditions/FattyLiver";
import HeartDisease from "./pages/Conditions/HeartDisease";
import HighBloodPressure from "./pages/Conditions/HighBloodPressure";
import HighCholesterol from "./pages/Conditions/HighCholesterol";
import HormoneImblance from "./pages/Conditions/HormoneImbalance";
import MemoryConcerns from "./pages/Conditions/MemoryConcerns";
import Obesity from "./pages/Conditions/Obesity";
import Osteoarthritis from "./pages/Conditions/Osteoarthritis";
import Osteoporosis from "./pages/Conditions/Osteoporosis";
import Palpitations from "./pages/Conditions/Palpitations";
import PostCovidConcerns from "./pages/Conditions/PostCovidConcerns";
import PreOpCardiacClearance from "./pages/Conditions/PreOpCardiacClearance";
import RheumatoidArthritis from "./pages/Conditions/RheumatoidArthritis";
import SeizuresEpilepsyFollowUp from "./pages/Conditions/SeizuresEpilepsyFollowUp";
import SleepApnea from "./pages/Conditions/SleepApnea";
import SurgerySecondOpinion from "./pages/Conditions/SurgerySecondOpinion";
import ThyroidDisorders from "./pages/Conditions/ThyroidDisorders";
import TreatmentPlanReview from "./pages/Conditions/TreatmentPlanReview";
import Tremor from "./pages/Conditions/Tremor";
import TypeTwoDiabetes from "./pages/Conditions/TypeTwoDiabetes";
import AbdominalPain from "./pages/Conditions/AbdominalPain";
import BingeEating from "./pages/Conditions/BingeEating";
import Bloating from "./pages/Conditions/Bloating";
import CholesterolLoweringDiet from "./pages/Conditions/CholesterolLoweringDiet";
import Dehydration from "./pages/Conditions/Dehydration";
import DiabeticDiet from "./pages/Conditions/DiabeticDiet";
import DietExercisePlanning from "./pages/Conditions/DietExercisePlanning";
import FoodIntolerancePlanning from "./pages/Conditions/FoodIntolerancePlanning";
import Gastritis from "./pages/Conditions/Gastritis";
import GlpProgramEligibility from "./pages/Conditions/GlpProgramEligibility";
import HealthyHabitCoaching from "./pages/Conditions/HealthyHabitCoaching";
import Hemorrhoids from "./pages/Conditions/Hemorrhoids";
import Indigestion from "./pages/Conditions/Indigestion";
import IrritableBowelSyndrome from "./pages/Conditions/IrritableBowelSyndrome";
import PregnancyNutrition from "./pages/Conditions/PregnancyNutrition";
import SleepHygiene from "./pages/Conditions/SleepHygiene";
import SportNutrition from "./pages/Conditions/SportsNutrition";
import TravelersDiarrhea from "./pages/Conditions/TravelersDiarrhea";
import MetabolicSyndrome from "./pages/Conditions/MetabolicSyndrome";
import Vomiting from "./pages/Conditions/Vomiting";
import WeightLossPlanning from "./pages/Conditions/WeightLossPlanning";
import BackPain from "./pages/Conditions/BackPain";
import DryEyes from "./pages/Conditions/DryEyes";
import EarInfection from "./pages/Conditions/EarInfection";
import EarPain from "./pages/Conditions/EarPain";
import EyeRedness from "./pages/Conditions/EyeRedness";
import EyeStrain from "./pages/Conditions/EyeStrain";
import Hoarseness from "./pages/Conditions/Hoarseness";
import KneePain from "./pages/Conditions/KneePain";
import MuscleStrain from "./pages/Conditions/MuscleStrain";
import NasalCongestion from "./pages/Conditions/NasalCongestion";
import NeckPain from "./pages/Conditions/NeckPain";
import NumbnessAndTingling from "./pages/Conditions/NumbnessAndTingling";
import Stye from "./pages/Conditions/Stye";
import SwollenFeetAnkles from "./pages/Conditions/SwollenFeetAnkles";
import Tonsillitis from "./pages/Conditions/Tonsillitis";
import JointPain from "./pages/Conditions/JointPain";
import VisionChanges from "./pages/Conditions/VisionChanges";
import ChildhoodAllergies from "./pages/Conditions/ChildhoodAllergies";
import EarPainChildren from "./pages/Conditions/EarPainChildren";
import FeedingConcerns from "./pages/Conditions/FeedingConcerns";
import MildAsthmaSymptoms from "./pages/Conditions/MildAsthmaSymptoms";
import MoodAnxietyTeens from "./pages/Conditions/MoodAnxietyTeens";
import PediatricColdFlu from "./pages/Conditions/PediatricColdFlu";
import PediatricFever from "./pages/Conditions/PediatricFever";
import PinkEyeChildren from "./pages/Conditions/PinkEyeChildren";
import PubertyConcerns from "./pages/Conditions/PubertyConcerns";
import SkinRashChildren from "./pages/Conditions/SkinRashChildren";
import SoreThroatChildren from "./pages/Conditions/SoreThroatChildren";
import SportsInjuries from "./pages/Conditions/SportsInjuries";
import StomachPainChildren from "./pages/Conditions/StomachPainChildren";
import GrowthDevelopment from "./pages/Conditions/GrowthDevelopment";
import VomitingDiarrheaChildren from "./pages/Conditions/VomitingDiarrheaChildren";
import DoctorsNote from "./pages/Conditions/DoctorsNote";
import FollowUpConsultation from "./pages/Conditions/FollowUpConsultation";
import LabResultReview from "./pages/Conditions/LabResultReview";
import MedicalCertificate from "./pages/Conditions/MedicalCertificate";
import MedicationReview from "./pages/Conditions/MedicationReview";
import PrescriptionRefill from "./pages/Conditions/PrescriptionRefill";
import ReturnWorkClearance from "./pages/Conditions/ReturnWorkClearance";
import SecondMedicalOpinion from "./pages/Conditions/SecondMedicalOpinion";
import SpecialistReferral from "./pages/Conditions/SpecialistReferral";
import ChronicMedicationManagement from "./pages/Conditions/ChronicMedicationManagement";
import AllergicRhinitis from "./pages/Conditions/AllergicRhinitis";
import Asthma from "./pages/Conditions/Asthma";
import AsthmaFlareUp from "./pages/Conditions/AsthmaFlareUp";
import Copd from "./pages/Conditions/Copd";
import PersistentCough from "./pages/Conditions/PersistentCough";
import PneumoniaFollowUp from "./pages/Conditions/PneumoniaFollowUp";
import ShortnessOfBreath from "./pages/Conditions/ShortnessBreath";
import UpperRespiratoryInfection from "./pages/Conditions/UpperRespiratoryInfection";
import Wheezing from "./pages/Conditions/Wheezing";
import Chlamydia from "./pages/Conditions/Chlamydia";

// import DoctorRegister from "./pages/doctors/DoctorRegister";
const DoctorLogin = lazy(() => import("./pages/doctors/DoctorLogin"));
const DoctorLayout = lazy(() => import("./pages/doctors/DoctorLayout"));
const Dashbord = lazy(() => import("./pages/doctors/Dashbord"));
const DoctorEnrollments = lazy(
  () => import("./pages/doctors/DoctorEnrollments"),
);
import { useDoctorAuth } from "./context/DoctorAuthContext";
const DoctorProfile = lazy(() => import("./pages/doctors/DoctorProfile"));
// import DoctorPendingApproval from "./pages/doctors/DoctorPendingApproval";
const DoctorAppointments = lazy(
  () => import("./pages/doctors/DoctorAppointments"),
);
const DoctorPatients = lazy(() => import("./pages/doctors/DoctorPatients"));
const DoctorMessages = lazy(() => import("./pages/doctors/DoctorMessages"));
const RaiseTicket = lazy(() => import("./pages/doctors/RaiseTicket"));
const DoctorQnA = lazy(() => import("./pages/doctors/DoctorQnA"));
const DoctorAnalytics = lazy(() => import("./pages/doctors/DoctorAnalytics"));
const DoctorSettings = lazy(() => import("./pages/doctors/DoctorSettings"));
const DoctorProfileForUser = lazy(
  () => import("./pages/doctors/DoctorProfileForUser"),
);

const AdminAuthPage = lazy(() => import("./pages/admin/AdminAuth"));
const PaymentAdminLogin = lazy(() => import("./pages/admin/PaymentAdminLogin"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const OurDoctors = lazy(() => import("./pages/admin/OurDoctors"));
const ManageDoctors = lazy(() => import("./pages/admin/ManageDoctors"));
const AdminDoctorProfile = lazy(
  () => import("./pages/admin/AdminDoctorProfile"),
);
const DoctorPayments = lazy(() => import("./pages/admin/DoctorPayments"));
const ManageUsers = lazy(() => import("./pages/admin/ManageUsers"));
const AdminAppointments = lazy(() => import("./pages/admin/AdminAppointments"));
const AdminAppointmentDetails = lazy(
  () => import("./pages/admin/AdminAppointmentDetails"),
);
const AdminAssignDoctor = lazy(() => import("./pages/admin/AdminAssignDoctor"));
const PaymentLinks = lazy(() => import("./pages/admin/PaymentLinks"));
const PaymentLinkHistory = lazy(
  () => import("./pages/admin/PaymentLinkHistory"),
);
const QnAPage = lazy(() => import("./pages/admin/QnAPage"));
const SupportTickets = lazy(() => import("./pages/admin/SupportTickets"));
const SuperAdminDashboard = lazy(
  () => import("./pages/admin/SuperAdminDashboard"),
);
const AuditLogs = lazy(() => import("./pages/admin/AuditLogs"));
const PricingManagement = lazy(() => import("./pages/admin/PricingManagement"));

const UserLayout = lazy(() => import("./pages/user/UserLayout"));
const Dashboard = lazy(() => import("./pages/user/Dashboard"));
const Appointments = lazy(() => import("./pages/user/Appointments"));
const MedicalQuestions = lazy(() => import("./pages/user/MedicalQuestions"));
const FavouriteDoctors = lazy(() => import("./pages/user/FavouriteDoctors"));
const LabAppointments = lazy(() => import("./pages/user/LabAppointments"));
const ProfileSettings = lazy(() => import("./pages/user/ProfileSettings"));
const ChangePassword = lazy(() => import("./pages/user/ChangePassword"));
const MyRecords = lazy(() => import("./pages/user/MyRecords"));
const UserRaiseTicket = lazy(() => import("./pages/user/RaiseTicket"));

const Home2 = lazy(() => import("./pages/Home-2"));
const Test = lazy(() => import("./pages/Test"));
const PaymentLinkCheckout = lazy(() => import("./pages/PaymentLinkCheckout"));

//Main pages of categories, specialties and conditions
const Specialties = lazy(() => import("./pages/Specialties"));
const Symptoms = lazy(() => import("./pages/Symptoms"));
const Categories = lazy(() => import("./pages/Categories"));

const AppointmentBooking = lazy(() => import("./pages/AppointmentBooking"));
const AppointmentBookingForm = lazy(
  () => import("./pages/AppointmentBookingForm"),
);

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PrivateRoute({ children, allowedRoles, loginPath = "/adminauth" }) {
  const { admin, loading } = useAdmin();

  if (loading) return null;
  if (!admin) return <Navigate to={loginPath} replace />;
  if (!allowedRoles.includes(admin.role))
    return <Navigate to={loginPath} replace />;

  return children;
}

function SessionTimeoutManager() {
  const { user, logout: logoutUser } = useAuth();
  const { doctor, logout: logoutDoctor } = useDoctorAuth();
  const { admin, logout: logoutAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [warningOpen, setWarningOpen] = useState(false);
  const [remaining, setRemaining] = useState(300);

  const role = getActiveSessionRole({ admin, doctor, user });
  const timeoutMs = role ? ROLE_TIMEOUT_MS[role] : ROLE_TIMEOUT_MS.user;
  const warningCountdownMs = 5 * 60 * 1000;
  const warningDelayMs = Math.max(0, timeoutMs - warningCountdownMs);

  const isAuthenticated = Boolean(user || doctor || admin);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let lastActivity = Date.now();
    let warningTimer;
    let logoutTimer;
    let countdownTimer;
    let refreshTimer;

    const logoutAll = async () => {
      clearClientSession();
      await Promise.allSettled([logoutUser(), logoutDoctor(), logoutAdmin()]);
      setWarningOpen(false);
      navigate(getLogoutRedirectPath(role), { replace: true });
    };

    const schedule = () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      clearInterval(countdownTimer);
      setWarningOpen(false);

      warningTimer = setTimeout(() => {
        setWarningOpen(true);
        setRemaining(Math.ceil(warningCountdownMs / 1000));
        countdownTimer = setInterval(() => {
          const seconds = Math.max(
            0,
            Math.ceil((timeoutMs - (Date.now() - lastActivity)) / 1000),
          );
          setRemaining(seconds);
        }, 1000);
      }, warningDelayMs);

      logoutTimer = setTimeout(logoutAll, timeoutMs);
    };

    const markActive = () => {
      lastActivity = Date.now();
      schedule();
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((event) =>
      window.addEventListener(event, markActive, { passive: true }),
    );
    window.addEventListener(SESSION_ACTIVITY_EVENT, markActive);
    window.addEventListener("hc:session-expired", logoutAll);

    refreshTimer = setInterval(
      () => {
        api.post("/api/auth/refresh").catch(() => {});
      },
      10 * 60 * 1000,
    );

    schedule();

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActive));
      window.removeEventListener(SESSION_ACTIVITY_EVENT, markActive);
      window.removeEventListener("hc:session-expired", logoutAll);
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      clearInterval(countdownTimer);
      clearInterval(refreshTimer);
    };
  }, [
    isAuthenticated,
    logoutUser,
    logoutDoctor,
    logoutAdmin,
    navigate,
    role,
    timeoutMs,
    warningDelayMs,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    window.dispatchEvent(new Event(SESSION_ACTIVITY_EVENT));
    return undefined;
  }, [location.pathname, isAuthenticated]);

  if (!warningOpen) return null;

  return (
    <div className="hc-session-warning" role="dialog" aria-modal="true">
      <div className="hc-session-warning__panel">
        <h2>Session expiring</h2>
        <p>
          You will be logged out in {Math.ceil(remaining / 60)} minute(s) due to
          inactivity.
        </p>
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new Event(SESSION_ACTIVITY_EVENT));
            setWarningOpen(false);
          }}
        >
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
    api
      .get(`/api/doctor/enrollment/${doctorId}`)
      .then((res) => setEnrollmentData(res.data || null))
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
    location.pathname.startsWith("/payment-admin") ||
    location.pathname.startsWith("/superadmin") ||
    location.pathname.startsWith("/user") ||
    location.pathname.startsWith("/pay/") ||
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

      <Suspense
        fallback={<main className="hc-route-loading" aria-hidden="true" />}
      >
        <Routes>
          <Route path="/" element={<Home />} />

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
          <Route path="/pay/:token" element={<PaymentLinkCheckout />} />

          {/* SEO-friendly doctor profile: /doctors/12345-doctor-name */}
          <Route path="/doctors/:slug" element={<DoctorProfileForUser />} />
          {/* Legacy redirect: old /doctor/:id links resolve gracefully */}
          <Route
            path="/doctor/:id"
            element={<DoctorProfileForUser legacyId />}
          />

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
            path="/doctor-dashboard/profile"
            element={
              <DoctorLayout>
                <DoctorProfile />
              </DoctorLayout>
            }
          />
          {/* Enrollment is standalone — no sidebar/header until approved */}
          <Route
            path="/doctor-dashboard/enrollments"
            element={<DoctorEnrollmentsWrapper />}
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

          <Route path="/adminauth" element={<AdminAuthPage />} />
          <Route path="/payment-admin-login" element={<PaymentAdminLogin />} />
          <Route
            path="/payment-admin"
            element={<Navigate to="/payment-admin/payment-links" replace />}
          />
          <Route
            path="/payment-admin/payment-links"
            element={
              <PrivateRoute
                allowedRoles={["paymentadmin"]}
                loginPath="/payment-admin-login"
              >
                <AdminLayout>
                  <PaymentLinks />
                </AdminLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/payment-admin/payment-history"
            element={
              <PrivateRoute
                allowedRoles={["paymentadmin"]}
                loginPath="/payment-admin-login"
              >
                <AdminLayout>
                  <PaymentLinkHistory />
                </AdminLayout>
              </PrivateRoute>
            }
          />
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
            path="/admin-dashboard/payment-links"
            element={
              <PrivateRoute allowedRoles={["superadmin"]}>
                <AdminLayout>
                  <PaymentLinks />
                </AdminLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin-dashboard/payment-link-history"
            element={
              <PrivateRoute allowedRoles={["superadmin"]}>
                <AdminLayout>
                  <PaymentLinkHistory />
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
            path="/admin-dashboard/appointments/:id"
            element={
              <PrivateRoute allowedRoles={["admin", "superadmin"]}>
                <AdminLayout>
                  <AdminAppointmentDetails />
                </AdminLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin-dashboard/appointments/:id/assign"
            element={
              <PrivateRoute allowedRoles={["admin", "superadmin"]}>
                <AdminLayout>
                  <AdminAssignDoctor />
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
            path="/superadmin-dashboard/pricing-management"
            element={
              <PrivateRoute allowedRoles={["superadmin"]}>
                <PricingManagement />
              </PrivateRoute>
            }
          />
          <Route path="/video-call/:appointmentId" element={<VideoCall />} />

          {/* ALL*/}
          <Route path="/categories" element={<Categories />} />
          <Route path="/specialties" element={<Specialties />} />
          <Route path="/conditions" element={<Symptoms />} />

          {/* categories */}
          <Route path="/child-family-care" element={<ChildFamilyCare />} />

          {/* specialties */}
          <Route path="/sp-demo" element={<SPdemo />} />

          {/* condition pages */}
          <Route path="/arthritis" element={<Arthritis />} />
          <Route path="/cancer-second-opinion" element={<CancerSecond />} />
          <Route path="/chest-pain" element={<ChestPain />} />
          <Route path="/chronic-kidney-disease" element={<ChronicKidney />} />
          <Route path="/chronic-migraine" element={<ChronicMigraine />} />
          <Route path="/complex-diagnosis" element={<ComplexDiagnosis />} />
          <Route path="/fatty-liver" element={<FattyLiver />} />
          <Route path="/heart-disease" element={<HeartDisease />} />
          <Route path="/high-blood-pressure" element={<HighBloodPressure />} />
          <Route path="/high-cholesterol" element={<HighCholesterol />} />
          <Route path="/hormone-imblance" element={<HormoneImblance />} />
          <Route path="/memory-concerns" element={<MemoryConcerns />} />
          <Route path="/obesity" element={<Obesity />} />
          <Route path="/osteoarthritis" element={<Osteoarthritis />} />
          <Route path="/osteoporosis" element={<Osteoporosis />} />
          <Route path="/palpitations" element={<Palpitations />} />
          <Route path="/post-covid-concerns" element={<PostCovidConcerns />} />
          <Route
            path="/pre-op-cardiac-clearance"
            element={<PreOpCardiacClearance />}
          />
          <Route
            path="/rheumatoid-arthritis"
            element={<RheumatoidArthritis />}
          />
          <Route
            path="/seizures-epilepsy-follow-up"
            element={<SeizuresEpilepsyFollowUp />}
          />
          <Route path="/sleep-apnea" element={<SleepApnea />} />
          <Route
            path="/surgery-second-opinion"
            element={<SurgerySecondOpinion />}
          />
          <Route path="/thyroid-disorders" element={<ThyroidDisorders />} />
          <Route
            path="/treatment-plan-review"
            element={<TreatmentPlanReview />}
          />
          <Route path="/tremor" element={<Tremor />} />
          <Route path="/type-2-diabetes" element={<TypeTwoDiabetes />} />
          <Route path="/abdominal-pain" element={<AbdominalPain />} />
          <Route path="/binge-eating" element={<BingeEating />} />
          <Route path="/bloating" element={<Bloating />} />
          <Route
            path="/cholesterol-lowering-diet"
            element={<CholesterolLoweringDiet />}
          />
          <Route path="/dehydration" element={<Dehydration />} />
          <Route path="/diabetic-diet" element={<DiabeticDiet />} />
          <Route
            path="/diet-exercise-planning"
            element={<DietExercisePlanning />}
          />
          <Route
            path="/food-intolerance-planning"
            element={<FoodIntolerancePlanning />}
          />
          <Route path="/gastritis" element={<Gastritis />} />
          <Route
            path="/glp-program-eligibility"
            element={<GlpProgramEligibility />}
          />
          <Route
            path="/healthy-habit-coaching"
            element={<HealthyHabitCoaching />}
          />
          <Route path="/hemorrhoids" element={<Hemorrhoids />} />
          <Route path="/indigestion" element={<Indigestion />} />
          <Route
            path="/irritable-bowel-syndrome"
            element={<IrritableBowelSyndrome />}
          />
          <Route path="/pregnancy-nutrition" element={<PregnancyNutrition />} />
          <Route path="/sleep-hygiene" element={<SleepHygiene />} />
          <Route path="/sports-nutrition" element={<SportNutrition />} />
          <Route path="/travelers-diarrhea" element={<TravelersDiarrhea />} />
          <Route path="/metabolic-syndrome" element={<MetabolicSyndrome />} />
          <Route path="/vomiting" element={<Vomiting />} />
          <Route
            path="/weight-loss-planning"
            element={<WeightLossPlanning />}
          />
          <Route path="/back-pain" element={<BackPain />} />
          <Route path="/dry-eyes" element={<DryEyes />} />
          <Route path="/ear-infection" element={<EarInfection />} />
          <Route path="/ear-pain" element={<EarPain />} />
          <Route path="/eye-redness" element={<EyeRedness />} />
          <Route path="/eye-strain" element={<EyeStrain />} />
          <Route path="/hoarseness" element={<Hoarseness />} />
          <Route path="/knee-pain" element={<KneePain />} />
          <Route path="/muscle-strain" element={<MuscleStrain />} />
          <Route path="/nasal-congestion" element={<NasalCongestion />} />
          <Route path="/neck-pain" element={<NeckPain />} />
          <Route path="/numbness-tingling" element={<NumbnessAndTingling />} />
          <Route path="/stye" element={<Stye />} />
          <Route path="/swollen-feet-ankles" element={<SwollenFeetAnkles />} />
          <Route path="/tonsillitis" element={<Tonsillitis />} />
          <Route path="/joint-pain" element={<JointPain />} />
          <Route path="/vision-changes" element={<VisionChanges />} />
          <Route path="/childhood-allergies" element={<ChildhoodAllergies />} />
          <Route path="/ear-pain-children" element={<EarPainChildren />} />
          <Route path="/feeding-concerns" element={<FeedingConcerns />} />
          <Route
            path="/mild-asthma-symptoms"
            element={<MildAsthmaSymptoms />}
          />
          <Route path="/mood-anxiety-teens" element={<MoodAnxietyTeens />} />
          <Route path="/pediatric-cold-flu" element={<PediatricColdFlu />} />
          <Route path="/pediatric-fever" element={<PediatricFever />} />
          <Route path="/pink-eye-children" element={<PinkEyeChildren />} />
          <Route path="/puberty-concerns" element={<PubertyConcerns />} />
          <Route path="/skin-rash-children" element={<SkinRashChildren />} />
          <Route
            path="/sore-throat-children"
            element={<SoreThroatChildren />}
          />
          <Route path="/sports-injuries" element={<SportsInjuries />} />
          <Route
            path="/stomach-pain-children"
            element={<StomachPainChildren />}
          />
          <Route path="/growth-development" element={<GrowthDevelopment />} />
          <Route
            path="/vomiting-diarrhea-children"
            element={<VomitingDiarrheaChildren />}
          />
          <Route path="/doctors-note" element={<DoctorsNote />} />
          <Route
            path="/follow-up-consultation"
            element={<FollowUpConsultation />}
          />
          <Route path="/lab-result-review" element={<LabResultReview />} />
          <Route path="/medical-certificate" element={<MedicalCertificate />} />
          <Route path="/medication-review" element={<MedicationReview />} />
          <Route path="/prescription-refill" element={<PrescriptionRefill />} />
          <Route
            path="/return-work-clearance"
            element={<ReturnWorkClearance />}
          />
          <Route
            path="/second-medical-opinion"
            element={<SecondMedicalOpinion />}
          />
          <Route path="/specialist-referral" element={<SpecialistReferral />} />
          <Route
            path="/chronic-medication-management"
            element={<ChronicMedicationManagement />}
          />
          <Route path="/asthma" element={<Asthma />} />
          <Route path="/asthma-flare-up" element={<AsthmaFlareUp />} />

          <Route path="/appointment-booking" element={<AppointmentBooking />} />
          <Route
            path="/appointment-booking/form"
            element={<AppointmentBookingForm />}
          />
          <Route path="/allergic-rhinitis" element={<AllergicRhinitis />} />
          <Route path="/copd" element={<Copd />} />
          <Route path="/persistent-cough" element={<PersistentCough />} />
          <Route path="/pneumonia-follow-up" element={<PneumoniaFollowUp />} />
          <Route path="/shortness-of-breath" element={<ShortnessOfBreath />} />
          <Route
            path="/upper-respiratory-infection"
            element={<UpperRespiratoryInfection />}
          />
          <Route path="/wheezing" element={<Wheezing />} />
          <Route path="/chlamydia" element={<Chlamydia />} />

          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/privacy-concerns" element={<PrivacyConcerns />} />
        </Routes>
        {!hideLayout && <Footer />}
      </Suspense>
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
