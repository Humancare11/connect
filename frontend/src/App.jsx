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
import CallErrorBoundary from "./components/CallErrorBoundary";

const CookieBanner = lazy(() => import("./components/CookieBanner"));

const NotFound = lazy(() => import("./components/NotFound")); // 404 Page
const Home = lazy(() => import("./pages/Home"));
const AskDoctor = lazy(() => import("./pages/AskDoctor"));
const Services = lazy(() => import("./pages/Services"));
const Blogs = lazy(() => import("./pages/Blogs/Blogs"));
const Corporates = lazy(() => import("./pages/Corporates"));
const Contact = lazy(() => import("./pages/Contact"));
const AppointmentBooking = lazy(() => import("./pages/AppointmentBooking"));
const Terms = lazy(() => import("./pages/Terms"));
const Login = lazy(() => import("./pages/Login"));
// import Register from "./pages/Register";
const BookAppointment = lazy(() => import("./pages/BookAppointment"));
const VideoCall = lazy(() => import("./pages/VideoCall"));
const DirectVideoCall = lazy(() => import("./pages/DirectVideoCall"));

import { useAdmin } from "./context/AdminContext";
import { useAuth } from "./context/AuthContext";
import { useEmployeeAdmin } from "./context/EmployeeAdminContext";
import useLenis from "./hooks/useLenis";
import api, { clearUserAuthToken } from "./api";
import {
  ROLE_TIMEOUT_MS,
  SESSION_ACTIVITY_EVENT,
  clearClientSession,
  getActiveSessionRole,
  getLogoutRedirectPath,
} from "./utils/session";

// import AboutUs from "./pages/AboutPage";
const AboutPage = lazy(() => import("./pages/AboutPage")); // about us page

// iNDIVIDUAL bLOG PAGES
import Telemedicine from "./pages/Blogs/Telemedicine";
import TelemedicineServices from "./pages/Blogs/TelemedicineServices";
import HowTelemedicineAppointmentWork from "./pages/Blogs/HowTelemedicineAppointmentWork";
import OnlineDoctorConsultation from "./pages/Blogs/OnlineDoctorConsultation";
import MedicalConditions from "./pages/Blogs/MedicalConditions";
import TopTelemedicinePlatforms from "./pages/Blogs/TopTelemedicinePlatforms";
import TelemedicineSafe from "./pages/Blogs/TelemedicineSafe";
import TelemedicineInPerson from "./pages/Blogs/TelemedicineInPerson";
import TelemedicineCost from "./pages/Blogs/TelemedicineCost";
import OnlineDoctorRealDoctor from "./pages/Blogs/OnlineDoctorsRealDoctors";
import FutureofTelemedicine from "./pages/Blogs/FutureofTelemedicine";

const PCP = lazy(() => import("./pages/PCP")); // PCP Page
const DoctorCareers = lazy(() => import("./pages/DoctorCareers")); // Career Page for Doctors
const FAQ = lazy(() => import("./pages/FAQPage")); // FAQ page
// privacy concerns
const PrivacyConcerns = lazy(
  () => import("./pages/PrivacyPolicies/PrivacyConcerns"),
);
const PatientPrivacyNotice = lazy(
  () => import("./pages/PrivacyPolicies/PatientPrivacyNotice"),
);
// const PrivacyPolicy = lazy(
//   () => import("./pages/PrivacyPolicies/PrivacyPolicy"),
// );
// const ProviderTermsofService = lazy(
//   () => import("./pages/PrivacyPolicies/ProviderTermsofService"),
// );
const RefundCancellation = lazy(
  () => import("./pages/PrivacyPolicies/RefundCancellation"),
);
const TeleHealthConsent = lazy(
  () => import("./pages/PrivacyPolicies/TeleHealthConsent"),
);
// const TermsService = lazy(() => import("./pages/PrivacyPolicies/TermsService"));
// const AccessibilityStatement = lazy(
//   () => import("./pages/PrivacyPolicies/AccessibilityStatement"),
// );
const CCPA = lazy(() => import("./pages/PrivacyPolicies/CCPA"));
// const CookiePolicy = lazy(() => import("./pages/PrivacyPolicies/CookiePolicy"));
const PatientInformedConsentForm = lazy(
  () => import("./pages/PrivacyPolicies/PatientInformedConsentForm"),
);
const PhysicianCredentialingPolicy = lazy(
  () => import("./pages/PrivacyPolicies/PhysicianCredentialingPolicy"),
);
const TeleconsultationWorkflowPolicy = lazy(
  () => import("./pages/PrivacyPolicies/TeleconsultationWorkflowPolicy"),
);
const PrescriptionHandlingPolicy = lazy(
  () => import("./pages/PrivacyPolicies/PrescriptionHandlingPolicy"),
);
const TelehealthProviderAgreement = lazy(
  () => import("./pages/PrivacyPolicies/TelehealthProviderAgreement"),
);
const Images = lazy(() => import("./components/Images"));
// category pages
const ChildFamilyCare = lazy(
  () => import("./pages/Categories/ChildFamilyCare"),
);
const ChronicCareExpertOpinion = lazy(
  () => import("./pages/Categories/ChronicCareExpertOpinion"),
);
const EyeEarBone = lazy(() => import("./pages/Categories/EyeEarBone"));
const GeneralEverydayCare = lazy(
  () => import("./pages/Categories/GeneralEverydayCare"),
);
const MenHealth = lazy(() => import("./pages/Categories/MenHealth"));
const MentalHealth = lazy(() => import("./pages/Categories/MentalHealth"));
// import Sexualhealth from "./pages/Categories/SexualHealth";
const CategorySexualHealth = lazy(
  () => import("./pages/Categories/Sexual-Health"),
);
const SkinHair = lazy(() => import("./pages/Categories/SkinHair"));
const TravelGlobalCare = lazy(
  () => import("./pages/Categories/TravelGlobalCare"),
);
const WeightNurtrition = lazy(
  () => import("./pages/Categories/WeightNutrition"),
);
const WomenHealth = lazy(() => import("./pages/Categories/WomenHealth"));
// Specialty pages
// import SD from "./pages/Specialty/SD";

// condition pages
const Arthritis = lazy(() => import("./pages/Conditions/Arthritis"));
const CancerSecond = lazy(
  () => import("./pages/Conditions/CancerSecondOpinion"),
);
const ChestPain = lazy(() => import("./pages/Conditions/ChestPain"));
const ChronicKidney = lazy(
  () => import("./pages/Conditions/ChronicKidneyDisease"),
);
const ChronicMigraine = lazy(
  () => import("./pages/Conditions/ChronicMigraine"),
);
const ComplexDiagnosis = lazy(
  () => import("./pages/Conditions/ComplexDiagnosisReview"),
);
const FattyLiver = lazy(() => import("./pages/Conditions/FattyLiver"));
const HeartDisease = lazy(() => import("./pages/Conditions/HeartDisease"));
const HighBloodPressure = lazy(
  () => import("./pages/Conditions/HighBloodPressure"),
);
const HighCholesterol = lazy(
  () => import("./pages/Conditions/HighCholesterol"),
);
const HormoneImblance = lazy(
  () => import("./pages/Conditions/HormoneImbalance"),
);
const MemoryConcerns = lazy(() => import("./pages/Conditions/MemoryConcerns"));
const Obesity = lazy(() => import("./pages/Conditions/Obesity"));
const Osteoarthritis = lazy(() => import("./pages/Conditions/Osteoarthritis"));
const Osteoporosis = lazy(() => import("./pages/Conditions/Osteoporosis"));
const Palpitations = lazy(() => import("./pages/Conditions/Palpitations"));
const PostCovidConcerns = lazy(
  () => import("./pages/Conditions/PostCovidConcerns"),
);
const PreOpCardiacClearance = lazy(
  () => import("./pages/Conditions/PreOpCardiacClearance"),
);
const RheumatoidArthritis = lazy(
  () => import("./pages/Conditions/RheumatoidArthritis"),
);
const SeizuresEpilepsyFollowUp = lazy(
  () => import("./pages/Conditions/SeizuresEpilepsyFollowUp"),
);
const SleepApnea = lazy(() => import("./pages/Conditions/SleepApnea"));
const SurgerySecondOpinion = lazy(
  () => import("./pages/Conditions/SurgerySecondOpinion"),
);
const ThyroidDisorders = lazy(
  () => import("./pages/Conditions/ThyroidDisorders"),
);
const TreatmentPlanReview = lazy(
  () => import("./pages/Conditions/TreatmentPlanReview"),
);
const Tremor = lazy(() => import("./pages/Conditions/Tremor"));
const TypeTwoDiabetes = lazy(
  () => import("./pages/Conditions/TypeTwoDiabetes"),
);
const AbdominalPain = lazy(() => import("./pages/Conditions/AbdominalPain"));
const BingeEating = lazy(() => import("./pages/Conditions/BingeEating"));
const Bloating = lazy(() => import("./pages/Conditions/Bloating"));
const CholesterolLoweringDiet = lazy(
  () => import("./pages/Conditions/CholesterolLoweringDiet"),
);
const Dehydration = lazy(() => import("./pages/Conditions/Dehydration"));
const DiabeticDiet = lazy(() => import("./pages/Conditions/DiabeticDiet"));
const DietExercisePlanning = lazy(
  () => import("./pages/Conditions/DietExercisePlanning"),
);
const FoodIntolerancePlanning = lazy(
  () => import("./pages/Conditions/FoodIntolerancePlanning"),
);
const Gastritis = lazy(() => import("./pages/Conditions/Gastritis"));
const GlpProgramEligibility = lazy(
  () => import("./pages/Conditions/GlpProgramEligibility"),
);
const HealthyHabitCoaching = lazy(
  () => import("./pages/Conditions/HealthyHabitCoaching"),
);
const Hemorrhoids = lazy(() => import("./pages/Conditions/Hemorrhoids"));
const Indigestion = lazy(() => import("./pages/Conditions/Indigestion"));
const IrritableBowelSyndrome = lazy(
  () => import("./pages/Conditions/IrritableBowelSyndrome"),
);
const PregnancyNutrition = lazy(
  () => import("./pages/Conditions/PregnancyNutrition"),
);
const SleepHygiene = lazy(() => import("./pages/Conditions/SleepHygiene"));
const SportNutrition = lazy(() => import("./pages/Conditions/SportsNutrition"));
const TravelersDiarrhea = lazy(
  () => import("./pages/Conditions/TravelersDiarrhea"),
);
const MetabolicSyndrome = lazy(
  () => import("./pages/Conditions/MetabolicSyndrome"),
);
const Vomiting = lazy(() => import("./pages/Conditions/Vomiting"));
const WeightLossPlanning = lazy(
  () => import("./pages/Conditions/WeightLossPlanning"),
);
const BackPain = lazy(() => import("./pages/Conditions/BackPain"));
const DryEyes = lazy(() => import("./pages/Conditions/DryEyes"));
const EarInfection = lazy(() => import("./pages/Conditions/EarInfection"));
const EarPain = lazy(() => import("./pages/Conditions/EarPain"));
const EyeRedness = lazy(() => import("./pages/Conditions/EyeRedness"));
const EyeStrain = lazy(() => import("./pages/Conditions/EyeStrain"));
const Hoarseness = lazy(() => import("./pages/Conditions/Hoarseness"));
const KneePain = lazy(() => import("./pages/Conditions/KneePain"));
const MuscleStrain = lazy(() => import("./pages/Conditions/MuscleStrain"));
const NasalCongestion = lazy(
  () => import("./pages/Conditions/NasalCongestion"),
);
const NeckPain = lazy(() => import("./pages/Conditions/NeckPain"));
const Burnout = lazy(() => import("./pages/Conditions/Conditions/Burnout"));
const NumbnessAndTingling = lazy(
  () => import("./pages/Conditions/NumbnessAndTingling"),
);
const Stye = lazy(() => import("./pages/Conditions/Stye"));
const SwollenFeetAnkles = lazy(
  () => import("./pages/Conditions/SwollenFeetAnkles"),
);
const Tonsillitis = lazy(() => import("./pages/Conditions/Tonsillitis"));
const JointPain = lazy(() => import("./pages/Conditions/JointPain"));
const VisionChanges = lazy(() => import("./pages/Conditions/VisionChanges"));
const ChildhoodAllergies = lazy(
  () => import("./pages/Conditions/ChildhoodAllergies"),
);
const EarPainChildren = lazy(
  () => import("./pages/Conditions/EarPainChildren"),
);
const FeedingConcerns = lazy(
  () => import("./pages/Conditions/FeedingConcerns"),
);
const MildAsthmaSymptoms = lazy(
  () => import("./pages/Conditions/MildAsthmaSymptoms"),
);
const MoodAnxietyTeens = lazy(
  () => import("./pages/Conditions/MoodAnxietyTeens"),
);
const PediatricColdFlu = lazy(
  () => import("./pages/Conditions/PediatricColdFlu"),
);
const PediatricFever = lazy(() => import("./pages/Conditions/PediatricFever"));
const PinkEyeChildren = lazy(
  () => import("./pages/Conditions/PinkEyeChildren"),
);
const PubertyConcerns = lazy(
  () => import("./pages/Conditions/PubertyConcerns"),
);
const SkinRashChildren = lazy(
  () => import("./pages/Conditions/SkinRashChildren"),
);
const SoreThroatChildren = lazy(
  () => import("./pages/Conditions/SoreThroatChildren"),
);
const SportsInjuries = lazy(() => import("./pages/Conditions/SportsInjuries"));
const StomachPainChildren = lazy(
  () => import("./pages/Conditions/StomachPainChildren"),
);
const GrowthDevelopment = lazy(
  () => import("./pages/Conditions/GrowthDevelopment"),
);
const VomitingDiarrheaChildren = lazy(
  () => import("./pages/Conditions/VomitingDiarrheaChildren"),
);
const DoctorsNote = lazy(() => import("./pages/Conditions/DoctorsNote"));
const FollowUpConsultation = lazy(
  () => import("./pages/Conditions/FollowUpConsultation"),
);
const LabResultsReview = lazy(
  () => import("./pages/Conditions/LabResultReview"),
);
const MedicalCertificate = lazy(
  () => import("./pages/Conditions/MedicalCertificate"),
);
const MedicationReview = lazy(
  () => import("./pages/Conditions/MedicationReview"),
);
const PrescriptionRefill = lazy(
  () => import("./pages/Conditions/PrescriptionRefill"),
);
const ReturnWorkClearance = lazy(
  () => import("./pages/Conditions/ReturnWorkClearance"),
);
const SecondMedicalOpinion = lazy(
  () => import("./pages/Conditions/SecondMedicalOpinion"),
);
const SpecialistReferral = lazy(
  () => import("./pages/Conditions/SpecialistReferral"),
);
const AllergicRhinitis = lazy(
  () => import("./pages/Conditions/AllergicRhinitis"),
);
const Asthma = lazy(() => import("./pages/Conditions/Asthma"));
const AsthmaFlareUp = lazy(() => import("./pages/Conditions/AsthmaFlareUp"));
const Copd = lazy(() => import("./pages/Conditions/Copd"));
const PersistentCough = lazy(
  () => import("./pages/Conditions/PersistentCough"),
);
const PneumoniaFollowUp = lazy(
  () => import("./pages/Conditions/PneumoniaFollowUp"),
);
const ShortnessOfBreath = lazy(
  () => import("./pages/Conditions/ShortnessBreath"),
);
const UpperRespiratoryInfection = lazy(
  () => import("./pages/Conditions/UpperRespiratoryInfection"),
);
const Wheezing = lazy(() => import("./pages/Conditions/Wheezing"));
const Chlamydia = lazy(() => import("./pages/Conditions/Chlamydia"));
const GenitalItching = lazy(() => import("./pages/Conditions/GenitalItching"));
const GenitalRash = lazy(() => import("./pages/Conditions/GenitalRash"));
const Gonorrhea = lazy(() => import("./pages/Conditions/Gonorrhea"));
const Herpes = lazy(() => import("./pages/Conditions/Herpes"));
const HivPreventionGuidance = lazy(
  () => import("./pages/Conditions/HivPreventionGuidance"),
);
const PartnerExposureConcerns = lazy(
  () => import("./pages/Conditions/PartnerExposureConcerns"),
);
const SafeSexCounseling = lazy(
  () => import("./pages/Conditions/SafeSexCounseling"),
);
const StiConsultation = lazy(
  () => import("./pages/Conditions/StiConsultation"),
);
const Acne = lazy(() => import("./pages/Conditions/Acne"));
const AthletesFoot = lazy(() => import("./pages/Conditions/AthletesFoot"));
const Cellulitis = lazy(() => import("./pages/Conditions/Cellulitis"));
const ColdSores = lazy(() => import("./pages/Conditions/ColdSores"));
const ContactDermatitis = lazy(
  () => import("./pages/Conditions/ContactDermatitis"),
);
const Eczema = lazy(() => import("./pages/Conditions/Conditions/Eczema"));
const FungalSkinInfection = lazy(
  () => import("./pages/Conditions/Conditions/FungalSkinInfection"),
);
const HairLoss1 = lazy(() => import("./pages/Conditions/Conditions/HairLoss"));
const Hives = lazy(() => import("./pages/Conditions/Conditions/Hives"));
const ItchySkin = lazy(() => import("./pages/Conditions/Conditions/ItchySkin"));
const MoleSkinChecks = lazy(
  () => import("./pages/Conditions/Conditions/MoleSkinChecks"),
);
const NailProblems = lazy(
  () => import("./pages/Conditions/Conditions/NailProblems"),
);
const Psoriasis = lazy(() => import("./pages/Conditions/Conditions/Psoriasis"));
const Ringworm = lazy(() => import("./pages/Conditions/Conditions/Ringworm"));
const Shingles = lazy(() => import("./pages/Conditions/Conditions/Shingles"));
const Rosacea = lazy(() => import("./pages/Conditions/Conditions/Rosacea"));
const SkinRash = lazy(() => import("./pages/Conditions/Conditions/SkinRash"));
const Warts = lazy(() => import("./pages/Conditions/Conditions/Warts"));
const AltitudeSickness = lazy(
  () => import("./pages/Conditions/Conditions/AltitudeSickness"),
);
const CrossBorderConsultation = lazy(
  () => import("./pages/Conditions/Conditions/CrossBorderConsultation"),
);
const EmergencyTeleconsultationAbroad = lazy(
  () => import("./pages/Conditions/Conditions/EmergencyTeleconsultationAbroad"),
);
const FitnessTravelEvaluation = lazy(
  () => import("./pages/Conditions/Conditions/FitnessTravelEvaluation"),
);
const FoodPoisoningWhileTraveling = lazy(
  () => import("./pages/Conditions/Conditions/FoodPoisoningWhileTraveling"),
);
const InternationalMedicalAssistance = lazy(
  () => import("./pages/Conditions/Conditions/InternationalMedicalAssistance"),
);
const JetLag = lazy(() => import("./pages/Conditions/Conditions/JetLag"));
const MalariaPrevention = lazy(
  () => import("./pages/Conditions/Conditions/MalariaPrevention"),
);
const MedicationRefillTraveling = lazy(
  () => import("./pages/Conditions/Conditions/MedicationRefillTraveling"),
);
const MotionSickness = lazy(
  () => import("./pages/Conditions/Conditions/MotionSickness"),
);
const PostTravelSymptoms = lazy(
  () => import("./pages/Conditions/Conditions/PostTravelSymptoms"),
);
const PreTravelVaccinations = lazy(
  () => import("./pages/Conditions/Conditions/PreTravelVaccination"),
);
const ReferralCoordinationOverseas = lazy(
  () => import("./pages/Conditions/Conditions/ReferralCoordinationOverseas"),
);
const TravelMedicalCertificate = lazy(
  () => import("./pages/Conditions/Conditions/TravelMedicalCertificate"),
);
const TravelRelatedFever = lazy(
  () => import("./pages/Conditions/Conditions/TravelRelatedFever"),
);
const TravelersDiarrhea1 = lazy(
  () => import("./pages/Conditions/Conditions/TravelersDiarrhea"),
);
const AcidRefluxGerd = lazy(
  () => import("./pages/Conditions/Conditions/AcidRefluxGerd"),
);
const BodyAches = lazy(() => import("./pages/Conditions/Conditions/BodyAches"));
const Bronchitis = lazy(
  () => import("./pages/Conditions/Conditions/Bronchitis"),
);
const ColdAndFlu = lazy(
  () => import("./pages/Conditions/Conditions/ColdAndFlu"),
);
const Constipation = lazy(
  () => import("./pages/Conditions/Conditions/Constipation"),
);
const Cough = lazy(() => import("./pages/Conditions/Conditions/Cough"));
const Covid19 = lazy(() => import("./pages/Conditions/Conditions/Covid19"));
const Diarrhea = lazy(() => import("./pages/Conditions/Conditions/Diarrhea"));
const Dizziness = lazy(() => import("./pages/Conditions/Conditions/Dizziness"));
const EarInfection1 = lazy(
  () => import("./pages/Conditions/Conditions/EarInfection"),
);
const Fatigue = lazy(() => import("./pages/Conditions/Conditions/Fatigue"));
const Fever = lazy(() => import("./pages/Conditions/Conditions/Fever"));
const FoodPoisoning = lazy(
  () => import("./pages/Conditions/Conditions/FoodPoisoning"),
);
const Headache = lazy(() => import("./pages/Conditions/Conditions/Headache"));
const InsectBites = lazy(
  () => import("./pages/Conditions/Conditions/InsectBites"),
);
const Migraine = lazy(() => import("./pages/Conditions/Conditions/Migraine"));
const MinorBurns = lazy(
  () => import("./pages/Conditions/Conditions/MinorBurns"),
);
const MinorInfections = lazy(
  () => import("./pages/Conditions/Conditions/MinorInfections"),
);
const MultiSystemComplaints = lazy(
  () => import("./pages/Conditions/Conditions/MultiSystemComplaints"),
);
const NauseaAndVomiting = lazy(
  () => import("./pages/Conditions/Conditions/NauseaAndVomiting"),
);
const PinkEye = lazy(() => import("./pages/Conditions/Conditions/PinkEye"));
const PreventiveScreening = lazy(
  () => import("./pages/Conditions/Conditions/PreventiveScreening"),
);
const RoutineCheckUps = lazy(
  () => import("./pages/Conditions/Conditions/RoutineCheckUps"),
);
const SeasonalAllergies = lazy(
  () => import("./pages/Conditions/Conditions/SeasonalAllergies"),
);
const SinusInfection = lazy(
  () => import("./pages/Conditions/Conditions/SinusInfection"),
);
const SoreThroat = lazy(
  () => import("./pages/Conditions/Conditions/SoreThroat"),
);
const StrepThroat = lazy(
  () => import("./pages/Conditions/Conditions/StrepThroat"),
);
const UndiagnosedSymptoms = lazy(
  () => import("./pages/Conditions/Conditions/UndiagnosedSymptoms"),
);
const VaccinationAdvice = lazy(
  () => import("./pages/Conditions/Conditions/VaccinationAdvice"),
);
const WholeFamilyIllnesses = lazy(
  () => import("./pages/Conditions/Conditions/WholeFamilyIllnesses"),
);
const BladderInfection = lazy(
  () => import("./pages/Conditions/Conditions/BladderInfection"),
);
const BloodInUrine = lazy(
  () => import("./pages/Conditions/Conditions/BloodInUrine"),
);
const BurningUrination = lazy(
  () => import("./pages/Conditions/Conditions/BurningUrination"),
);
const FrequentUrination = lazy(
  () => import("./pages/Conditions/Conditions/FrequentUrination"),
);
const KidneyStones = lazy(
  () => import("./pages/Conditions/Conditions/KidneyStones"),
);
const UrinaryIncontinence = lazy(
  () => import("./pages/Conditions/Conditions/UrinaryIncontinence"),
);
const UrinaryTractInfection = lazy(
  () => import("./pages/Conditions/Conditions/UrinaryTractInfection"),
);
const BacterialVaginosis = lazy(
  () => import("./pages/Conditions/Conditions/BacterialVaginosis"),
);
const BirthControlConsultation = lazy(
  () => import("./pages/Conditions/Conditions/BirthControlConsultation"),
);
const EmergencyContraceptionGuidance = lazy(
  () => import("./pages/Conditions/Conditions/EmergencyContraceptionGuidance"),
);
const HeavyPeriods = lazy(
  () => import("./pages/Conditions/Conditions/HeavyPeriods"),
);
const IrregularPeriods = lazy(
  () => import("./pages/Conditions/Conditions/IrregularPeriods"),
);
const LatchProblems = lazy(
  () => import("./pages/Conditions/Conditions/LatchProblems"),
);
const LowMilkSupply = lazy(
  () => import("./pages/Conditions/Conditions/LowMilkSupply"),
);
const MenopauseSymptoms = lazy(
  () => import("./pages/Conditions/Conditions/MenopauseSymptoms"),
);
const MenstrualCramps = lazy(
  () => import("./pages/Conditions/Conditions/MenstrualCramps"),
);
const NipplePain = lazy(
  () => import("./pages/Conditions/Conditions/NipplePain"),
);
const Pcos = lazy(() => import("./pages/Conditions/Conditions/Pcos"));
const PelvicPain = lazy(
  () => import("./pages/Conditions/Conditions/PelvicPain"),
);
const PerinatalAnxiety = lazy(
  () => import("./pages/Conditions/Conditions/PerinatalAnxiety"),
);
const Pmdd = lazy(() => import("./pages/Conditions/Conditions/Pmdd"));
const PostnatalDepression = lazy(
  () => import("./pages/Conditions/Conditions/PostnatalDepression"),
);
const PostpartumConcerns = lazy(
  () => import("./pages/Conditions/Conditions/PostpartumConcerns"),
);
const PregnancyRelatedQuestions = lazy(
  () => import("./pages/Conditions/Conditions/PregnancyRelatedQuestions"),
);
const PrenatalConsultation = lazy(
  () => import("./pages/Conditions/Conditions/PrenatalConsultation"),
);
const VaginalYeastInfection = lazy(
  () => import("./pages/Conditions/Conditions/VaginalYeastInfection"),
);
const WeaningGuidance = lazy(
  () => import("./pages/Conditions/Conditions/WeaningGuidance"),
);
const BladderProblems1 = lazy(
  () => import("./pages/Conditions/Conditions/BladderProblems"),
);
const ErectileDysfunction1 = lazy(
  () => import("./pages/Conditions/Conditions/ErectileDysfunction"),
);
const HairLossMensHealth = lazy(
  () => import("./pages/Conditions/Conditions/HairLossMensHealth"),
);
const LowLibido1 = lazy(
  () => import("./pages/Conditions/Conditions/LowLibido"),
);
const LowTestosteroneSymptoms1 = lazy(
  () => import("./pages/Conditions/Conditions/LowTestosteroneSymptoms"),
);
const MensWellnessConsultation1 = lazy(
  () => import("./pages/Conditions/Conditions/MensWellnessConsultation"),
);
const PrematureEjaculation1 = lazy(
  () => import("./pages/Conditions/Conditions/PrematureEjaculation"),
);
const ProstateHealth1 = lazy(
  () => import("./pages/Conditions/Conditions/ProstateHealth"),
);
const UrinarySymptomsMen1 = lazy(
  () => import("./pages/Conditions/Conditions/UrinarySymptomsMen"),
);
const Vertigo = lazy(() => import("./pages/Conditions/Conditions/Vertigo"));
const Stress = lazy(() => import("./pages/Conditions/Conditions/Stress"));
const AngerManagement = lazy(
  () => import("./pages/Conditions/Conditions/AngerManagement"),
);
const AdjustmentDifficulties = lazy(
  () => import("./pages/Conditions/Conditions/AdjustmentDifficulties"),
);
const SubstanceUseSupport = lazy(
  () => import("./pages/Conditions/Conditions/SubstanceUseSupport"),
);
const SleepRelatedAnxiety = lazy(
  () => import("./pages/Conditions/Conditions/SleepRelatedAnxiety"),
);
const Depression = lazy(
  () => import("./pages/Conditions/Conditions/Depression"),
);
const Anxiety = lazy(() => import("./pages/Conditions/Conditions/Anxiety"));
const BipolarDisorderFollowUp = lazy(
  () => import("./pages/Conditions/Conditions/BipolarDisorderFollowUp"),
);
const PTSD = lazy(() => import("./pages/Conditions/Conditions/Ptsd"));
const PanicAttacks = lazy(
  () => import("./pages/Conditions/Conditions/PanicAttacks"),
);
const Insomnia = lazy(() => import("./pages/Conditions/Conditions/Insomnia"));
const AdhdEvaluation = lazy(
  () => import("./pages/Conditions/Conditions/AdhdEvaluation"),
);
const GriefAndLoss = lazy(
  () => import("./pages/Conditions/Conditions/GriefAndLoss"),
);
const RelationshipStress = lazy(
  () => import("./pages/Conditions/Conditions/RelationshipStress"),
);
const LowSelfEsteem = lazy(
  () => import("./pages/Conditions/Conditions/LowSelfEsteem"),
);
const TraumaSupport = lazy(
  () => import("./pages/Conditions/Conditions/TraumaSupport"),
);
const HotFlashes = lazy(
  () => import("./pages/Conditions/Conditions/HotFlashes"),
);
const HrtGuidance = lazy(
  () => import("./pages/Conditions/Conditions/HrtGuidance"),
);
const FertilityConcerns = lazy(
  () => import("./pages/Conditions/Conditions/FertilityConcerns"),
);
import Ocd from "./pages/Conditions/Conditions/Ocd";
const EyeIrritation = lazy(() => import("./pages/Conditions/EyeIrritation"));
// ----------Speciality Pages-------------------
const AdolescentMedicine = lazy(
  () => import("./pages/Specialty/Children&FamilyCare/AdolescentMedicine"),
);
const Pediatrics = lazy(
  () => import("./pages/Specialty/Children&FamilyCare/Pediatrics"),
);
const Cardiology = lazy(
  () => import("./pages/Specialty/ChronicCare&ExpertOpinion/Cardiology"),
);
const ExpertMedicalOpinion = lazy(
  () =>
    import("./pages/Specialty/ChronicCare&ExpertOpinion/ExpertMedicalOpinion"),
);
const Gastroenterology = lazy(
  () => import("./pages/Specialty/ChronicCare&ExpertOpinion/Gastroenterology"),
);
const Neurology = lazy(
  () => import("./pages/Specialty/ChronicCare&ExpertOpinion/Neurology"),
);
const Pulmonology = lazy(
  () => import("./pages/Specialty/ChronicCare&ExpertOpinion/Pulmonology"),
);
const Ent = lazy(() => import("./pages/Specialty/EyeEarAndBone/Ent"));
const Ophthalmology = lazy(
  () => import("./pages/Specialty/EyeEarAndBone/Ophthalmology"),
);
const Orthopedics = lazy(
  () => import("./pages/Specialty/EyeEarAndBone/Orthopedics"),
);
const SpeMensHealth = lazy(
  () => import("./pages/Specialty/MensHealth/SpeMensHealth"),
);
const Urology = lazy(() => import("./pages/Specialty/MensHealth/Urology"));
const BehavioralHealth = lazy(
  () => import("./pages/Specialty/MentalHealth/BehavioralHealth"),
);
const Psychiatry = lazy(
  () => import("./pages/Specialty/MentalHealth/Psychiatry"),
);
const PsychologyCounseling = lazy(
  () => import("./pages/Specialty/MentalHealth/PsychologyCounseling"),
);
const SexualHealthSpeciality = lazy(
  () => import("./pages/Specialty/SexualHealth/SexualHealthSpeciality"),
);
const Dermatology = lazy(
  () => import("./pages/Specialty/SkinAndHair/Dermatology"),
);
const GlobalCrossBorderCare = lazy(
  () => import("./pages/Specialty/TravelAndGlobalCare/GlobalCrossBorderCare"),
);
const TravelMedicine = lazy(
  () => import("./pages/Specialty/TravelAndGlobalCare/TravelMedicine"),
);
const WeightManagement = lazy(
  () => import("./pages/Specialty/WeightAndNutrition/WeightManagement"),
);
const LifestyleMedicine = lazy(
  () => import("./pages/Specialty/WeightAndNutrition/LifestyleMedicine"),
);
const NutritionAndDietetics = lazy(
  () => import("./pages/Specialty/WeightAndNutrition/NutritionAndDietetics"),
);
const EndocrinologySpeciality = lazy(
  () => import("./pages/Specialty/ChronicCare&ExpertOpinion/Endocrinology"),
);

// General & Everyday Care
const FamilyMedicine = lazy(
  () => import("./pages/Specialty/General&EverydayCare/FamilyMedicine"),
);
const GeneralPhysician = lazy(
  () => import("./pages/Specialty/General&EverydayCare/GeneralPhysician"),
);
const InternalMedicine = lazy(
  () => import("./pages/Specialty/General&EverydayCare/InternalMedicine"),
);
const MenopauseCare = lazy(
  () => import("./pages/Specialty/Women'sHealth/MenopauseCare"),
);
const WomenMentalHealth = lazy(
  () => import("./pages/Specialty/Women'sHealth/WomenMentalHealth"),
);
const LactationConsulting = lazy(
  () => import("./pages/Specialty/Women'sHealth/LactationConsulting"),
);
const ObstetricsGynaecology = lazy(
  () => import("./pages/Specialty/Women'sHealth/ObstetricsGynaecology"),
);

// -------------------------Services Pages-------------------------
// import OnlinePrescriptionRefills from "./pages/NewServices/OnlinePrescriptionRefills";
// import OnlinePrescriptionRefills from "./pages/NewServices/OnlinePrescriptionRefills";

// -------------------------Services Pages-------------------------
const OnlinePrescriptionRefills = lazy(
  () => import("./pages/NewServices/OnlinePrescriptionRefills"),
);
const ChronicCareManagement = lazy(
  () => import("./pages/NewServices/ChronicCareManagment"),
);
const GeneralConsultation = lazy(
  () => import("./pages/NewServices/GeneralConsultation"),
);
const MentalHealthSupport = lazy(
  () => import("./pages/NewServices/MentalHealthSupport"),
);
const SexualHealth = lazy(() => import("./pages/NewServices/SexualHealth"));
const WeightLossPrograms = lazy(
  () => import("./pages/NewServices/WeightLossPrograms"),
);
const DoctorNoteSickNote = lazy(
  () => import("./pages/NewServices/DoctorNoteSickNote"),
);
const FittoFly = lazy(() => import("./pages/NewServices/FittoFly"));
const LABREQUISITIONS = lazy(
  () => import("./pages/NewServices/LABREQUISITIONS"),
);
const ChronicMedicationManagement = lazy(
  () => import("./pages/Conditions/ChronicMedicationManagement"),
);
// import DoctorNote from "./pages/NewServices/DoctorNote";
// Services
const ServiceDemo = lazy(() => import("./pages/NewServices/ServiceDemo"));

import AdminAssignCategoryDoctor from "./pages/admin/AdminAssignCategoryDoctor";
import ServicesPrices from "./pages/admin/ServicesPrices";

import CategoryConsultant from "./pages/CategoryConsultant";
import CategoryAppointmentConfirm from "./pages/CategoryAppointmentConfirm";
import AdminCategoryConsultationDetails from "./pages/admin/AdminCategoryConsultationDetails";

// import DoctorRegister from "./pages/doctors/DoctorRegister";
const DoctorLogin = lazy(() => import("./pages/doctors/DoctorLogin"));
const DoctorLayout = lazy(() => import("./pages/doctors/DoctorLayout"));
const Dashbord = lazy(() => import("./pages/doctors/Dashbord"));
const DoctorEnrollments = lazy(
  () => import("./pages/doctors/DoctorEnrollments"),
);
import { useDoctorAuth } from "./context/DoctorAuthContext";
// const NoticePrivacy = lazy(
//   () => import("./pages/PrivacyPolicies/NoticePrivacy"),
// );
const DoctorProfile = lazy(() => import("./pages/doctors/DoctorProfile"));
// import DoctorPendingApproval from "./pages/doctors/DoctorPendingApproval";
const DoctorAppointments = lazy(
  () => import("./pages/doctors/DoctorAppointments"),
);
const DoctorPatients = lazy(() => import("./pages/doctors/DoctorPatients"));
const DoctorMessages = lazy(() => import("./pages/doctors/DoctorMessages"));
const DoctorNotes = lazy(() => import("./pages/doctors/DoctorNotes"));
const RaiseTicket = lazy(() => import("./pages/doctors/RaiseTicket"));
const DoctorQnA = lazy(() => import("./pages/doctors/DoctorQnA"));
const DoctorAnalytics = lazy(() => import("./pages/doctors/DoctorAnalytics"));
const DoctorSettings = lazy(() => import("./pages/doctors/DoctorSettings"));
const DoctorProfileForUser = lazy(
  () => import("./pages/doctors/DoctorProfileForUser"),
);

const AdminAuthPage = lazy(() => import("./pages/admin/AdminAuth"));
const PaymentAdminLogin = lazy(() => import("./pages/admin/PaymentAdminLogin"));
// const PricingManagement = lazy(() => import("./pages/admin/PricingManagement"));
// const PricingManagement = lazy(() => import("./pages/admin/PricingManagement"));
const HealthcareManagement = lazy(
  () => import("./pages/admin/HealthcareManagement"),
);
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const OurDoctors = lazy(() => import("./pages/admin/OurDoctors"));
const ManageDoctors = lazy(() => import("./pages/admin/ManageDoctors"));
const AdminDoctorProfile = lazy(
  () => import("./pages/admin/AdminDoctorProfile"),
);
const ManageUsers = lazy(() => import("./pages/admin/ManageUsers"));
const AdminAppointments = lazy(() => import("./pages/admin/AdminAppointments"));
const AdminAppointmentDetails = lazy(
  () => import("./pages/admin/AdminAppointmentDetails"),
);
const AdminCategoryConsultations = lazy(
  () => import("./pages/admin/AdminCategoryConsultations"),
);
const AdminDirectVideoConsultation = lazy(
  () => import("./pages/admin/AdminDirectVideoConsultation"),
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

const EmployeeAdminLogin = lazy(() => import("./pages/employee/EmployeeLogin"));
const EmployeeAdminLayout = lazy(
  () => import("./pages/employee/EmployeeLayout"),
);
const EmployeeAdminDashboard = lazy(
  () => import("./pages/employee/EmployeeDashboard"),
);
const EmployeeTasks = lazy(() => import("./pages/employee/EmployeeTasks"));
const AssignTask = lazy(() => import("./pages/employee/Assigntask"));

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

// const AppointmentBooking = lazy(() => import("./pages/AppointmentBookingold"));
const AppointmentBookingForm = lazy(
  () => import("./pages/AppointmentBookingForm"),
);

// New Privcay Policy Pages Start 
const Refundcancellationpolicy = lazy(() =>
  import("./pages/PrivacyPolicies/Refundcancellationpolicy"),
);

const ProviderTermsOfService1 = lazy(() =>
  import("./pages/PrivacyPolicies/ProviderTermsOfService1"),
);

const PrivacyPolicy1 = lazy(() =>
  import("./pages/PrivacyPolicies/PrivacyPolicy1"),
);
const TermsOfService1 = lazy(() =>
  import("./pages/PrivacyPolicies/TermsOfService1"),
);
const HippaNoticeOfPrivacyPractices1 = lazy(() =>
  import("./pages/PrivacyPolicies/HippaNoticeOfPrivacyPractices1"),
);
const CaliforniaPrivacyRightsNotice1 = lazy(() =>
  import("./pages/PrivacyPolicies/CaliforniaPrivacyRightsNotice1"),
);
const CookiePolicy1 = lazy(() =>
  import("./pages/PrivacyPolicies/CookiePolicy1"),
);
const AccessibilityStatement1 = lazy(() =>
  import("./pages/PrivacyPolicies/AccessibilityStatement1"),
);


// New Privcay Policy Pages End 

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

function EmployeeAdminPrivateRoute({ children }) {
  const { employeeAdmin, loading } = useEmployeeAdmin();
  if (loading) return null;
  if (!employeeAdmin) return <Navigate to="/employee-login" replace />;
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
      clearUserAuthToken();
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
        api.post("/api/auth/refresh", null, { authRole: role }).catch(() => { });
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
      .catch(() => { })
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
    location.pathname.startsWith("/employee") ||
    location.pathname.startsWith("/user") ||
    location.pathname.startsWith("/pay/") ||
    location.pathname.startsWith("/video-call") ||
    location.pathname.startsWith("/direct-video-call");

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
          <Route path="/contact-us" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/login" element={<Login />} />
          <Route path="/appointment-booking" element={<AppointmentBooking />} />
          {/* <Route path="/register" element={<Register />} /> */}
          <Route path="/book-appointment" element={<BookAppointment />} />
          <Route path="/test" element={<Test />} />
          <Route path="/pay/:token" element={<PaymentLinkCheckout />} />
          {/* SEO-friendly doctor profile: /doctors/12345-doctor-name */}
          <Route path="/cookies" element={<CookieBanner />} />
          <Route path="/doctors/:slug" element={<DoctorProfileForUser />} />
          <Route path="/images" element={<Images />} />
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
          <Route
            path="/doctor-dashboard/doctor-profile-for-patients"
            element={
              <DoctorLayout>
                <DoctorProfileForUser showOwnProfile />
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
            path="/doctor-dashboard/notes"
            element={
              <DoctorLayout>
                <DoctorNotes />
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
          {/* <Route
            path="/superadmin-dashboard/pricing-management"
            element={<PricingManagement />}
          /> */}
          <Route path="/employee-login" element={<EmployeeAdminLogin />} />
          <Route
            path="/admin-dashboard/category-consultations/assign-doctor/:id"
            element={
              <PrivateRoute allowedRoles={["admin", "superadmin"]}>
                <AdminLayout>
                  <AdminAssignCategoryDoctor />
                </AdminLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/employee-dashboard"
            element={
              <EmployeeAdminPrivateRoute>
                <EmployeeAdminLayout>
                  <EmployeeAdminDashboard />
                </EmployeeAdminLayout>
              </EmployeeAdminPrivateRoute>
            }
          />
          <Route
            path="/employee-dashboard/tasks"
            element={<Navigate to="/employee-dashboard/my-tasks" replace />}
          />
          <Route
            path="/employee-dashboard/my-tasks"
            element={
              <EmployeeAdminPrivateRoute>
                <EmployeeAdminLayout>
                  <EmployeeTasks mode="my" />
                </EmployeeAdminLayout>
              </EmployeeAdminPrivateRoute>
            }
          />
          <Route
            path="/employee-dashboard/my-tasks/:taskId"
            element={
              <EmployeeAdminPrivateRoute>
                <EmployeeAdminLayout>
                  <EmployeeTasks mode="detail" />
                </EmployeeAdminLayout>
              </EmployeeAdminPrivateRoute>
            }
          />
          <Route
            path="/employee-dashboard/assign-task"
            element={
              <EmployeeAdminPrivateRoute>
                <EmployeeAdminLayout>
                  <AssignTask />
                </EmployeeAdminLayout>
              </EmployeeAdminPrivateRoute>
            }
          />
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
          <Route path="/services-prices" element={<ServicesPrices />} />
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
            path="/admin-dashboard/category-consultations"
            element={
              <PrivateRoute allowedRoles={["admin", "superadmin"]}>
                <AdminLayout>
                  <AdminCategoryConsultations />
                </AdminLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin-dashboard/direct-video-consultation"
            element={
              <PrivateRoute allowedRoles={["admin", "superadmin"]}>
                <AdminLayout>
                  <AdminDirectVideoConsultation />
                </AdminLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin-dashboard/category-consultations/:id"
            element={
              <PrivateRoute allowedRoles={["admin", "superadmin"]}>
                <AdminLayout>
                  <AdminCategoryConsultationDetails />
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
            path="/superadmin-dashboard/healthcare-management"
            element={
              <PrivateRoute allowedRoles={["superadmin"]}>
                <AdminLayout>
                  <HealthcareManagement />
                </AdminLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/video-call/:appointmentId"
            element={
              <CallErrorBoundary>
                <VideoCall />
              </CallErrorBoundary>
            }
          />
          <Route
            path="/direct-video-call/:roomId"
            element={
              <CallErrorBoundary>
                <DirectVideoCall />
              </CallErrorBoundary>
            }
          />
          {/* ALL*/}
          <Route path="/categories" element={<Categories />} />
          <Route path="/specialties" element={<Specialties />} />
          <Route path="/conditions" element={<Symptoms />} />
          {/* categories */}
          <Route path="/child-and-family-care" element={<ChildFamilyCare />} />
          <Route path="/chronic-care" element={<ChronicCareExpertOpinion />} />
          <Route path="/eye-ear-bone" element={<EyeEarBone />} />
          <Route
            path="/general-and-everyday-care"
            element={<GeneralEverydayCare />}
          />
          <Route path="/mens-health" element={<MenHealth />} />
          <Route path="/mental-health" element={<MentalHealth />} />
          <Route path="/sexual-health" element={<CategorySexualHealth />} />
          <Route path="/skin-and-hair-care" element={<SkinHair />} />
          <Route
            path="/travel-and-global-care"
            element={<TravelGlobalCare />}
          />
          <Route path="/weight-and-nurtrition" element={<WeightNurtrition />} />
          <Route path="/women-health" element={<WomenHealth />} />
          {/* specialties */}
          {/* <Route path="/sd" element={<SD />} /> */}
          <Route
            path="/child-and-family-care/adolescent-medicine"
            element={<AdolescentMedicine />}
          />
          <Route
            path="/child-and-family-care/pediatrics"
            element={<Pediatrics />}
          />
          <Route
            path="/chronic-care-and-expert-opinion/cardiology"
            element={<Cardiology />}
          />
          <Route
            path="/child-and-family-care/pediatrics"
            element={<Pediatrics />}
          />
          <Route path="/chronic-care/cardiology" element={<Cardiology />} />
          <Route
            path="/chronic-care/gastroenterology"
            element={<Gastroenterology />}
          />
          <Route path="/chronic-care/neurology" element={<Neurology />} />
          <Route path="/chronic-care/pulmonology" element={<Pulmonology />} />
          <Route
            path="/general-and-everyday-care/family-medicine"
            element={<FamilyMedicine />}
          />
          <Route
            path="/general-and-everyday-care/general-physician"
            element={<GeneralPhysician />}
          />
          <Route
            path="/general-and-everyday-care/internal-medicine"
            element={<InternalMedicine />}
          />
          <Route
            path="/women-health/menopause-care"
            element={<MenopauseCare />}
          />
          <Route
            path="/women-health/obstetrics-and-gynaecology"
            element={<ObstetricsGynaecology />}
          />
          <Route
            path="/women-health/women-mental-health"
            element={<WomenMentalHealth />}
          />
          <Route
            path="/women-health/lactation-consulting"
            element={<LactationConsulting />}
          />
          <Route
            path="/chronic-care/gastroenterology"
            element={<Gastroenterology />}
          />
          <Route path="/chronic-care/neurology" element={<Neurology />} />
          <Route path="/chronic-care/pulmonology" element={<Pulmonology />} />
          <Route path="/eye-ear-bone/ear-nose-throat" element={<Ent />} />
          <Route
            path="/eye-ear-bone/ophthalmology"
            element={<Ophthalmology />}
          />
          <Route path="/eye-ear-bone/orthopedics" element={<Orthopedics />} />
          <Route
            path="/chronic-care/endocrinology"
            element={<EndocrinologySpeciality />}
          />
          <Route path="/mens-health/men-health" element={<SpeMensHealth />} />
          <Route path="/mens-health/urology" element={<Urology />} />
          <Route
            path="/mental-health/behavioral-health"
            element={<BehavioralHealth />}
          />
          <Route path="/mental-health/psychiatry" element={<Psychiatry />} />
          <Route
            path="/mental-health/psychology-counseling"
            element={<PsychologyCounseling />}
          />
          {/* <Route
            path="/speciality-sexual-health"
            element={<SexualHealthSpeciality />}
          /> */}
          <Route
            path="/skin-and-hair-care/dermatology"
            element={<Dermatology />}
          />
          <Route
            path="/travel-and-global-care/global-cross-border-care"
            element={<GlobalCrossBorderCare />}
          />
          <Route
            path="/travel-and-global-care/travel-medicine"
            element={<TravelMedicine />}
          />
          <Route
            path="/weight-and-nurtrition/weight-management"
            element={<WeightManagement />}
          />
          <Route
            path="/weight-and-nurtrition/lifestyle-medicine"
            element={<LifestyleMedicine />}
          />
          <Route
            path="/weight-and-nurtrition/nutrition-and-dietetics"
            element={<NutritionAndDietetics />}
          />
          {/* condition pages */}
          <Route
            path="/eye-ear-bone/orthopedics/arthritis"
            element={<Arthritis />}
          />
          <Route path="/cancer-second-opinion" element={<CancerSecond />} />
          <Route
            path="/chronic-care/cardiology/chest-pain"
            element={<ChestPain />}
          />
          <Route path="/chronic-kidney-disease" element={<ChronicKidney />} />
          <Route
            path="/chronic-care/neurology/chronic-migraine"
            element={<ChronicMigraine />}
          />
          <Route path="/complex-diagnosis" element={<ComplexDiagnosis />} />
          <Route
            path="/chronic-care/gastroenterology/fatty-liver"
            element={<FattyLiver />}
          />
          <Route
            path="/chronic-care/cardiology/heart-disease-follow-up"
            element={<HeartDisease />}
          />
          <Route
            path="/chronic-care/cardiology/high-blood-pressure"
            element={<HighBloodPressure />}
          />
          <Route
            path="/chronic-care/cardiology/high-cholesterol"
            element={<HighCholesterol />}
          />
          <Route
            path="/chronic-care/endocrinology/hormone-imbalance"
            element={<HormoneImblance />}
          />
          <Route
            path="/chronic-care/neurology/memory-concerns"
            element={<MemoryConcerns />}
          />
          <Route
            path="/weight-and-nurtrition/weight-management/obesity"
            element={<Obesity />}
          />
          <Route
            path="/eye-ear-bone/orthopedics/osteoarthritis"
            element={<Osteoarthritis />}
          />
          <Route
            path="/chronic-care/endocrinology/osteoporosis"
            element={<Osteoporosis />}
          />
          <Route
            path="/chronic-care/cardiology/palpitations"
            element={<Palpitations />}
          />
          <Route
            path="/chronic-care/pulmonology/post-covid-concerns"
            element={<PostCovidConcerns />}
          />
          <Route
            path="/chronic-care/cardiology/pre-op-cardiac-clearance"
            element={<PreOpCardiacClearance />}
          />
          <Route
            path="/rheumatoid-arthritis"
            element={<RheumatoidArthritis />}
          />
          <Route
            path="/chronic-care/neurology/seizures-epilepsy-follow-up"
            element={<SeizuresEpilepsyFollowUp />}
          />
          <Route
            path="/chronic-care/pulmonology/sleep-apnea-screening"
            element={<SleepApnea />}
          />
          <Route
            path="/surgery-second-opinion"
            element={<SurgerySecondOpinion />}
          />
          <Route
            path="/chronic-care/endocrinology/thyroid-disorders"
            element={<ThyroidDisorders />}
          />
          <Route
            path="/treatment-plan-review"
            element={<TreatmentPlanReview />}
          />
          <Route path="/chronic-care/neurology/tremor" element={<Tremor />} />
          <Route
            path="/chronic-care/endocrinology/type-2-diabetes"
            element={<TypeTwoDiabetes />}
          />
          <Route
            path="/chronic-care/gastroenterology/abdominal-pain"
            element={<AbdominalPain />}
          />
          <Route
            path="/weight-and-nurtrition/weight-management/binge-eating"
            element={<BingeEating />}
          />
          <Route
            path="/chronic-care/gastroenterology/bloating"
            element={<Bloating />}
          />
          <Route
            path="/weight-and-nurtrition/nutrition-and-dietetics/cholesterol-lowering-diet"
            element={<CholesterolLoweringDiet />}
          />
          <Route path="/dehydration" element={<Dehydration />} />
          <Route
            path="/weight-and-nurtrition/nutrition-and-dietetics/diabetic-diet"
            element={<DiabeticDiet />}
          />
          <Route
            path="/weight-and-nurtrition/lifestyle-medicine/diet-and-exercise-planning"
            element={<DietExercisePlanning />}
          />
          <Route
            path="/weight-and-nurtrition/nutrition-and-dietetics/food-intolerance-planning"
            element={<FoodIntolerancePlanning />}
          />
          <Route path="/gastritis" element={<Gastritis />} />
          <Route
            path="/glp-program-eligibility"
            element={<GlpProgramEligibility />}
          />
          <Route
            path="/weight-and-nurtrition/lifestyle-medicine/healthy-habit-coaching"
            element={<HealthyHabitCoaching />}
          />
          <Route path="/hemorrhoids" element={<Hemorrhoids />} />
          <Route path="/indigestion" element={<Indigestion />} />
          <Route
            path="/chronic-care/gastroenterology/irritable-bowel-syndrome"
            element={<IrritableBowelSyndrome />}
          />
          <Route
            path="/weight-and-nurtrition/nutrition-and-dietetics/pregnancy-nutrition"
            element={<PregnancyNutrition />}
          />
          <Route
            path="/weight-and-nurtrition/lifestyle-medicine/sleep-hygiene"
            element={<SleepHygiene />}
          />
          <Route
            path="/weight-and-nurtrition/nutrition-and-dietetics/sports-nutrition"
            element={<SportNutrition />}
          />
          <Route
            path="/travel-and-global-care/travel-medicine/travelers-diarrhea"
            element={<TravelersDiarrhea />}
          />
          <Route path="/metabolic-syndrome" element={<MetabolicSyndrome />} />
          <Route path="/vomiting" element={<Vomiting />} />
          <Route
            path="/weight-and-nurtrition/weight-management/weight-loss-planning"
            element={<WeightLossPlanning />}
          />
          <Route
            path="/eye-ear-bone/orthopedics/back-pain"
            element={<BackPain />}
          />
          <Route
            path="/eye-ear-bone/ophthalmology/dry-eyes"
            element={<DryEyes />}
          />
          <Route
            path="/eye-ear-bone/ear-nose-throat/ear-infection"
            element={<EarInfection />}
          />
          <Route
            path="/eye-ear-bone/ear-nose-throat/ear-pain"
            element={<EarPain />}
          />
          <Route
            path="/eye-ear-bone/ophthalmology/eye-redness"
            element={<EyeRedness />}
          />
          <Route
            path="/eye-ear-bone/ophthalmology/eye-strain"
            element={<EyeStrain />}
          />
          <Route
            path="/eye-ear-bone/ear-nose-throat/hoarseness"
            element={<Hoarseness />}
          />
          <Route
            path="/eye-ear-bone/orthopedics/knee-pain"
            element={<KneePain />}
          />
          <Route
            path="/eye-ear-bone/orthopedics/muscle-strain"
            element={<MuscleStrain />}
          />
          <Route
            path="/eye-ear-bone/ear-nose-throat/nasal-congestion"
            element={<NasalCongestion />}
          />
          <Route
            path="/eye-ear-bone/orthopedics/neck-pain"
            element={<NeckPain />}
          />
          <Route
            path="/chronic-care/neurology/numbness-and-tingling"
            element={<NumbnessAndTingling />}
          />
          <Route path="/eye-ear-bone/ophthalmology/stye" element={<Stye />} />
          <Route path="/swollen-feet-ankles" element={<SwollenFeetAnkles />} />
          <Route
            path="/eye-ear-bone/ear-nose-throat/tonsillitis"
            element={<Tonsillitis />}
          />
          <Route path="/joint-pain" element={<JointPain />} />
          <Route
            path="/eye-ear-bone/ophthalmology/vision-changes"
            element={<VisionChanges />}
          />
          <Route path="/childhood-allergies" element={<ChildhoodAllergies />} />
          <Route
            path="/child-and-family-care/pediatrics/ear-pain-children"
            element={<EarPainChildren />}
          />
          <Route
            path="/child-and-family-care/pediatrics/feeding-concerns"
            element={<FeedingConcerns />}
          />
          <Route
            path="/mild-asthma-symptoms"
            element={<MildAsthmaSymptoms />}
          />
          <Route
            path="/child-and-family-care/adolescent-medicine/mood-anxiety-teens"
            element={<MoodAnxietyTeens />}
          />
          <Route
            path="/child-and-family-care/pediatrics/pediatric-cold-flu"
            element={<PediatricColdFlu />}
          />
          <Route
            path="/child-and-family-care/pediatrics/pediatric-fever"
            element={<PediatricFever />}
          />
          <Route path="/pink-eye-children" element={<PinkEyeChildren />} />
          <Route
            path="/child-and-family-care/adolescent-medicine/puberty-concerns"
            element={<PubertyConcerns />}
          />
          <Route
            path="/child-and-family-care/pediatrics/skin-rash-in-children"
            element={<SkinRashChildren />}
          />
          <Route
            path="/sore-throat-children"
            element={<SoreThroatChildren />}
          />
          <Route
            path="/child-and-family-care/adolescent-medicine/sports-injuries"
            element={<SportsInjuries />}
          />
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
          <Route
            path="/general-and-everyday-care/internal-medicine/medication-review"
            element={<MedicationReview />}
          />
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
          <Route path="/chronic-care/pulmonology/asthma" element={<Asthma />} />
          <Route path="/asthma-flare-up" element={<AsthmaFlareUp />} />
          <Route path="/chronic-care/pulmonology/copd" element={<Copd />} />
          <Route
            path="/chronic-care/pulmonology/persistent-cough"
            element={<PersistentCough />}
          />
          <Route path="/pneumonia-follow-up" element={<PneumoniaFollowUp />} />
          <Route
            path="/chronic-care/pulmonology/shortness-of-breath"
            element={<ShortnessOfBreath />}
          />
          <Route
            path="/upper-respiratory-infection"
            element={<UpperRespiratoryInfection />}
          />
          <Route path="/wheezing" element={<Wheezing />} />
          <Route
            path="/sexual-health/sexual-health-and-wellness/chlamydia"
            element={<Chlamydia />}
          />
          <Route path="/genital-itching" element={<GenitalItching />} />
          <Route path="/genital-rash" element={<GenitalRash />} />
          <Route
            path="/sexual-health/sexual-health-and-wellness/gonorrhea"
            element={<Gonorrhea />}
          />
          <Route
            path="/sexual-health/sexual-health-and-wellness/herpes"
            element={<Herpes />}
          />
          <Route
            path="/sexual-health/sexual-health-and-wellness/hiv-prevention-guidance"
            element={<HivPreventionGuidance />}
          />
          <Route
            path="/sexual-health/sexual-health-and-wellness/partner-exposure-concerns"
            element={<PartnerExposureConcerns />}
          />
          <Route
            path="/sexual-health/sexual-health-and-wellness/safe-sex-counseling"
            element={<SafeSexCounseling />}
          />
          <Route
            path="/sexual-health/sexual-health-and-wellness/sti-consultation"
            element={<StiConsultation />}
          />
          <Route
            path="/skin-and-hair-care/dermatology/acne"
            element={<Acne />}
          />
          <Route path="/athletes-foot" element={<AthletesFoot />} />
          <Route path="/cellulitis" element={<Cellulitis />} />
          <Route
            path="/skin-and-hair-care/dermatology/cold-sores"
            element={<ColdSores />}
          />
          <Route path="/contact-dermatitis" element={<ContactDermatitis />} />
          <Route
            path="/skin-and-hair-care/dermatology/eczema"
            element={<Eczema />}
          />
          <Route
            path="/skin-and-hair-care/dermatology/fungal-skin-infection"
            element={<FungalSkinInfection />}
          />
          <Route
            path="/skin-and-hair-care/dermatology/hair-loss"
            element={<HairLoss1 />}
          />
          <Route
            path="/skin-and-hair-care/dermatology/hives"
            element={<Hives />}
          />
          <Route path="/itchy-skin" element={<ItchySkin />} />
          <Route
            path="/skin-and-hair-care/dermatology/mole-skin-checks"
            element={<MoleSkinChecks />}
          />
          <Route
            path="/skin-and-hair-care/dermatology/nail-problems"
            element={<NailProblems />}
          />
          <Route
            path="/skin-and-hair-care/dermatology/psoriasis"
            element={<Psoriasis />}
          />
          <Route path="/ringworm" element={<Ringworm />} />
          <Route
            path="/skin-and-hair-care/dermatology/rosacea"
            element={<Rosacea />}
          />
          <Route path="/shingles" element={<Shingles />} />
          <Route
            path="/skin-and-hair-care/dermatology/skin-rash"
            element={<SkinRash />}
          />
          <Route
            path="/skin-and-hair-care/dermatology/warts"
            element={<Warts />}
          />
          <Route
            path="/travel-and-global-care/travel-medicine/altitude-sickness"
            element={<AltitudeSickness />}
          />
          <Route
            path="/travel-and-global-care/global-cross-border-care/cross-border-consultation"
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
            path="/travel-and-global-care/travel-medicine/food-poisoning-while-traveling"
            element={<FoodPoisoningWhileTraveling />}
          />
          <Route
            path="/travel-and-global-care/global-cross-border-care/international-medical-assistance"
            element={<InternationalMedicalAssistance />}
          />
          <Route
            path="/travel-and-global-care/travel-medicine/malaria-prevention"
            element={<MalariaPrevention />}
          />
          <Route path="/jet-lag" element={<JetLag />} />
          <Route
            path="/travel-and-global-care/global-cross-border-care/medication-refill-while-traveling"
            element={<MedicationRefillTraveling />}
          />
          <Route path="/motion-sickness" element={<MotionSickness />} />
          <Route
            path="/travel-and-global-care/travel-medicine/post-travel-symptoms"
            element={<PostTravelSymptoms />}
          />
          <Route
            path="/travel-and-global-care/travel-medicine/pre-travel-vaccinations"
            element={<PreTravelVaccinations />}
          />
          <Route
            path="/travel-and-global-care/global-cross-border-care/referral-coordination-overseas"
            element={<ReferralCoordinationOverseas />}
          />
          <Route
            path="/travel-medical-certification"
            element={<TravelMedicalCertificate />}
          />
          <Route
            path="/travel-and-global-care/travel-medicine/travel-related-fever"
            element={<TravelRelatedFever />}
          />
          <Route
            path="/travel-and-global-care/travel-medicine/travelers-diarrhea"
            element={<TravelersDiarrhea1 />}
          />
          <Route
            path="/chronic-care/gastroenterology/acid-reflux-gerd"
            element={<AcidRefluxGerd />}
          />
          <Route
            path="/general-and-everyday-care/general-physician/body-aches"
            element={<BodyAches />}
          />
          <Route path="/bronchitis" element={<Bronchitis />} />
          <Route
            path="/general-and-everyday-care/general-physician/cold-and-flu"
            element={<ColdAndFlu />}
          />
          <Route
            path="/chronic-care/gastroenterology/constipation"
            element={<Constipation />}
          />
          <Route
            path="/general-and-everyday-care/general-physician/cough"
            element={<Cough />}
          />
          <Route path="/covid-19" element={<Covid19 />} />
          <Route path="/diarrhea" element={<Diarrhea />} />
          <Route
            path="/chronic-care/neurology/dizziness"
            element={<Dizziness />}
          />
          <Route
            path="/eye-ear-bone/ear-nose-throat/ear-infection"
            element={<EarInfection1 />}
          />
          <Route
            path="/general-and-everyday-care/general-physician/fatigue"
            element={<Fatigue />}
          />
          <Route
            path="/general-and-everyday-care/general-physician/fever"
            element={<Fever />}
          />
          <Route path="/food-poisoning" element={<FoodPoisoning />} />
          <Route
            path="/general-and-everyday-care/general-physician/headache"
            element={<Headache />}
          />
          <Route path="/insect-bite" element={<InsectBites />} />
          <Route
            path="/chronic-care/neurology/migraine"
            element={<Migraine />}
          />
          <Route path="/minor-burns" element={<MinorBurns />} />
          <Route
            path="/general-and-everyday-care/general-physician/minor-infections"
            element={<MinorInfections />}
          />
          <Route
            path="/general-and-everyday-care/internal-medicine/multi-system-complaints"
            element={<MultiSystemComplaints />}
          />
          <Route
            path="/general-and-everyday-care/general-physician/nausea-and-vomiting"
            element={<NauseaAndVomiting />}
          />
          <Route
            path="/general-and-everyday-care/general-physician/pink-eye"
            element={<PinkEye />}
          />
          <Route
            path="/general-and-everyday-care/internal-medicine/preventive-screening"
            element={<PreventiveScreening />}
          />
          <Route
            path="/general-and-everyday-care/family-medicine/routine-check-ups"
            element={<RoutineCheckUps />}
          />
          <Route path="/seasonal-allergies" element={<SeasonalAllergies />} />
          <Route
            path="/general-and-everyday-care/general-physician/sinus-infection"
            element={<SinusInfection />}
          />
          <Route
            path="/eye-ear-bone/ear-nose-throat/sore-throat"
            element={<SoreThroat />}
          />
          <Route path="/strep-throat" element={<StrepThroat />} />
          <Route
            path="/general-and-everyday-care/internal-medicine/undiagnosed-symptoms"
            element={<UndiagnosedSymptoms />}
          />
          <Route
            path="/general-and-everyday-care/family-medicine/vaccination-advice"
            element={<VaccinationAdvice />}
          />
          <Route
            path="/general-and-everyday-care/family-medicine/whole-family-illnesses"
            element={<WholeFamilyIllnesses />}
          />
          <Route path="/bladder-infection" element={<BladderInfection />} />
          <Route
            path="/mens-health/urology/blood-in-urine"
            element={<BloodInUrine />}
          />
          <Route path="/burning-urination" element={<BurningUrination />} />
          <Route path="/frequent-urination" element={<FrequentUrination />} />
          <Route
            path="/mens-health/urology/kidney-stones"
            element={<KidneyStones />}
          />
          <Route
            path="/mens-health/urology/urinary-incontinence"
            element={<UrinaryIncontinence />}
          />
          <Route
            path="/mens-health/urology/urinary-tract-infection"
            element={<UrinaryTractInfection />}
          />
          <Route
            path="/women-health/obstetrics-and-gynaecology/bacterial-vaginosis"
            element={<BacterialVaginosis />}
          />
          <Route
            path="/women-health/obstetrics-and-gynaecology/birth-control"
            element={<BirthControlConsultation />}
          />
          <Route
            path="/emergency-contraception-guidance"
            element={<EmergencyContraceptionGuidance />}
          />
          <Route path="/heavy-periods" element={<HeavyPeriods />} />
          <Route
            path="/women-health/obstetrics-and-gynaecology/irregular-periods"
            element={<IrregularPeriods />}
          />
          <Route
            path="/women-health/lactation-consulting/latch-problems"
            element={<LatchProblems />}
          />
          <Route
            path="/women-health/lactation-consulting/low-milk-supply"
            element={<LowMilkSupply />}
          />
          <Route
            path="/women-health/menopause-care/hrt-guidance"
            element={<MenopauseSymptoms />}
          />
          <Route
            path="/women-health/obstetrics-and-gynaecology/menstrual-cramps"
            element={<MenstrualCramps />}
          />
          <Route
            path="/women-health/lactation-consulting/nipple-pain"
            element={<NipplePain />}
          />
          <Route
            path="/women-health/obstetrics-and-gynaecology/pcos"
            element={<Pcos />}
          />
          <Route
            path="/women-health/obstetrics-and-gynaecology/pelvic-pain"
            element={<PelvicPain />}
          />
          <Route
            path="/women-health/women-mental-health/perinatal-anxiety"
            element={<PerinatalAnxiety />}
          />
          <Route path="/postpartum-concerns" element={<PostpartumConcerns />} />
          <Route
            path="/women-health/women-mental-health/pmdd"
            element={<Pmdd />}
          />
          <Route
            path="/pregnancy-related-questions"
            element={<PregnancyRelatedQuestions />}
          />
          <Route
            path="/women-health/women-mental-health/postnatal-depression"
            element={<PostnatalDepression />}
          />
          <Route
            path="/women-health/obstetrics-and-gynaecology/prenatal-consultation"
            element={<PrenatalConsultation />}
          />
          <Route
            path="/women-health/obstetrics-and-gynaecology/vaginal-yeast-infection"
            element={<VaginalYeastInfection />}
          />
          <Route
            path="/women-health/lactation-consulting/weaning-guidance"
            element={<WeaningGuidance />}
          />
          <Route
            path="/mental-health/psychology-counseling/stress"
            element={<Stress />}
          />
          <Route
            path="/mental-health/behavioral-health/anger-management"
            element={<AngerManagement />}
          />
          <Route
            path="/mental-health/behavioral-health/adjustment-difficulties"
            element={<AdjustmentDifficulties />}
          />
          <Route
            path="/mental-health/behavioral-health/substance-use-support"
            element={<SubstanceUseSupport />}
          />
          <Route
            path="/mental-health/behavioral-health/sleep-related-anxiety"
            element={<SleepRelatedAnxiety />}
          />
          <Route
            path="/mental-health/psychiatry/depression"
            element={<Depression />}
          />
          <Route
            path="/mental-health/psychiatry/anxiety"
            element={<Anxiety />}
          />
          <Route path="/burnout" element={<Burnout />} />
          <Route
            path="/mental-health/psychiatry/bipolar-disorder-follow-up"
            element={<BipolarDisorderFollowUp />}
          />
          <Route path="/mental-health/psychiatry/ptsd" element={<PTSD />} />
          <Route
            path="/mental-health/psychiatry/panic-attacks"
            element={<PanicAttacks />}
          />
          <Route
            path="/mental-health/psychiatry/insomnia"
            element={<Insomnia />}
          />
          <Route
            path="/mental-health/psychiatry/adhd-evaluation"
            element={<AdhdEvaluation />}
          />
          <Route
            path="/mental-health/psychology-counseling/grief-and-loss"
            element={<GriefAndLoss />}
          />
          <Route
            path="/mental-health/psychology-counseling/relationship-stress"
            element={<RelationshipStress />}
          />
          <Route
            path="/mental-health/psychology-counseling/low-self-esteem"
            element={<LowSelfEsteem />}
          />
          <Route
            path="/mental-health/psychology-counseling/trauma-support"
            element={<TraumaSupport />}
          />
          <Route
            path="/women-health/menopause-care/hot-flashes"
            element={<HotFlashes />}
          />
          <Route
            path="/women-health/menopause-care/hrt-guidance"
            element={<HrtGuidance />}
          />
          <Route
            path="/chronic-medication-management"
            element={<ChronicMedicationManagement />}
          />
          {/* <Route path="/mens-health/urology/bladder-problems" element={<BladderProblems />} /> */}
          {/* <Route
            path="/mens-health/men-health/erectile-dysfunction"
            element={<ErectileDysfunction />}
          /> */}
          <Route
            path="/mens-health/men-health/hair-loss"
            element={<HairLossMensHealth />}
          />
          {/* <Route path="/mens-health/men-health/low-libido" element={<LowLibido />} /> */}
          {/* <Route
            path="/mens-health/men-health/low-testosterone-symptoms"
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
          {/* <Route path="/mens-health/men-health/prostate-health" element={<ProstateHealth />} /> */}
          {/* <Route
            path="/urinary-symptoms-men"
            element={<UrinarySymptomsMen />}
          />
          <Route path="/mental-health/psychiatry/adhd-evaluation" element={<ADHDEvaluation />} />
          <Route
          /> */}
          <Route
            path="/mens-health/urology/bladder-problems"
            element={<BladderProblems1 />}
          />
          <Route
            path="/mens-health/men-health/erectile-dysfunction"
            element={<ErectileDysfunction1 />}
          />
          {/* <Route path="/skin-and-hair-care/dermatology/hair-loss" element={<HairLoss />} /> */}
          <Route
            path="/mens-health/men-health/low-libido"
            element={<LowLibido1 />}
          />
          <Route
            path="/mens-health/men-health/low-testosterone-symptoms"
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
          <Route
            path="/mens-health/men-health/prostate-health"
            element={<ProstateHealth1 />}
          />
          <Route
            path="/urinary-symptoms-in-men"
            element={<UrinarySymptomsMen1 />}
          />
          <Route
            path="/women-health/obstetrics-and-gynaecology/fertility-concerns"
            element={<FertilityConcerns />}
          />
          <Route path="/mental-health/psychiatry/Ocd" element={<Ocd />} />
          <Route
            path="/eye-ear-bone/ophthalmology/eye-irritation"
            element={<EyeIrritation />}
          />
          {/* <Route
            path="/mental-health/behavioral-health/adjustment-difficulties"
            element={<UrinarySymptomsMen />}
          /> */}
          <Route path="/doctors-note" element={<DoctorsNote />} />
          {/* <Route path="/appointment-booking" element={<AppointmentBooking />} /> */}
          <Route
            path="/appointment-booking/form"
            element={<AppointmentBookingForm />}
          />
          <Route path="/primary-care-provider" element={<PCP />} /> {/* PCP */}
          {/* Blog individual Pages */}
          <Route path="/what-is-telemedicine" element={<Telemedicine />} />
          <Route
            path="/telemedicine-services"
            element={<TelemedicineServices />}
          />
          <Route
            path="/how-does-a-telemedicine-appointment-work"
            element={<HowTelemedicineAppointmentWork />}
          />
          <Route
            path="/online-doctor-consultation"
            element={<OnlineDoctorConsultation />}
          />
          <Route
            path="/conditions-treated-through-telemedicine"
            element={<MedicalConditions />}
          />
          <Route
            path="/top-telemedicine-platforms-providers"
            element={<TopTelemedicinePlatforms />}
          />
          <Route path="/is-telemedicine-safe" element={<TelemedicineSafe />} />
          <Route
            path="/telemedicine-vs-in-person-doctor-visits"
            element={<TelemedicineInPerson />}
          />
          <Route path="/telemedicine-cost-usa" element={<TelemedicineCost />} />
          <Route
            path="/are-online-doctors-real-doctors"
            element={<OnlineDoctorRealDoctor />}
          />
          <Route
            path="/future-of-telemedicine"
            element={<FutureofTelemedicine />}
          />
          {/* PRIVACY  */}
          <Route path="/privacy-concerns" element={<PrivacyConcerns />} />
          {/* demo */}
          <Route
            path="/patient-privacy-notice"
            element={<PatientPrivacyNotice />}
          />
          {/* <Route path="/privacy-policy" element={<PrivacyPolicy />} /> */}
          {/* <Route
            path="/provider-terms-of-service"
            element={<ProviderTermsofService />}
          /> */}
          <Route
            path="/refund-and-cancellation-policy"
            element={<RefundCancellation />}
          />
          <Route
            path="/tele-health-informed-consent"
            element={<TeleHealthConsent />}
          />
          {/* <Route path="/terms-of-service" element={<TermsService />} /> */}
          {/* <Route
            path="/accessibility-statement"
            element={<AccessibilityStatement />}
          /> */}
          <Route path="/CCPA" element={<CCPA />} />
          {/* <Route path="/cookie-policy" element={<CookiePolicy />} /> */}
          {/* <Route
            path="/notice-of-privacy-practices"
            element={<NoticePrivacy />}
          /> */}
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
          <Route path="/career" element={<DoctorCareers />} />
          <Route path="/support-center" element={<FAQ />} />
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
          <Route path="/service-sexual-health" element={<SexualHealth />} />
          <Route
            path="/weight-loss-programs"
            element={<WeightLossPrograms />}
          />
          <Route
            path="/export-medical-opinion"
            element={<ExpertMedicalOpinion />}
          />
          <Route
            path="/chronic-care/gastroenterology"
            element={<Gastroenterology />}
          />
          <Route path="/chronic-care/neurology" element={<Neurology />} />
          <Route path="/chronic-care/pulmonology" element={<Pulmonology />} />
          <Route path="/ent" element={<Ent />} />
          <Route
            path="/eye-ear-bone/ophthalmology"
            element={<Ophthalmology />}
          />
          <Route path="/eye-ear-bone/orthopedics" element={<Orthopedics />} />
          {/* <Route path="/mens-health-men-health" element={<SpeMensHealth />} /> */}
          <Route path="/mens-health/urology" element={<Urology />} />
          <Route
            path="/mental-health/behavioral-health"
            element={<BehavioralHealth />}
          />
          <Route path="/mental-health/psychiatry" element={<Psychiatry />} />
          <Route
            path="/mental-health/psychology-counseling"
            element={<PsychologyCounseling />}
          />
          <Route
            path="/sexual-health/sexual-health-and-wellness"
            element={<SexualHealthSpeciality />}
          />
          <Route
            path="/skin-and-hair-care/dermatology"
            element={<Dermatology />}
          />
          <Route
            path="/travel-and-global-care/global-cross-border-care"
            element={<GlobalCrossBorderCare />}
          />
          <Route
            path="/travel-and-global-care/travel-medicine"
            element={<TravelMedicine />}
          />
          <Route
            path="/weight-and-nurtrition/weight-management"
            element={<WeightManagement />}
          />
          <Route
            path="/weight-and-nurtrition/lifestyle-medicine"
            element={<LifestyleMedicine />}
          />
          <Route
            path="/weight-and-nurtrition/nutrition-and-dietetics"
            element={<NutritionAndDietetics />}
          />
          <Route path="/fit-to-fly-certificate" element={<FittoFly />} />
          <Route path="/lab-requisitions" element={<LABREQUISITIONS />} />
          <Route
            path="/doctor-note-or-sick-notes"
            element={<DoctorNoteSickNote />}
          />
          <Route
            path="/eye-ear-bone/ear-nose-throat/vertigo"
            element={<Vertigo />}
          />
          <Route path="/category-consultant" element={<CategoryConsultant />} />
          <Route path="/service-consultant" element={<CategoryConsultant />} />
          {/* New Privcay Policy Pages Start */}
          <Route path="/refund-cancellation-policy" element={<Refundcancellationpolicy />} />
          <Route path="/provider-terms-of-service" element={<ProviderTermsOfService1 />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy1 />} />
          <Route path="/terms-of-service" element={<TermsOfService1 />} />
          <Route path="/hippa-notice-of-privacy-practices" element={<HippaNoticeOfPrivacyPractices1 />} />
          <Route path="/california-privacy-rights-notice" element={<CaliforniaPrivacyRightsNotice1 />} />
          <Route path="/cookie-policy" element={<CookiePolicy1 />} />
          <Route path="/accessibility-statement" element={<AccessibilityStatement1 />} />
          {/* New Privcay Policy Pages End */}
          <Route
            path="/appointment-booking/category-confirm"
            element={<CategoryAppointmentConfirm />}
          />

          <Route path="*" element={<NotFound />} />
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
