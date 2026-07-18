import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import "./Login.css";

function EyeIcon({ open }) {
  return open ? (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const PASSWORD_REQUIREMENTS =
  "8+ chars, uppercase, lowercase, number & symbol.";
const VISUALLY_HIDDEN = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "qwerty123",
  "admin123",
  "admin1234",
  "welcome1",
  "welcome123",
  "letmein1",
  "iloveyou1",
  "humancare",
  "humancare123",
  "doctor123",
  "patient123",
]);
const DOB_MIN = "1900-01-01";
const IP_COUNTRY_ENDPOINT = "https://api.country.is/";
const IP_COUNTRY_TIMEOUT_MS = 3500;
const todayISO = () => new Date().toISOString().slice(0, 10);

async function getIpCountryCode() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IP_COUNTRY_TIMEOUT_MS);

  try {
    const res = await fetch(IP_COUNTRY_ENDPOINT, {
      signal: controller.signal,
    });
    if (!res.ok) return "";
    const data = await res.json();
    return String(data?.country || "").toUpperCase();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function getPasswordError(password) {
  const value = String(password || "");
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(value))
    return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(value))
    return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(value)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(value))
    return "Password must include at least one special character.";
  if (COMMON_PASSWORDS.has(value.toLowerCase()))
    return "Password is too common. Choose a stronger password.";
  return "";
}

function getDobError(dob) {
  if (!dob) return "Select Date of Birth";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return "Enter a valid Date of Birth";
  if (Number.isNaN(new Date(`${dob}T00:00:00`).getTime()))
    return "Enter a valid Date of Birth";
  if (dob.startsWith("0000")) return "Enter a valid year of birth";
  if (dob > todayISO()) return "Date of Birth cannot be in the future";
  if (dob < DOB_MIN) return "Date of Birth must be in or after 1900";
  return "";
}
import api, { setUserAuthToken, getUserAuthToken } from "../api";
import { useAuth } from "../context/AuthContext";
import PhoneInputField, {
  COUNTRIES as PHONE_COUNTRIES,
  parseValue as parsePhoneValue,
  findCountryByName,
  getFlagUrl,
  toFlag,
} from "../components/PhoneInputField";
import DatePickerField from "../components/DatePickerField";
import useLocationData from "../hooks/useLocationData";
import useCountries from "../hooks/useCountries";

/* ─── Google icon ────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

/* ─── 6-digit OTP input ──────────────────────────────────────── */
function OTPInput({
  value,
  onChange,
  boxClass = "hc-otp-box",
  idPrefix = "patient-otp",
  namePrefix = "patientOtp",
}) {
  const inputs = useRef([]);
  const digits = (value + "      ").slice(0, 6).split("");

  const move = (i) => inputs.current[i]?.focus();

  const handleChange = (i, e) => {
    const ch = e.target.value.replace(/\D/g, "").slice(-1);
    const arr = [...digits];
    arr[i] = ch || " ";
    onChange(arr.join("").trimEnd().replace(/ /g, ""));
    if (ch && i < 5) move(i + 1);
  };

  const handleKey = (i, e) => {
    if (e.key === "Backspace") {
      const arr = [...digits];
      if (arr[i].trim()) {
        arr[i] = " ";
        onChange(arr.join("").trimEnd().replace(/ /g, ""));
      } else if (i > 0) {
        arr[i - 1] = " ";
        onChange(arr.join("").trimEnd().replace(/ /g, ""));
        move(i - 1);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(text);
    move(Math.min(text.length, 5));
  };

  return (
    <div className="hc-otp-boxes">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          id={`${idPrefix}-${i + 1}`}
          name={`${namePrefix}${i + 1}`}
          aria-label={`OTP digit ${i + 1}`}
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i].trim()}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          className={boxClass}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}

/* ─── Flow card wrapper (OTP / Forgot PW screens) ───────────── */
function FlowCard({ icon, title, subtitle, formError, onBack, children }) {
  return (
    <div className="hc-page-bg">
      <div className="hc-card hc-card--flow">
        <div className="hc-flow-card">
          <div className="hc-flow-icon">{icon}</div>
          <h1 className="hc-heading">{title}</h1>
          <p
            className="hc-subtext"
            style={{ marginTop: 8, marginBottom: formError ? 4 : 16 }}
          >
            {subtitle}
          </p>
          {formError && <p className="hc-form-error">{formError}</p>}
          {children}
          <button type="button" onClick={onBack} className="hc-back-btn">
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main auth component ────────────────────────────────────── */
export default function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [view, setView] = useState("auth");
  const [isRegister, setIsRegister] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    mobile: "",
    dob: "",
    gender: "",
    country: "",
    state: "",
    city: "",
    password: "",
    terms: false,
    privacyConsent: false,
    hipaaConsent: false,
  });

  const [googlePending, setGooglePending] = useState(null);
  const [googleProfile, setGoogleProfile] = useState({
    mobile: "",
    dob: "",
    gender: "",
    country: "",
    terms: false,
    privacyConsent: false,
    hipaaConsent: false,
  });

  const [otpValue, setOtpValue] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const timerRef = useRef(null);
  const countryManuallySelectedRef = useRef(false);
  const ipCountryAppliedRef = useRef(false);
  const googleCountryManuallySelectedRef = useRef(false);
  const googleIpCountryAppliedRef = useRef(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPasswords, setShowPasswords] = useState({
    register: false,
    login: false,
    newPass: false,
    confirmPass: false,
  });

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(
    location.state?.registered
      ? "Account created successfully! Please sign in."
      : "",
  );
  const registerPasswordError = registerForm.password
    ? getPasswordError(registerForm.password)
    : "";
  const { states, cities, loadingStates, loadingCities } = useLocationData(
    registerForm.country,
    registerForm.state,
  );

  const {
    data: countries = [],
    isLoading: loadingCountries,
    error: countriesError,
    refetch: refetchCountries,
  } = useCountries();

  const clrErr = () => {
    setFormError("");
    setFormSuccess("");
  };
  const saveUserToken = ({ accessToken, refreshToken } = {}) => {
    setUserAuthToken(accessToken, refreshToken);
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setOtpTimer(60);
    timerRef.current = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const goTo = (v) => {
    setView(v);
    setFormError("");
    setOtpValue("");
  };

  const handleCountrySelect = (e) => {
    countryManuallySelectedRef.current = true;
    const countryName = e.target.value;
    const selected = findCountryByName(countryName);
    if (!selected) {
      return setRegisterForm((p) => ({ ...p, country: countryName }));
    }
    const { local } = parsePhoneValue(registerForm.mobile, selected.code);
    setRegisterForm((p) => ({
      ...p,
      country: selected.name,
      mobile: `+${selected.dial}${local}`,
    }));
  };

  const getPhoneCountryForLocationCountry = (country) => {
    if (!country) return null;
    return (
      PHONE_COUNTRIES.find(
        (phoneCountry) =>
          phoneCountry.code === String(country.isoCode || "").toUpperCase(),
      ) || findCountryByName(country.name)
    );
  };

  const getMobileWithCountryCode = (mobile, country, fallbackCode = "auto") => {
    const phoneCountry = getPhoneCountryForLocationCountry(country);
    const dialCode = String(
      phoneCountry?.dial || country?.phonecode || "",
    ).replace(/\D/g, "");
    const { local } = parsePhoneValue(
      mobile,
      phoneCountry?.code || country?.isoCode || fallbackCode,
    );

    return dialCode ? `+${dialCode}${local}` : mobile;
  };

  const selectedPhoneCountry = findCountryByName(registerForm.country);
  const selectedGoogleCountry = countries.find(
    (country) => country.name === googleProfile.country,
  );
  const selectedGooglePhoneCountry =
    getPhoneCountryForLocationCountry(selectedGoogleCountry) ||
    findCountryByName(googleProfile.country);

  useEffect(() => {
    let cancelled = false;

    if (ipCountryAppliedRef.current || countries.length === 0) return;
    if (countryManuallySelectedRef.current) return;

    getIpCountryCode().then((countryCode) => {
      if (cancelled || !countryCode || countryManuallySelectedRef.current) {
        return;
      }

      const detectedCountry = countries.find(
        (country) => country.isoCode?.toUpperCase() === countryCode,
      );
      if (!detectedCountry) return;

      ipCountryAppliedRef.current = true;
      setRegisterForm((prev) => {
        if (countryManuallySelectedRef.current) return prev;
        const existingCountry = findCountryByName(prev.country);
        const canReplaceCountry =
          !prev.country ||
          (!countryManuallySelectedRef.current &&
            existingCountry?.code === "IN");

        if (!canReplaceCountry) return prev;

        return {
          ...prev,
          country: detectedCountry.name,
          state: "",
          city: "",
          mobile: getMobileWithCountryCode(
            prev.mobile,
            detectedCountry,
            existingCountry?.code || "auto",
          ),
        };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [countries]);

  useEffect(() => {
    let cancelled = false;

    if (!googlePending || googleIpCountryAppliedRef.current) return;
    if (countries.length === 0 || googleCountryManuallySelectedRef.current) {
      return;
    }

    getIpCountryCode().then((countryCode) => {
      if (
        cancelled ||
        !countryCode ||
        googleCountryManuallySelectedRef.current
      ) {
        return;
      }

      const detectedCountry = countries.find(
        (country) => country.isoCode?.toUpperCase() === countryCode,
      );
      if (!detectedCountry) return;

      googleIpCountryAppliedRef.current = true;
      setGoogleProfile((prev) => {
        if (googleCountryManuallySelectedRef.current) {
          return prev;
        }
        const existingCountry = findCountryByName(prev.country);
        const canReplaceCountry = !prev.country || existingCountry?.code === "IN";

        if (!canReplaceCountry) return prev;

        return {
          ...prev,
          country: detectedCountry.name,
          mobile: getMobileWithCountryCode(
            prev.mobile,
            detectedCountry,
            existingCountry?.code || "auto",
          ),
        };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [countries, googlePending]);

  useEffect(() => {
    if (!countryOpen) return;
    const close = (e) => {
      if (!e.target.closest(".hc-country-dropdown")) setCountryOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [countryOpen]);

  function afterLogin(user) {
    login(user);
    void import("../socket").then(({ default: socket }) => {
      if (!socket.connected) socket.connect();
      // Explicit, role-scoped token — this is exactly the moment a stale
      // identity from an earlier role on the same live socket connection
      // would otherwise linger (e.g. the browser was previously used for a
      // doctor session). See the server's resolveSocketIdentity for why.
      socket.emit("user-online", {
        userId: user._id,
        role: user.role,
        token: getUserAuthToken(user.role),
      });
    });
    const from = location.state?.from;
    const doctor = location.state?.doctor;
    if (from) {
      navigate(from, doctor ? { state: { doctor } } : undefined);
    } else {
      navigate("/user/dashboard");
    }
  }

  /* ── Google ──────────────────────────────────────────────── */
  const initiateGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      clrErr();
      try {
        const res = await api.post("/api/auth/google", {
          accessToken: tokenResponse.access_token,
        });
        if (res.data.isNewUser) {
          setGooglePending({
            accessToken: tokenResponse.access_token,
            name: res.data.googleName,
            email: res.data.googleEmail,
          });
          setIsRegister(true);
          return;
        }
        saveUserToken(res.data);
        afterLogin(res.data.user);
      } catch (err) {
        setFormError(err.response?.data?.msg || "Google Sign-In failed.");
      }
    },
    onError: () => setFormError("Google Sign-In failed."),
  });

  const handleGoogleComplete = async (e) => {
    e.preventDefault();
    if (!googleProfile.mobile) return setFormError("Enter mobile number");
    const googleDobError = getDobError(googleProfile.dob);
    if (googleDobError) return setFormError(googleDobError);
    if (!googleProfile.gender) return setFormError("Select Gender");
    if (!googleProfile.country) return setFormError("Select your country");
    if (
      !googleProfile.terms ||
      !googleProfile.privacyConsent ||
      !googleProfile.hipaaConsent
    ) {
      return setFormError(
        "Accept Terms, Privacy Policy, and HIPAA consent requirements",
      );
    }
    setLoading(true);
    clrErr();
    try {
      const res = await api.post("/api/auth/google", {
        accessToken: googlePending.accessToken,
        mobile: googleProfile.mobile,
        dob: googleProfile.dob,
        gender: googleProfile.gender,
        country: googleProfile.country,
        privacyConsent: googleProfile.privacyConsent,
        hipaaConsent: googleProfile.hipaaConsent,
      });
      saveUserToken(res.data);
      afterLogin(res.data.user);
    } catch (err) {
      setFormError(err.response?.data?.msg || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Login ───────────────────────────────────────────────── */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    clrErr();
    try {
      const res = await api.post("/api/auth/login", loginForm);
      saveUserToken(res.data);
      afterLogin(res.data.user);
    } catch (err) {
      setFormError(err.response?.data?.msg || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Register → send OTP ─────────────────────────────────── */
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    clrErr();

    if (!/^[a-zA-Z\s]+$/.test(registerForm.name.trim())) {
      return setFormError("Name must contain only letters.");
    }
    if (registerForm.name.trim().length < 2) {
      return setFormError("Please enter your full name.");
    }

    if (
      !registerForm.terms ||
      !registerForm.privacyConsent ||
      !registerForm.hipaaConsent
    ) {
      return setFormError(
        "Accept Terms, Privacy Policy, and HIPAA consent requirements",
      );
    }
    const passwordError = getPasswordError(registerForm.password);
    if (passwordError) return setFormError(passwordError);
    if (!registerForm.mobile) return setFormError("Enter mobile number");
    const dobError = getDobError(registerForm.dob);
    if (dobError) return setFormError(dobError);
    if (!registerForm.gender) return setFormError("Select Gender");
    if (!registerForm.country) return setFormError("Select your country");
    if (!registerForm.state)
      return setFormError("Select your state / province");
    // if (!registerForm.city) return setFormError("Select your city");
    setLoading(true);
    try {
      await api.post("/api/auth/send-register-otp", {
        email: registerForm.email,
        password: registerForm.password,
        dob: registerForm.dob,
        name: registerForm.name,
        privacyConsent: registerForm.privacyConsent,
        hipaaConsent: registerForm.hipaaConsent,
      });
      goTo("register-otp");
      startTimer();
    } catch (err) {
      setFormError(err.response?.data?.msg || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  /* ── OTP submit → create account ────────────────────────── */
  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    if (otpValue.length < 6)
      return setFormError("Enter the complete 6-digit OTP");
    setLoading(true);
    clrErr();
    try {
      const { terms, ...data } = registerForm;
      const res = await api.post("/api/auth/register", {
        ...data,
        otp: otpValue,
      });
      saveUserToken(res.data);
      if (timerRef.current) clearInterval(timerRef.current);
      setOtpValue("");
      setRegisterForm({
        name: "",
        email: "",
        mobile: "",
        dob: "",
        gender: "",
        country: "",
        password: "",
        terms: false,
        privacyConsent: false,
        hipaaConsent: false,
      });
      afterLogin(res.data.user);
    } catch (err) {
      setOtpValue("");
      setFormError(err.response?.data?.msg || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendRegisterOTP = async () => {
    clrErr();
    try {
      await api.post("/api/auth/send-register-otp", {
        email: registerForm.email,
        password: registerForm.password,
        dob: registerForm.dob,
        name: registerForm.name,
        privacyConsent: registerForm.privacyConsent,
        hipaaConsent: registerForm.hipaaConsent,
      });
      startTimer();
    } catch {
      setFormError("Could not resend OTP.");
    }
  };

  /* ── Forgot password ─────────────────────────────────────── */
  const handleForgotSend = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return setFormError("Enter your email address");
    setLoading(true);
    clrErr();
    try {
      await api.post("/api/auth/send-forgot-otp", { email: forgotEmail });
      goTo("forgot-otp");
      startTimer();
    } catch (err) {
      setFormError(err.response?.data?.msg || "Could not send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotVerify = async (e) => {
    e.preventDefault();
    if (otpValue.length < 6)
      return setFormError("Enter the complete 6-digit OTP");
    setLoading(true);
    clrErr();
    try {
      const res = await api.post("/api/auth/verify-forgot-otp", {
        email: forgotEmail,
        otp: otpValue,
      });
      setResetToken(res.data.resetToken);
      goTo("forgot-reset");
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (err) {
      setOtpValue("");
      setFormError(err.response?.data?.msg || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotResend = async () => {
    clrErr();
    try {
      await api.post("/api/auth/send-forgot-otp", { email: forgotEmail });
      startTimer();
    } catch {
      setFormError("Could not resend OTP.");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const passwordError = getPasswordError(newPass);
    if (passwordError) return setFormError(passwordError);
    if (newPass !== confirmPass) return setFormError("Passwords do not match");
    setLoading(true);
    clrErr();
    try {
      await api.post("/api/auth/reset-password", {
        resetToken,
        newPassword: newPass,
      });
      setView("auth");
      setIsRegister(false);
      setForgotEmail("");
      setResetToken("");
      setNewPass("");
      setConfirmPass("");
      setFormSuccess("Password reset successfully! Please sign in.");
    } catch (err) {
      setFormError(err.response?.data?.msg || "Reset failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ══════════════════════════════════════════
     RENDER PRIORITY
  ══════════════════════════════════════════ */

  /* Google profile completion */
  if (googlePending) {
    return (
      <div className="hc-page-bg">
        <div className="hc-card hc-card--flow">
          <form onSubmit={handleGoogleComplete} className="hc-flow-card">
            <div className="hc-flow-icon">🩺</div>
            <h1 className="hc-heading" style={{ marginBottom: 0 }}>
              Complete Your Profile
            </h1>
            <p
              className="hc-subtext"
              style={{ marginTop: 8, marginBottom: formError ? 4 : 16 }}
            >
              Welcome,{" "}
              <strong style={{ color: "#2563eb" }}>{googlePending.name}</strong>
              ! Just a few more details.
            </p>
            {formError && <p className="hc-form-error">{formError}</p>}
            <label htmlFor="google-profile-name" style={VISUALLY_HIDDEN}>
              Full Name
            </label>
            <input
              id="google-profile-name"
              name="googleProfileName"
              className="hc-input"
              type="text"
              value={googlePending.name}
              disabled
              style={{ opacity: 0.55, cursor: "not-allowed" }}
            />
            <label htmlFor="google-profile-email" style={VISUALLY_HIDDEN}>
              Email Address
            </label>
            <input
              id="google-profile-email"
              name="googleProfileEmail"
              className="hc-input"
              type="email"
              value={googlePending.email}
              disabled
              style={{ opacity: 0.55, cursor: "not-allowed" }}
            />
            <div className="hc-row hc-reg-row">
              <div className="hc-field-wrap">
                <label htmlFor="google-profile-dob" className="hc-reg-label">
                  Date of Birth
                </label>
                <DatePickerField
                  id="google-profile-dob"
                  name="googleProfileDob"
                  value={googleProfile.dob}
                  onChange={(v) => setGoogleProfile((p) => ({ ...p, dob: v }))}
                  min={DOB_MIN}
                  max={todayISO()}
                  placeholder="Date of Birth"
                  required
                />
              </div>
              <div className="hc-field-wrap">
                <label htmlFor="google-profile-gender" className="hc-reg-label">
                  Gender
                </label>
                <div className="hc-gender-wrap">
                  <select
                    id="google-profile-gender"
                    name="googleProfileGender"
                    className="hc-select hc-gender-select"
                    value={googleProfile.gender}
                    onChange={(e) =>
                      setGoogleProfile((p) => ({
                        ...p,
                        gender: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="" disabled>
                      Select gender
                    </option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <svg
                    className="hc-gender-arrow"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="hc-row hc-reg-row hc-country-mobile-row">
              <div className="hc-field-wrap">
                <label htmlFor="google-profile-country" className="hc-reg-label">
                  Country
                </label>
                <select
                  id="google-profile-country"
                  name="googleProfileCountry"
                  className="hc-select hc-country-select"
                  value={googleProfile.country}
                  onChange={(e) => {
                    googleCountryManuallySelectedRef.current = true;
                    const selectedCountry = countries.find(
                      (country) => country.name === e.target.value,
                    );

                    setGoogleProfile((p) => ({
                      ...p,
                      country: e.target.value,
                      mobile: selectedCountry
                        ? getMobileWithCountryCode(p.mobile, selectedCountry)
                        : p.mobile,
                    }));
                  }}
                  required
                  disabled={loadingCountries}
                >
                  <option value="">
                    {loadingCountries
                      ? "Loading countries..."
                      : countriesError
                        ? "Failed to load countries"
                        : "Select Country"}
                  </option>
                  {!loadingCountries &&
                    !countriesError &&
                    countries.map((c) => (
                      <option key={c.isoCode} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>
                {countriesError && (
                  <button
                    type="button"
                    onClick={() => refetchCountries()}
                    className="hc-google-retry-btn"
                  >
                    Retry Loading Countries
                  </button>
                )}
              </div>
              <div className="hc-field-wrap">
                <label htmlFor="google-profile-mobile" className="hc-reg-label">
                  Mobile Number
                </label>
                <PhoneInputField
                  inputId="google-profile-mobile"
                  inputName="googleProfileMobile"
                  searchInputId="google-profile-mobile-country-search"
                  searchInputName="googleProfileMobileCountrySearch"
                  value={googleProfile.mobile}
                  onChange={(ph, meta) => {
                    googleCountryManuallySelectedRef.current = true;
                    setGoogleProfile((p) => ({
                      ...p,
                      mobile: ph,
                      country: meta?.name || p.country,
                    }));
                  }}
                  onCountryChange={(meta) =>
                    meta?.name &&
                    setGoogleProfile((p) => ({ ...p, country: meta.name }))
                  }
                  defaultCountry={selectedGooglePhoneCountry?.code || "auto"}
                  placeholder="Mobile number"
                  required
                />
              </div>
            </div>
            <div className="hc-consent-row">
              <label
                htmlFor="google-profile-terms"
                className="hc-terms hc-consent-terms"
              >
                <input
                  id="google-profile-terms"
                  name="googleProfileTerms"
                  type="checkbox"
                  checked={googleProfile.terms}
                  onChange={(e) =>
                    setGoogleProfile((p) => ({
                      ...p,
                      terms: e.target.checked,
                    }))
                  }
                  required
                />
                <a href="/terms-of-service" target="_blank" rel="noreferrer">
                  Terms & Conditions
                </a>
              </label>
              <label
                htmlFor="google-profile-privacy-consent"
                className="hc-terms hc-consent-terms"
              >
                <input
                  id="google-profile-privacy-consent"
                  name="googleProfilePrivacyConsent"
                  type="checkbox"
                  checked={googleProfile.privacyConsent}
                  onChange={(e) =>
                    setGoogleProfile((p) => ({
                      ...p,
                      privacyConsent: e.target.checked,
                    }))
                  }
                  required
                />
                <a href="/privacy-policy" target="_blank" rel="noreferrer">
                  Privacy Policy
                </a>
              </label>
              <label
                htmlFor="google-profile-hipaa-consent"
                className="hc-terms hc-consent-terms"
              >
                <input
                  id="google-profile-hipaa-consent"
                  name="googleProfileHipaaConsent"
                  type="checkbox"
                  checked={googleProfile.hipaaConsent}
                  onChange={(e) =>
                    setGoogleProfile((p) => ({
                      ...p,
                      hipaaConsent: e.target.checked,
                    }))
                  }
                  required
                />
                <a
                  href="/patient-informed-consent-form"
                  target="_blank"
                  rel="noreferrer"
                >
                  HIPAA Consent
                </a>
              </label>
            </div>
            <button
              type="submit"
              className="hc-btn hc-btn--primary"
              disabled={loading}
              style={{ marginTop: 16, width: "100%" }}
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
            <button
              type="button"
              className="hc-back-btn"
              onClick={() => {
                setGooglePending(null);
                setIsRegister(false);
                clrErr();
              }}
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* Registration OTP */
  if (view === "register-otp")
    return (
      <FlowCard
        icon="📧"
        title="Verify Your Email"
        subtitle={
          <>
            We sent a 6-digit security code to{" "}
            <strong style={{ color: "#2563eb" }}>{registerForm.email}</strong>
          </>
        }
        formError={formError}
        onBack={() => {
          goTo("auth");
          setIsRegister(true);
        }}
      >
        <form onSubmit={handleOTPSubmit} style={{ width: "100%" }}>
          <OTPInput
            idPrefix="patient-register-otp"
            namePrefix="patientRegisterOtp"
            value={otpValue}
            onChange={(v) => {
              setOtpValue(v);
              clrErr();
            }}
          />
          <p className="hc-otp-resend">
            {otpTimer > 0 ? (
              <>
                Resend in <strong>{otpTimer}s</strong>
              </>
            ) : (
              <>
                Didn't receive it?{" "}
                <button
                  type="button"
                  className="hc-otp-resend-btn"
                  onClick={handleResendRegisterOTP}
                >
                  Resend OTP
                </button>
              </>
            )}
          </p>
          <button
            type="submit"
            className="hc-btn hc-btn--primary"
            disabled={loading || otpValue.length < 6}
            style={{ width: "100%", marginTop: 16 }}
          >
            {loading ? "Verifying..." : "Verify & Create Account"}
          </button>
        </form>
      </FlowCard>
    );

  /* Forgot — enter email */
  if (view === "forgot-email")
    return (
      <FlowCard
        icon="🔒"
        title="Forgot Password"
        subtitle="Enter your registered email and we'll send a reset OTP."
        formError={formError}
        onBack={() => goTo("auth")}
      >
        <form onSubmit={handleForgotSend} style={{ width: "100%" }}>
          <label htmlFor="patient-forgot-email" style={VISUALLY_HIDDEN}>
            Registered Email
          </label>
          <input
            id="patient-forgot-email"
            name="patientForgotEmail"
            className="hc-input"
            type="email"
            placeholder="Your registered email"
            value={forgotEmail}
            onChange={(e) => {
              setForgotEmail(e.target.value);
              clrErr();
            }}
            required
            style={{ marginBottom: 16 }}
          />
          <button
            type="submit"
            className="hc-btn hc-btn--primary"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Sending..." : "Send Reset OTP"}
          </button>
        </form>
      </FlowCard>
    );

  /* Forgot — enter OTP */
  if (view === "forgot-otp")
    return (
      <FlowCard
        icon="🔑"
        title="Enter OTP"
        subtitle={
          <>
            OTP sent to{" "}
            <strong style={{ color: "#2563eb" }}>{forgotEmail}</strong>
          </>
        }
        formError={formError}
        onBack={() => goTo("forgot-email")}
      >
        <form onSubmit={handleForgotVerify} style={{ width: "100%" }}>
          <OTPInput
            idPrefix="patient-forgot-otp"
            namePrefix="patientForgotOtp"
            value={otpValue}
            onChange={(v) => {
              setOtpValue(v);
              clrErr();
            }}
          />
          <p className="hc-otp-resend">
            {otpTimer > 0 ? (
              <>
                Resend in <strong>{otpTimer}s</strong>
              </>
            ) : (
              <>
                Didn't receive it?{" "}
                <button
                  type="button"
                  className="hc-otp-resend-btn"
                  onClick={handleForgotResend}
                >
                  Resend OTP
                </button>
              </>
            )}
          </p>
          <button
            type="submit"
            className="hc-btn hc-btn--primary"
            disabled={loading || otpValue.length < 6}
            style={{ width: "100%", marginTop: 16 }}
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </form>
      </FlowCard>
    );

  /* Forgot — new password */
  if (view === "forgot-reset")
    return (
      <FlowCard
        icon="🔐"
        title="Set New Password"
        subtitle="Choose a strong password for your account."
        formError={formError}
        onBack={() => goTo("forgot-otp")}
      >
        <form onSubmit={handleResetPassword} style={{ width: "100%" }}>
          <div className="hc-pw-wrapper">
            <label htmlFor="patient-new-password" style={VISUALLY_HIDDEN}>
              New Password
            </label>
            <input
              id="patient-new-password"
              name="patientNewPassword"
              className="hc-input"
              type={showPasswords.newPass ? "text" : "password"}
              placeholder="Example: MySecurePass@123!"
              value={newPass}
              onChange={(e) => {
                setNewPass(e.target.value);
                clrErr();
              }}
              required
            />
            <button
              type="button"
              className="hc-pw-toggle"
              onClick={() =>
                setShowPasswords((p) => ({ ...p, newPass: !p.newPass }))
              }
              tabIndex={-1}
            >
              <EyeIcon open={showPasswords.newPass} />
            </button>
          </div>
          <div className="hc-pw-wrapper">
            <label htmlFor="patient-confirm-new-password" style={VISUALLY_HIDDEN}>
              Confirm New Password
            </label>
            <input
              id="patient-confirm-new-password"
              name="patientConfirmNewPassword"
              className="hc-input"
              type={showPasswords.confirmPass ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPass}
              onChange={(e) => {
                setConfirmPass(e.target.value);
                clrErr();
              }}
              required
            />
            <button
              type="button"
              className="hc-pw-toggle"
              onClick={() =>
                setShowPasswords((p) => ({ ...p, confirmPass: !p.confirmPass }))
              }
              tabIndex={-1}
            >
              <EyeIcon open={showPasswords.confirmPass} />
            </button>
          </div>
          <button
            type="submit"
            className="hc-btn hc-btn--primary"
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </FlowCard>
    );

  /* ── Main auth UI ────────────────────────────────────────── */
  return (
    <div className="hc-page-bg">
      <div
        className={`hc-card ${isRegister ? "hc-card--register-active" : ""}`}
      >
        {/* ── REGISTER FORM ─────────────────────────────────── */}
        <div className="hc-form-box hc-form-box--register">
          <form
            onSubmit={handleRegisterSubmit}
            className="hc-form hc-register-form"
          >
            <h1 className="hc-heading">Create Account</h1>
            <p className="hc-form-subtitle">
              Join Humancare Connect and take charge of your health
            </p>

            <div className="hc-social-links">
              <button
                type="button"
                className="hc-google-btn"
                onClick={() => initiateGoogleLogin()}
              >
                <GoogleIcon /> Continue with Google
              </button>
            </div>

            {formError && <p className="hc-form-error">{formError}</p>}

            {/* <input
              className="hc-input"
              type="text"
              placeholder="Full Name"
              value={registerForm.name}
              onChange={(e) =>
                setRegisterForm((p) => ({ ...p, name: e.target.value }))
              }
              required
            /> */}

            <label htmlFor="patient-register-name" style={VISUALLY_HIDDEN}>
              Full Name
            </label>
            <input
              id="patient-register-name"
              name="patientRegisterName"
              className="hc-input"
              type="text"
              placeholder="Full Name"
              value={registerForm.name}
              onChange={(e) => {
                const value = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                setRegisterForm((p) => ({ ...p, name: value }));
              }}
              required
            />

            <label htmlFor="patient-register-email" style={VISUALLY_HIDDEN}>
              Email Address
            </label>
            <input
              id="patient-register-email"
              name="patientRegisterEmail"
              className="hc-input"
              type="email"
              placeholder="Email Address"
              value={registerForm.email}
              onChange={(e) =>
                setRegisterForm((p) => ({ ...p, email: e.target.value }))
              }
              required
              style={{ width: "100%" }}
            />

            <div className="hc-row hc-reg-row">
              <div className="hc-field-wrap">
                <label htmlFor="patient-register-dob" style={VISUALLY_HIDDEN}>
                  Date of Birth
                </label>
                <DatePickerField
                  id="patient-register-dob"
                  name="patientRegisterDob"
                  value={registerForm.dob}
                  onChange={(v) => setRegisterForm((p) => ({ ...p, dob: v }))}
                  min={DOB_MIN}
                  max={todayISO()}
                  placeholder="Date of Birth"
                  required
                />
              </div>
              <div className="hc-field-wrap">
                <label htmlFor="patient-register-gender" style={VISUALLY_HIDDEN}>
                  Gender
                </label>
                <div className="hc-gender-wrap">
                  <select
                    id="patient-register-gender"
                    name="patientRegisterGender"
                    className="hc-select hc-gender-select"
                    value={registerForm.gender}
                    onChange={(e) =>
                      setRegisterForm((p) => ({ ...p, gender: e.target.value }))
                    }
                    required
                  >
                    <option value="" disabled>
                      Select gender
                    </option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <svg
                    className="hc-gender-arrow"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="hc-row hc-reg-row hc-country-mobile-row">
              <div className="hc-field-wrap">
                <div className="hc-country-dropdown">
                  <button
                    type="button"
                    className="hc-country-trigger"
                    onClick={() => {
                      setCountryOpen((v) => !v);
                      if (!countryOpen) setCountrySearch("");
                    }}
                  >
                    {selectedPhoneCountry ? (
                      <>
                        <img
                          src={getFlagUrl(selectedPhoneCountry.code)}
                          alt={selectedPhoneCountry.name}
                          style={{
                            width: 20,
                            height: 15,
                            objectFit: "cover",
                            borderRadius: 2,
                          }}
                        />
                        <span>{selectedPhoneCountry.name}</span>
                      </>
                    ) : (
                      <span>Select Country</span>
                    )}
                  </button>

                  {countryOpen && (
                    <div className="hc-country-menu">
                      <div className="hc-country-search-wrap">
                        <div className="hc-country-search-inner">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="2"
                            style={{ flexShrink: 0 }}
                          >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                          <label
                            htmlFor="patient-register-country-search"
                            style={VISUALLY_HIDDEN}
                          >
                            Search Country
                          </label>
                          <input
                            id="patient-register-country-search"
                            name="patientRegisterCountrySearch"
                            className="hc-country-search-input"
                            type="text"
                            placeholder="Search country"
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                          />
                          {countrySearch && (
                            <button
                              type="button"
                              className="hc-country-search-clear"
                              onClick={() => setCountrySearch("")}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      {loadingCountries ? (
                        <div className="hc-country-loading">
                          Loading countries...
                        </div>
                      ) : countriesError ? (
                        <div className="hc-country-error">
                          <p className="hc-country-error-text">
                            Failed to load countries
                          </p>
                          <button
                            type="button"
                            onClick={() => refetchCountries()}
                            className="hc-country-retry-btn"
                          >
                            Retry
                          </button>
                        </div>
                      ) : countries.length === 0 ? (
                        <div className="hc-country-loading">
                          No countries available
                        </div>
                      ) : (
                        countries
                          .filter(
                            (c) =>
                              !countrySearch ||
                              c.name
                                .toLowerCase()
                                .includes(countrySearch.toLowerCase()),
                          )
                          .map((c) => (
                            <button
                              key={c.isoCode}
                              type="button"
                              className="hc-country-option"
                              onClick={() => {
                                countryManuallySelectedRef.current = true;
                                const { local } = parsePhoneValue(
                                  registerForm.mobile,
                                  c.isoCode,
                                );

                                setRegisterForm((p) => ({
                                  ...p,
                                  country: c.name,
                                  mobile: `+${c.phonecode}${local}`,
                                }));

                                setCountryOpen(false);
                                setCountrySearch("");
                              }}
                            >
                              <img
                                src={getFlagUrl(c.isoCode)}
                                alt={c.name}
                                style={{
                                  width: 20,
                                  height: 15,
                                  objectFit: "cover",
                                  borderRadius: 2,
                                }}
                              />

                              <span>{c.name}</span>
                            </button>
                          ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="hc-field-wrap">
                <label htmlFor="patient-register-mobile" style={VISUALLY_HIDDEN}>
                  Mobile Number
                </label>
                <PhoneInputField
                  inputId="patient-register-mobile"
                  inputName="patientRegisterMobile"
                  searchInputId="patient-register-mobile-country-search"
                  searchInputName="patientRegisterMobileCountrySearch"
                  value={registerForm.mobile}
                  onChange={(ph, meta) => {
                    countryManuallySelectedRef.current = true;
                    setRegisterForm((p) => ({
                      ...p,
                      mobile: ph,
                      country: meta?.name || p.country,
                    }));
                  }}
                  onCountryChange={(meta) =>
                    meta?.name &&
                    setRegisterForm((p) => ({ ...p, country: meta.name }))
                  }
                  defaultCountry={selectedPhoneCountry?.code || "auto"}
                  placeholder="Mobile number"
                  required
                />
              </div>
            </div>

            <div className="hc-row hc-reg-row">
              <div className="hc-field-wrap">
                <label htmlFor="patient-register-state" style={VISUALLY_HIDDEN}>
                  State or Province
                </label>
                <select
                  id="patient-register-state"
                  name="patientRegisterState"
                  className="hc-select hc-state-select"
                  value={registerForm.state}
                  onChange={(e) =>
                    setRegisterForm((p) => ({
                      ...p,
                      state: e.target.value,
                      city: "",
                    }))
                  }
                  disabled={!registerForm.country}
                  required
                >
                  <option value="">
                    {loadingStates
                      ? "Loading..."
                      : registerForm.country
                        ? "Select state / province"
                        : "Select country first"}
                  </option>
                  {states.map((s) => (
                    <option key={s.isoCode} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="hc-field-wrap">
                <label htmlFor="patient-register-city" style={VISUALLY_HIDDEN}>
                  City
                </label>
                <select
                  id="patient-register-city"
                  name="patientRegisterCity"
                  className="hc-select hc-city-select"
                  value={registerForm.city}
                  onChange={(e) =>
                    setRegisterForm((p) => ({ ...p, city: e.target.value }))
                  }
                  disabled={!registerForm.state}
                >
                  <option value="">
                    {loadingCities
                      ? "Loading..."
                      : registerForm.state
                        ? "Select city"
                        : "Select state first"}
                  </option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="hc-pw-wrapper">
              <label htmlFor="patient-register-password" style={VISUALLY_HIDDEN}>
                Password
              </label>
              <input
                id="patient-register-password"
                name="patientRegisterPassword"
                className="hc-input"
                type={showPasswords.register ? "text" : "password"}
                placeholder="Example: MySecurePass@123!"
                value={registerForm.password}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, password: e.target.value }))
                }
                required
              />
              <button
                type="button"
                className="hc-pw-toggle"
                onClick={() =>
                  setShowPasswords((p) => ({ ...p, register: !p.register }))
                }
                tabIndex={-1}
              >
                <EyeIcon open={showPasswords.register} />
              </button>
            </div>
            <p
              className={`hc-pw-requirements${registerPasswordError ? " hc-pw-requirements--error" : ""}`}
            >
              {registerPasswordError || PASSWORD_REQUIREMENTS}
            </p>

            <div className="hc-consent-row">
              <label
                htmlFor="patient-register-terms"
                className="hc-terms hc-consent-terms"
              >
                <input
                  id="patient-register-terms"
                  name="patientRegisterTerms"
                  type="checkbox"
                  checked={registerForm.terms}
                  onChange={(e) =>
                    setRegisterForm((p) => ({
                      ...p,
                      terms: e.target.checked,
                    }))
                  }
                  required
                />
                <a href="/terms-of-service" target="_blank" rel="noreferrer">
                  Terms & Conditions
                </a>
              </label>
              <label
                htmlFor="patient-register-privacy-consent"
                className="hc-terms hc-consent-terms"
              >
                <input
                  id="patient-register-privacy-consent"
                  name="patientRegisterPrivacyConsent"
                  type="checkbox"
                  checked={registerForm.privacyConsent}
                  onChange={(e) =>
                    setRegisterForm((p) => ({
                      ...p,
                      privacyConsent: e.target.checked,
                    }))
                  }
                  required
                />
                <a href="/privacy-policy" target="_blank" rel="noreferrer">
                  Privacy Policy
                </a>
              </label>
              <label
                htmlFor="patient-register-hipaa-consent"
                className="hc-terms hc-consent-terms"
              >
                <input
                  id="patient-register-hipaa-consent"
                  name="patientRegisterHipaaConsent"
                  type="checkbox"
                  checked={registerForm.hipaaConsent}
                  onChange={(e) =>
                    setRegisterForm((p) => ({
                      ...p,
                      hipaaConsent: e.target.checked,
                    }))
                  }
                  required
                />
                <a
                  href="/notice-of-privacy-practices"
                  target="_blank"
                  rel="noreferrer"
                >
                  HIPAA Consent
                </a>
              </label>
            </div>

            <button
              type="submit"
              className="hc-btn hc-btn--primary hc-btn--full"
              disabled={loading}
            >
              {loading ? "Sending OTP…" : "Sign Up"}
            </button>

            <div className="hc-mobile-switch">
              <p>Already have an account?</p>
              <button
                type="button"
                className="hc-btn hc-btn--outline"
                onClick={() => {
                  setIsRegister(false);
                  clrErr();
                }}
              >
                Sign In
              </button>
            </div>
          </form>
        </div>

        {/* ── LOGIN FORM ───────────────────────────────────────── */}
        <div className="hc-form-box hc-form-box--login">
          <form onSubmit={handleLoginSubmit} className="hc-form hc-login-form">
            <h1 className="hc-heading">Welcome Back</h1>
            <p className="hc-form-subtitle">
              Sign in to continue your healthcare journey
            </p>

            <div className="hc-social-links">
              <button
                type="button"
                className="hc-google-btn"
                onClick={() => initiateGoogleLogin()}
              >
                <GoogleIcon /> Continue with Google
              </button>
            </div>

            {formSuccess && (
              <div className="hc-success-msg">
                <span>&#10003;</span> {formSuccess}
              </div>
            )}
            {formError && <p className="hc-form-error">{formError}</p>}
            <span className="hc-divider-text">or use your email</span>

            <label htmlFor="patient-login-email" style={VISUALLY_HIDDEN}>
              Email Address
            </label>
            <input
              id="patient-login-email"
              name="patientLoginEmail"
              className="hc-input"
              type="email"
              placeholder="Email Address"
              value={loginForm.email}
              onChange={(e) =>
                setLoginForm((p) => ({ ...p, email: e.target.value }))
              }
              required
            />
            <div className="hc-pw-wrapper">
              <label htmlFor="patient-login-password" style={VISUALLY_HIDDEN}>
                Password
              </label>
              <input
                id="patient-login-password"
                name="patientLoginPassword"
                className="hc-input"
                type={showPasswords.login ? "text" : "password"}
                placeholder="Password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((p) => ({ ...p, password: e.target.value }))
                }
                required
              />
              <button
                type="button"
                className="hc-pw-toggle"
                onClick={() =>
                  setShowPasswords((p) => ({ ...p, login: !p.login }))
                }
                tabIndex={-1}
              >
                <EyeIcon open={showPasswords.login} />
              </button>
            </div>

            <button
              type="button"
              className="hc-forgot-link"
              onClick={() => {
                setView("forgot-email");
                clrErr();
              }}
            >
              Forgot your password?
            </button>

            <button
              type="submit"
              className="hc-btn hc-btn--primary"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>

            <div className="hc-mobile-switch">
              <p>Don't have an account?</p>
              <button
                type="button"
                className="hc-btn hc-btn--outline"
                onClick={() => {
                  setIsRegister(true);
                  clrErr();
                }}
              >
                Sign Up
              </button>
            </div>
          </form>
        </div>

        {/* ── SLIDING PANEL ─────────────────────────────────────── */}
        <div className="hc-panel-wrapper">
          <div className="hc-panel">
            <div className="hc-panel-content hc-panel-content--left">
              <div className="hc-panel-badge">👋</div>
              <h1 className="hc-panel-heading">Welcome Back!</h1>
              <p className="hc-panel-text">
                Stay connected — log in with your credentials and continue your
                healthcare experience.
              </p>
              <button
                className="hc-btn hc-btn--ghost"
                onClick={() => setIsRegister(false)}
              >
                Sign In
              </button>
            </div>
            <div className="hc-panel-content hc-panel-content--right">
              <div className="hc-panel-badge">🩺</div>
              <h1 className="hc-panel-heading">Join Humancare Connect</h1>
              <p className="hc-panel-text">
                Connect with top doctors, manage appointments, and take control
                of your health today.
              </p>
              <button
                className="hc-btn hc-btn--ghost"
                onClick={() => setIsRegister(true)}
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
