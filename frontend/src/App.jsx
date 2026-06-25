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
const AskDoctor = lazy(() => import("./pages/AskDoctor"));
const Services = lazy(() => import("./pages/Services"));
const Blogs = lazy(() => import("./pages/Blogs/Blogs"));
const Corporates = lazy(() => import("./pages/Corporates"));
const Contact = lazy(() => import("./pages/Contact"));

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

// Specialty pages
// import SPdemo from "./pages/Specialty/SPeDemo";
import AboutPage from "./pages/AboutPage";
import PCP from "./pages/PCP";

// privacy concerns
import PrivacyConcerns from "./pages/Privacy Policies/PrivacyConcerns";
import PatientPrivacyNotice from "./pages/Privacy Policies/PatientPrivacyNotice";
import PrivacyPolicy from "./pages/Privacy Policies/PrivacyPolicy";
import ProviderTermsofService from "./pages/Privacy Policies/ProviderTermsofService";
import RefundCancellation from "./pages/Privacy Policies/RefundCancellation";
import TeleHealthConsent from "./pages/Privacy Policies/TeleHealthConsent";
import TermsService from "./pages/Privacy Policies/TermsService";
import AccessibilityStatement from "./pages/Privacy Policies/AccessibilityStatement";
import CCPA from "./pages/Privacy Policies/CCPA";
import NOTICE from "./pages/Privacy Policies/NoticePrivacy";
import CookiePolicy from "./pages/Privacy Policies/CookiePolicy";
import PatientInformedConsentForm from "./pages/Privacy Policies/PatientInformedConsentForm";
import PhysicianCredentialingPolicy from "./pages/Privacy Policies/PhysicianCredentialingPolicy";
import TeleconsultationWorkflowPolicy from "./pages/Privacy Policies/TeleconsultationWorkflowPolicy";
import PrescriptionHandlingPolicy from "./pages/Privacy Policies/PrescriptionHandlingPolicy";
import TelehealthProviderAgreement from "./pages/Privacy Policies/TelehealthProviderAgreement";

// category pages
// import ChildCare from "./pages/Categories/ChildMain";
import ChildFamilyCare from "./pages/Categories/ChildFamilyCare";
import ChronicCareExpertOpinion from "./pages/Categories/ChronicCareExpertOpinion";
import EyeEarBone from "./pages/Categories/EyeEarBone";
import GeneralEverydayCare from "./pages/Categories/GeneralEverydayCare";
import MenHealth from "./pages/Categories/MenHealth";
import MentalHealth from "./pages/Categories/MentalHealth";
// import Sexualhealth from "./pages/Categories/SexualHealth";
import Sexual_Health from "./pages/Categories/Sexual-Health";
import SkinHair from "./pages/Categories/SkinHair";
import TravelGlobalCare from "./pages/Categories/TravelGlobalCare";
import WeightNurtrition from "./pages/Categories/WeightNutrition";
import WomenHealth from "./pages/Categories/WomenHealth";
// Specialty pages
// import SD from "./pages/Specialty/SD";

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
import LabResultsReview from "./pages/Conditions/LabResultReview";
import MedicalCertificate from "./pages/Conditions/MedicalCertificate";
import MedicationReview from "./pages/Conditions/MedicationReview";
import PrescriptionRefill from "./pages/Conditions/PrescriptionRefill";
import ReturnWorkClearance from "./pages/Conditions/ReturnWorkClearance";
import SecondMedicalOpinion from "./pages/Conditions/SecondMedicalOpinion";
import SpecialistReferral from "./pages/Conditions/SpecialistReferral";
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
import GenitalItching from "./pages/Conditions/GenitalItching";
import GenitalRash from "./pages/Conditions/GenitalRash";
import Gonorrhea from "./pages/Conditions/Gonorrhea";
import Herpes from "./pages/Conditions/Herpes";
import HivPreventionGuidance from "./pages/Conditions/HivPreventionGuidance";
import PartnerExposureConcerns from "./pages/Conditions/PartnerExposureConcerns";
import SafeSexCounseling from "./pages/Conditions/SafeSexCounseling";
import StiConsultation from "./pages/Conditions/StiConsultation";
import Acne from "./pages/Conditions/Acne";
import AthletesFoot from "./pages/Conditions/AthletesFoot";
import Cellulitis from "./pages/Conditions/Cellulitis";
import ColdSores from "./pages/Conditions/ColdSores";
import ContactDermatitis from "./pages/Conditions/ContactDermatitis";
import Eczema from "./pages/Conditions/Conditions/Eczema";
import FungalSkinInfection from "./pages/Conditions/Conditions/FungalSkinInfection";
import HairLoss1 from "./pages/Conditions/Conditions/HairLoss";
import Hives from "./pages/Conditions/Conditions/Hives";
import ItchySkin from "./pages/Conditions/Conditions/ItchySkin";
import MoleSkinChecks from "./pages/Conditions/Conditions/MoleSkinChecks";
import NailProblems from "./pages/Conditions/Conditions/NailProblems";
import Psoriasis from "./pages/Conditions/Conditions/Psoriasis";
import Ringworm from "./pages/Conditions/Conditions/Ringworm";
import Shingles from "./pages/Conditions/Conditions/Shingles";
import Rosacea from "./pages/Conditions/Conditions/Rosacea";
import SkinRash from "./pages/Conditions/Conditions/SkinRash";
import Warts from "./pages/Conditions/Conditions/Warts";
import AltitudeSickness from "./pages/Conditions/Conditions/AltitudeSickness";
import CrossBorderConsultation from "./pages/Conditions/Conditions/CrossBorderConsultation";
import EmergencyTeleconsultationAbroad from "./pages/Conditions/Conditions/EmergencyTeleconsultationAbroad";
import FitnessTravelEvaluation from "./pages/Conditions/Conditions/FitnessTravelEvaluation";
import FoodPoisoningWhileTraveling from "./pages/Conditions/Conditions/FoodPoisoningWhileTraveling";
import InternationalMedicalAssistance from "./pages/Conditions/Conditions/InternationalMedicalAssistance";
import JetLag from "./pages/Conditions/Conditions/JetLag";
import MalariaPrevention from "./pages/Conditions/Conditions/MalariaPrevention";
import MedicationRefillTraveling from "./pages/Conditions/Conditions/MedicationRefillTraveling";
import MotionSickness from "./pages/Conditions/Conditions/MotionSickness";
import PostTravelSymptoms from "./pages/Conditions/Conditions/PostTravelSymptoms";
import PreTravelVaccinations from "./pages/Conditions/Conditions/PreTravelVaccination";
import ReferralCoordinationOverseas from "./pages/Conditions/Conditions/ReferralCoordinationOverseas";
import TravelMedicalCertificate from "./pages/Conditions/Conditions/TravelMedicalCertificate";
import TravelRelatedFever from "./pages/Conditions/Conditions/TravelRelatedFever";
import TravelersDiarrhea1 from "./pages/Conditions/Conditions/TravelersDiarrhea";
import AcidRefluxGerd from "./pages/Conditions/Conditions/AcidRefluxGerd";
import BodyAches from "./pages/Conditions/Conditions/BodyAches";
import Bronchitis from "./pages/Conditions/Conditions/Bronchitis";
import ColdAndFlu from "./pages/Conditions/Conditions/ColdAndFlu";
import Constipation from "./pages/Conditions/Conditions/Constipation";
import Cough from "./pages/Conditions/Conditions/Cough";
import Covid19 from "./pages/Conditions/Conditions/Covid19";
import Diarrhea from "./pages/Conditions/Conditions/Diarrhea";
import Dizziness from "./pages/Conditions/Conditions/Dizziness";
import EarInfection1 from "./pages/Conditions/Conditions/EarInfection";
import Fatigue from "./pages/Conditions/Conditions/Fatigue";
import Fever from "./pages/Conditions/Conditions/Fever";
import FoodPoisoning from "./pages/Conditions/Conditions/FoodPoisoning";
import Headache from "./pages/Conditions/Conditions/Headache";
import InsectBites from "./pages/Conditions/Conditions/InsectBites";
import Migraine from "./pages/Conditions/Conditions/Migraine";
import MinorBurns from "./pages/Conditions/Conditions/MinorBurns";
import MinorInfections from "./pages/Conditions/Conditions/MinorInfections";
import MultiSystemComplaints from "./pages/Conditions/Conditions/MultiSystemComplaints";
import NauseaAndVomiting from "./pages/Conditions/Conditions/NauseaAndVomiting";
import PinkEye from "./pages/Conditions/Conditions/PinkEye";
import PreventiveScreening from "./pages/Conditions/Conditions/PreventiveScreening";
import RoutineCheckUps from "./pages/Conditions/Conditions/RoutineCheckUps";
import SeasonalAllergies from "./pages/Conditions/Conditions/SeasonalAllergies";
import SinusInfection from "./pages/Conditions/Conditions/SinusInfection";
import SoreThroat from "./pages/Conditions/Conditions/SoreThroat";
import StrepThroat from "./pages/Conditions/Conditions/StrepThroat";
import UndiagnosedSymptoms from "./pages/Conditions/Conditions/UndiagnosedSymptoms";
import VaccinationAdvice from "./pages/Conditions/Conditions/VaccinationAdvice";
import WholeFamilyIllnesses from "./pages/Conditions/Conditions/WholeFamilyIllnesses";
import BladderInfection from "./pages/Conditions/Conditions/BladderInfection";
import BloodInUrine from "./pages/Conditions/Conditions/BloodInUrine";
import BurningUrination from "./pages/Conditions/Conditions/BurningUrination";
import FrequentUrination from "./pages/Conditions/Conditions/FrequentUrination";
import KidneyStones from "./pages/Conditions/Conditions/KidneyStones";
import UrinaryIncontinence from "./pages/Conditions/Conditions/UrinaryIncontinence";
import UrinaryTractInfection from "./pages/Conditions/Conditions/UrinaryTractInfection";
import BacterialVaginosis from "./pages/Conditions/Conditions/BacterialVaginosis";
import BirthControlConsultation from "./pages/Conditions/Conditions/BirthControlConsultation";
import EmergencyContraceptionGuidance from "./pages/Conditions/Conditions/EmergencyContraceptionGuidance";
import HeavyPeriods from "./pages/Conditions/Conditions/HeavyPeriods";
import IrregularPeriods from "./pages/Conditions/Conditions/IrregularPeriods";
import LatchProblems from "./pages/Conditions/Conditions/LatchProblems";
import LowMilkSupply from "./pages/Conditions/Conditions/LowMilkSupply";
import MenopauseSymptoms from "./pages/Conditions/Conditions/MenopauseSymptoms";
import MenstrualCramps from "./pages/Conditions/Conditions/MenstrualCramps";
import NipplePain from "./pages/Conditions/Conditions/NipplePain";
import Pcos from "./pages/Conditions/Conditions/Pcos";
import PelvicPain from "./pages/Conditions/Conditions/PelvicPain";
import PerinatalAnxiety from "./pages/Conditions/Conditions/PerinatalAnxiety";
import Pmdd from "./pages/Conditions/Conditions/Pmdd";
import PostnatalDepression from "./pages/Conditions/Conditions/PostnatalDepression";
import PostpartumConcerns from "./pages/Conditions/Conditions/PostpartumConcerns";
import PregnancyRelatedQuestions from "./pages/Conditions/Conditions/PregnancyRelatedQuestions";
import PrenatalConsultation from "./pages/Conditions/Conditions/PrenatalConsultation";
import VaginalYeastInfection from "./pages/Conditions/Conditions/VaginalYeastInfection";
import WeaningGuidance from "./pages/Conditions/Conditions/WeaningGuidance";
import BladderProblems1 from "./pages/Conditions/Conditions/BladderProblems";
import ErectileDysfunction1 from "./pages/Conditions/Conditions/ErectileDysfunction";
import HairLossMensHealth from "./pages/Conditions/Conditions/HairLossMensHealth";
import LowLibido1 from "./pages/Conditions/Conditions/LowLibido";
import LowTestosteroneSymptoms1 from "./pages/Conditions/Conditions/LowTestosteroneSymptoms";
import MensWellnessConsultation1 from "./pages/Conditions/Conditions/MensWellnessConsultation";
import PrematureEjaculation1 from "./pages/Conditions/Conditions/PrematureEjaculation";
import ProstateHealth1 from "./pages/Conditions/Conditions/ProstateHealth";
import UrinarySymptomsMen1 from "./pages/Conditions/Conditions/UrinarySymptomsMen";
import Vertigo from "./pages/Conditions/Conditions/Vertigo";

// ----------Speciality Pages-------------------
import AdolescentMedicine from "./pages/Specialty/Children&FamilyCare/AdolescentMedicine";
import Pediatrics from "./pages/Specialty/Children&FamilyCare/Pediatrics";
import Cardiology from "./pages/Specialty/ChronicCare&ExpertOpinion/Cardiology";
import ExpertMedicalOpinion from "./pages/Specialty/ChronicCare&ExpertOpinion/ExpertMedicalOpinion";
import Gastroenterology from "./pages/Specialty/ChronicCare&ExpertOpinion/Gastroenterology";
import Neurology from "./pages/Specialty/ChronicCare&ExpertOpinion/Neurology";
import Pulmonology from "./pages/Specialty/ChronicCare&ExpertOpinion/Pulmonology";
import Ent from "./pages/Specialty/EyeEarAndBone/Ent";
import Ophthalmology from "./pages/Specialty/EyeEarAndBone/Ophthalmology";
import Orthopedics from "./pages/Specialty/EyeEarAndBone/Orthopedics";
import MensHealth from "./pages/Specialty/MensHealth/MensHealth";
import Urology from "./pages/Specialty/MensHealth/Urology";
import BehavioralHealth from "./pages/Specialty/MentalHealth/BehavioralHealth";
import Psychiatry from "./pages/Specialty/MentalHealth/Psychiatry";
import PsychologyCounseling from "./pages/Specialty/MentalHealth/PsychologyCounseling";
import SexualHealthSpeciality from "./pages/Specialty/SexualHealth/SexualHealthSpeciality";
import Dermatology from "./pages/Specialty/SkinAndHair/Dermatology";
import GlobalCrossBorderCare from "./pages/Specialty/TravelAndGlobalCare/GlobalCrossBorderCare";
import TravelMedicine from "./pages/Specialty/TravelAndGlobalCare/TravelMedicine";
import WeightManagement from "./pages/Specialty/WeightAndNutrition/WeightManagement";
import LifestyleMedicine from "./pages/Specialty/WeightAndNutrition/LifestyleMedicine";
import NutritionAndDietetics from "./pages/Specialty/WeightAndNutrition/NutritionAndDietetics";
import FamilyMedicine from "./pages/Specialty/General&EverydayCare/FamilyMedicine";
import GeneralPhysician from "./pages/Specialty/General&EverydayCare/GeneralPhysician";
import InternalMedicine from "./pages/Specialty/General&EverydayCare/InternalMedicine";
import MenopauseCare from "./pages/Specialty/Women'sHealth/MenopauseCare";
import WomenMentalHealth from "./pages/Specialty/Women'sHealth/WomenMentalHealth";
import LactationConsulting from "./pages/Specialty/Women'sHealth/LactationConsulting";
import ObstetricsGynaecology from "./pages/Specialty/Women'sHealth/ObstetricsGynaecology";

// -------------------------Services Pages-------------------------
// import OnlinePrescriptionRefills from "./pages/NewServices/OnlinePrescriptionRefills";
// import OnlinePrescriptionRefills from "./pages/NewServices/OnlinePrescriptionRefills";


// -------------------------Services Pages-------------------------
import OnlinePrescriptionRefills from "./pages/NewServices/OnlinePrescriptionRefills";
import ChronicCareManagement from "./pages/NewServices/ChronicCareManagment";
import GeneralConsultation from "./pages/NewServices/GeneralConsultation";
import MentalHealthSupport from "./pages/NewServices/MentalHealthSupport";
import SexualHealth from "./pages/NewServices/SexualHealth";
import WeightLossPrograms from "./pages/NewServices/WeightLossPrograms";

import FittoFly from "./pages/NewServices/FittoFly";
import LABREQUISITIONS from "./pages/NewServices/LABREQUISITIONS";
import DoctorNote from "./pages/NewServices/DoctorNote";
// Services
import ServiceDemo from "./pages/NewServices/ServiceDemo";

// import DoctorRegister from "./pages/doctors/DoctorRegister";
const DoctorLogin = lazy(() => import("./pages/doctors/DoctorLogin"));
const DoctorLayout = lazy(() => import("./pages/doctors/DoctorLayout"));
const Dashbord = lazy(() => import("./pages/doctors/Dashbord"));
const DoctorEnrollments = lazy(
  () => import("./pages/doctors/DoctorEnrollments"),
);
import { useDoctorAuth } from "./context/DoctorAuthContext";
import NoticePrivacy from "./pages/Privacy Policies/NoticePrivacy";
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
          <Route path="/terms" element={<Terms />} />
          <Route path="/login" element={<Login />} />
          {/* <Route path="/register" element={<Register />} /> */}
          <Route path="/book-appointment" element={<BookAppointment />} />

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
          <Route path="/video-call/:appointmentId" element={<VideoCall />} />
          {/* ALL*/}
          <Route path="/categories" element={<Categories />} />
          <Route path="/specialties" element={<Specialties />} />
          <Route path="/conditions" element={<Symptoms />} />
          {/* categories */}
          {/* <Route path="/child-care" element={<ChildCare />} /> */}
          <Route path="/child-and-family-care" element={<ChildFamilyCare />} />
          <Route path="/chronic-care-and-expert-opinion" element={<ChronicCareExpertOpinion />}
          />
          <Route path="/eye-ear-bone" element={<EyeEarBone />} />
          <Route path="/general-and-everyday-care" element={<GeneralEverydayCare />}
          />
          <Route path="/men-health" element={<MenHealth />} />
          <Route path="/mental-health" element={<MentalHealth />} />
          {/* <Route path="/categories-sexual-health" element={<Sexualhealth />} /> */}
          <Route path="/categories-sexual-health" element={<Sexual_Health />} />
          <Route path="/skin-and-hair-care" element={<SkinHair />} />
          <Route path="/travel-global-care" element={<TravelGlobalCare />} />
          <Route path="/weight-and-nurtrition" element={<WeightNurtrition />} />
          <Route path="/women-health" element={<WomenHealth />} />
          {/* specialties */}
          {/* <Route path="/sd" element={<SD />} /> */}
          <Route path="/adolescent-medicine" element={<AdolescentMedicine />} />
          <Route path="/pediatrics" element={<Pediatrics />} />
          <Route path="/cardiology" element={<Cardiology />} />
          <Route
            path="/export-medical-opinion"
            element={<ExpertMedicalOpinion />}
          />
          <Route path="/gastroenterology" element={<Gastroenterology />} />
          <Route path="/neurology" element={<Neurology />} />
          <Route path="/pulmonology" element={<Pulmonology />} />
          <Route path="/family-medicine" element={<FamilyMedicine />} />
          <Route path="/general-physician" element={<GeneralPhysician />} />
          <Route path="/internal-medicine" element={<InternalMedicine />} />
          <Route path="/menopause-care" element={<MenopauseCare />} />
          <Route path="/obstetrics-and-gynaecology" element={<ObstetricsGynaecology />} />
          <Route path="/women-mental-health" element={<WomenMentalHealth />} />
          <Route path="/lactation-consulting" element={<LactationConsulting />}  />
          <Route
            path="/export-medical-opinion"
            element={<ExpertMedicalOpinion />}
          />
          <Route path="/gastroenterology" element={<Gastroenterology />} />
          <Route path="/neurology" element={<Neurology />} />
          <Route path="/pulmonology" element={<Pulmonology />} />
          <Route path="/ent" element={<Ent />} />
          <Route path="/ophthalmology" element={<Ophthalmology />} />
          <Route path="/orthopedics" element={<Orthopedics />} />
          <Route path="/mens-health" element={<MensHealth />} />
          <Route path="/urology" element={<Urology />} />
          <Route path="/behavioral-health" element={<BehavioralHealth />} />
          <Route path="/psychiatry" element={<Psychiatry />} />
          <Route path="/psychology-counseling" element={<PsychologyCounseling />} />
          <Route path="/sexual-health-speciality" element={<SexualHealthSpeciality />} />
          <Route path="/dermatology" element={<Dermatology />} />
          <Route path="/global-cross-border-care" element={<GlobalCrossBorderCare />} />
          <Route path="/travel-medicine" element={<TravelMedicine />} />
          <Route path="/weight-management" element={<WeightManagement />} />
          <Route path="/lifestyle-medicine" element={<LifestyleMedicine />} />
          <Route path="/nutrition-and-dietetics" element={<NutritionAndDietetics />} />
          
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
          <Route path="/lab-results-review" element={<LabResultsReview />} />
          <Route path="/medical-certificate" element={<MedicalCertificate />} />
          <Route path="/medication-review" element={<MedicationReview />} />
          <Route path="/prescription-refill" element={<PrescriptionRefill />} />
          <Route
            path="/return-to-work-clearance"
            element={<ReturnWorkClearance />}
          />
          <Route
            path="/second-medical-opinion"
            element={<SecondMedicalOpinion />}
          />
          <Route path="/specialist-referral" element={<SpecialistReferral />} />
          <Route path="/allergic-rhinitis" element={<AllergicRhinitis />} />
          <Route path="/asthma" element={<Asthma />} />
          <Route path="/asthma-flare-up" element={<AsthmaFlareUp />} />
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
          <Route path="/genital-itching" element={<GenitalItching />} />
          <Route path="/genital-rash" element={<GenitalRash />} />
          <Route path="/gonorrhea" element={<Gonorrhea />} />
          <Route path="/herpes" element={<Herpes />} />
          <Route
            path="/hiv-prevention-guidance"
            element={<HivPreventionGuidance />}
          />
          <Route
            path="/partner-exposure-concerns"
            element={<PartnerExposureConcerns />}
          />
          <Route path="/safe-sex-counseling" element={<SafeSexCounseling />} />
          <Route path="/sti-consultation" element={<StiConsultation />} />
          <Route path="/acne" element={<Acne />} />
          <Route path="/athletes-foot" element={<AthletesFoot />} />
          <Route path="/cellulitis" element={<Cellulitis />} />
          <Route path="/cold-sores" element={<ColdSores />} />
          <Route path="/contact-dermatitis" element={<ContactDermatitis />} />
          <Route path="/eczema" element={<Eczema />} />
          <Route
            path="/fungal-skin-infection"
            element={<FungalSkinInfection />}
          />
          {/* <Route path="/hair-loss" element={<HairLoss />} /> */}
          <Route path="/hives" element={<Hives />} />
          <Route path="/itchy-skin" element={<ItchySkin />} />
          <Route path="/mole-skin-checks" element={<MoleSkinChecks />} />
          <Route path="/nail-problems" element={<NailProblems />} />
          <Route path="/psoriasis" element={<Psoriasis />} />
          <Route path="/ringworm" element={<Ringworm />} />
          <Route path="/rosacea" element={<Rosacea />} />
          <Route path="/shingles" element={<Shingles />} />
          <Route path="/skin-rash" element={<SkinRash />} />
          <Route path="/warts" element={<Warts />} />
          <Route path="/altitude-sickness" element={<AltitudeSickness />} />
          <Route
            path="/cross-border-consultation"
            element={<CrossBorderConsultation />}
          />
          <Route
            path="/emergency-teleconsultation-abroad"
            element={<EmergencyTeleconsultationAbroad />}
          />
          <Route
            path="/fitness-travel-evaluation"
            element={<FitnessTravelEvaluation />}
          />
          <Route
            path="/food-poisoning-while-traveling"
            element={<FoodPoisoningWhileTraveling />}
          />
          <Route
            path="/international-medical-assistance"
            element={<InternationalMedicalAssistance />}
          />
          <Route path="/malaria-prevention" element={<MalariaPrevention />} />
          <Route path="/jet-lag" element={<JetLag />} />
          <Route
            path="/medication-refills-traveling"
            element={<MedicationRefillTraveling />}
          />
          <Route path="/motion-sickness" element={<MotionSickness />} />
          <Route
            path="/post-travel-symptoms"
            element={<PostTravelSymptoms />}
          />
          <Route
            path="/pre-travel-vaccinations"
            element={<PreTravelVaccinations />}
          />
          <Route
            path="/referral-coordination-overseas"
            element={<ReferralCoordinationOverseas />}
          />
          <Route
            path="/travel-medical-certification"
            element={<TravelMedicalCertificate />}
          />
          <Route
            path="/travel-related-fever"
            element={<TravelRelatedFever />}
          />
          <Route path="/travelers-diarrhea" element={<TravelersDiarrhea1 />} />
          <Route path="/acid-reflux-gerd" element={<AcidRefluxGerd />} />
          <Route path="/body-aches" element={<BodyAches />} />
          <Route path="/bronchitis" element={<Bronchitis />} />
          <Route path="/cold-and-flu" element={<ColdAndFlu />} />
          <Route path="constipation" element={<Constipation />} />
          <Route path="/cough" element={<Cough />} />
          <Route path="/covid-19" element={<Covid19 />} />
          <Route path="/diarrhea" element={<Diarrhea />} />
          <Route path="/dizziness" element={<Dizziness />} />
          <Route path="/ear-infection" element={<EarInfection1 />} />
          <Route path="/fatigue" element={<Fatigue />} />
          <Route path="/fever" element={<Fever />} />
          <Route path="/food-poisoning" element={<FoodPoisoning />} />
          <Route path="/headache" element={<Headache />} />
          <Route path="/insect-bite" element={<InsectBites />} />
          <Route path="/migraines" element={<Migraine />} />
          <Route path="/minor-burns" element={<MinorBurns />} />
          <Route path="/minor-infections" element={<MinorInfections />} />
          <Route
            path="/multi-system-complaints"
            element={<MultiSystemComplaints />}
          />
          <Route path="/nausea-and-vomiting" element={<NauseaAndVomiting />} />
          <Route path="/pink-eye" element={<PinkEye />} />
          <Route
            path="/preventive-screening"
            element={<PreventiveScreening />}
          />
          <Route path="/routine-check-ups" element={<RoutineCheckUps />} />
          <Route path="/seasonal-allergies" element={<SeasonalAllergies />} />
          <Route path="/sinus-infection" element={<SinusInfection />} />
          <Route path="/sore-throat" element={<SoreThroat />} />
          <Route path="/strep-throat" element={<StrepThroat />} />
          <Route
            path="/undiagnosed-symptoms"
            element={<UndiagnosedSymptoms />}
          />
          <Route path="/vaccination-advice" element={<VaccinationAdvice />} />
          
          <Route
            path="/whole-family-illnesses"
            element={<WholeFamilyIllnesses />}
          />
          <Route path="/bladder-infection" element={<BladderInfection />} />
          <Route path="/blood-in-urine" element={<BloodInUrine />} />
          <Route path="/burning-urination" element={<BurningUrination />} />
          <Route path="/frequent-urination" element={<FrequentUrination />} />
          <Route path="/kidney-stones" element={<KidneyStones />} />
          <Route
            path="/urinary-incontinence"
            element={<UrinaryIncontinence />}
          />
          <Route
            path="/urinary-tract-infection"
            element={<UrinaryTractInfection />}
          />
          <Route path="/bacterial-vaginosis" element={<BacterialVaginosis />} />
          <Route
            path="/birth-control-consultation"
            element={<BirthControlConsultation />}
          />
          <Route
            path="/emergency-contraception-guidance"
            element={<EmergencyContraceptionGuidance />}
          />
          <Route path="/heavy-periods" element={<HeavyPeriods />} />
          <Route path="/irregular-periods" element={<IrregularPeriods />} />
          <Route path="/latch-problems" element={<LatchProblems />} />
          <Route path="/low-milk-supply" element={<LowMilkSupply />} />
          <Route path="/menopause-symptoms" element={<MenopauseSymptoms />} />
          <Route path="/menstrual-cramps" element={<MenstrualCramps />} />
          <Route path="/nipple-pain" element={<NipplePain />} />
          <Route path="/pcos" element={<Pcos />} />
          <Route path="/pelvic-pain" element={<PelvicPain />} />
          <Route path="/perinatal-anxiety" element={<PerinatalAnxiety />} />
          <Route path="/postpartum-concerns" element={<PostpartumConcerns />} />
          <Route path="/pmdd" element={<Pmdd />} />
          <Route
            path="/pregnancy-related-questions"
            element={<PregnancyRelatedQuestions />}
          />
          <Route
            path="/postnatal-depression"
            element={<PostnatalDepression />}
          />
          <Route
            path="/prenatal-consultation"
            element={<PrenatalConsultation />}
          />
          <Route
            path="/vaginal-yeast-infection"
            element={<VaginalYeastInfection />}
          />
          <Route path="/weaning-guidance" element={<WeaningGuidance />} />
          {/* <Route path="/bladder-problems" element={<BladderProblems />} /> */}
          {/* <Route
            path="/erectile-dysfunction"
            element={<ErectileDysfunction />}
          /> */}
          <Route
            path="/hair-loss-mens-health"
            element={<HairLossMensHealth />}
          />
          {/* <Route path="/low-libido" element={<LowLibido />} /> */}
          {/* <Route
            path="/low-testosterone-symptoms"
            element={<LowTestosteroneSymptoms />}
          /> */}
          {/* <Route
            path="/mens-wellness-consultation"
            element={<MensWellnessConsultation />}
          /> */}
          {/* <Route
            path="/premature-ejaculation"
            element={<PrematureEjaculation />}
          /> */}
          {/* <Route path="/prostate-health" element={<ProstateHealth />} /> */}
          {/* <Route
            path="/urinary-symptoms-men"
            element={<UrinarySymptomsMen />}
          />
          <Route path="/ADHD-evaluation" element={<ADHDEvaluation />} />
          <Route
          /> */}
          <Route path="/bladder-problems" element={<BladderProblems1 />} />
          <Route
            path="/erectile-dysfunction"
            element={<ErectileDysfunction1 />}
          />
          {/* <Route path="/hair-loss" element={<HairLoss />} /> */}
          <Route path="/low-libido" element={<LowLibido1 />} />
          <Route
            path="/low-testosterone-symptoms"
            element={<LowTestosteroneSymptoms1 />}
          />
          <Route
            path="/mens-wellness-consultation"
            element={<MensWellnessConsultation1 />}
          />
          <Route
            path="/premature-ejaculation"
            element={<PrematureEjaculation1 />}
          />
          <Route path="/prostate-health" element={<ProstateHealth1 />} />
          <Route
            path="/urinary-symptoms-in-men"
            element={<UrinarySymptomsMen1 />}
          />
          {/* <Route path="/ADHD-evaluation" element={<ADHDEvaluation />} /> */}
          {/* <Route
            path="/adjustment-difficulties"
            element={<UrinarySymptomsMen />}
          /> */}
          <Route path="/doctors-note" element={<DoctorsNote />} />
          <Route path="/appointment-booking" element={<AppointmentBooking />} />
          <Route
            path="/appointment-booking/form"
            element={<AppointmentBookingForm />}
          />
          <Route path="/primary-care-provider" element={<PCP />} /> {/* PCP */}
          {/* PRIVACY  */}
          <Route path="/privacy-concerns" element={<PrivacyConcerns />} />
          {/* demo */}
          <Route
            path="/patient-privacy-notice"
            element={<PatientPrivacyNotice />}
          />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route
            path="/provider-terms-of-service"
            element={<ProviderTermsofService />}
          />
          <Route
            path="/refund-and-cancellation-policy"
            element={<RefundCancellation />}
          />
          <Route
            path="/tele-health-informed-consent"
            element={<TeleHealthConsent />}
          />
          <Route path="/terms-of-service" element={<TermsService />} />
          <Route
            path="/accessibility-statement"
            element={<AccessibilityStatement />}
          />
          <Route path="/CCPA" element={<CCPA />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route
            path="/notice-of-privacy-practices"
            element={<NoticePrivacy />}
          />
          <Route
            path="/patient-informed-consent-form"
            element={<PatientInformedConsentForm />}
          />
          <Route
            path="/physician-credentialing-policy"
            element={<PhysicianCredentialingPolicy />}
          />
          <Route
            path="/teleconsultation-workflow-policy"
            element={<TeleconsultationWorkflowPolicy />}
          />
          <Route
            path="/prescription-handling-policy"
            element={<PrescriptionHandlingPolicy />}
          />
          <Route
            path="/tele-health-provider-agreement"
            element={<TelehealthProviderAgreement />}
          />
          <Route path="/about-us" element={<AboutPage />} />
          {/* ---------------------Service Pages---------------------------- */}
          <Route path="/ServiceDemo" element={<ServiceDemo />} />
          <Route
            path="/chronic-care-management"
            element={<ChronicCareManagement />}
          />
          <Route
            path="/general-consultation"
            element={<GeneralConsultation />}
          />
          <Route
            path="/mental-health-support"
            element={<MentalHealthSupport />}
          />
          <Route
            path="/online-prescription-refills"
            element={<OnlinePrescriptionRefills />}
          />
          <Route path="/sexual-health" element={<SexualHealth />} />
          <Route
            path="/weight-loss-programs"
            element={<WeightLossPrograms />}
          />
          <Route path="/fit-to-fly" element={<FittoFly />} />
          <Route path="/lab-requisitions" element={<LABREQUISITIONS />} />
          <Route path="/doctor-note" element={<DoctorNote />} />



          <Route path="/vertigo" element={<Vertigo />} />
          
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
