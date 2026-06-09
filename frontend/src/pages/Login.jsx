import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import socket from "../socket";
import "./log.css";

function EyeIcon({ open }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

const PASSWORD_REQUIREMENTS = "8+ chars, uppercase, lowercase, number & symbol.";
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "qwerty123",
  "admin123", "admin1234", "welcome1", "welcome123", "letmein1", "iloveyou1",
  "humancare", "humancare123", "doctor123", "patient123",
]);
const DOB_MIN = "1900-01-01";
const todayISO = () => new Date().toISOString().slice(0, 10);

function getPasswordError(password) {
  const value = String(password || "");
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(value)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(value)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(value)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Password must include at least one special character.";
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return "Password is too common. Choose a stronger password.";
  return "";
}

function getDobError(dob) {
  if (!dob) return "Select Date of Birth";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return "Enter a valid Date of Birth";
  if (Number.isNaN(new Date(`${dob}T00:00:00`).getTime())) return "Enter a valid Date of Birth";
  if (dob.startsWith("0000")) return "Enter a valid year of birth";
  if (dob > todayISO()) return "Date of Birth cannot be in the future";
  if (dob < DOB_MIN) return "Date of Birth must be in or after 1900";
  return "";
}
import api from "../api";
import { useAuth } from "../context/AuthContext";
import PhoneInputField, {
  COUNTRIES as PHONE_COUNTRIES,
  parseValue as parsePhoneValue,
  findCountryByName,
  toFlag,
} from "../components/PhoneInputField";
import DatePickerField from "../components/DatePickerField";
import useLocationData from "../hooks/useLocationData";

/* ─── Google icon ────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

/* ─── 6-digit OTP input ──────────────────────────────────────── */
function OTPInput({ value, onChange, boxClass = "otp-box" }) {
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
    <div className="otp-boxes">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
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
    <div className="main-log">
      <div className="auth-wrapper" style={{ maxWidth: 440, minHeight: "auto" }}>
        <div className="flow-card">
          <div className="flow-icon">{icon}</div>
          <h1 style={{ marginBottom: 0 }}>{title}</h1>
          <p style={{ marginTop: 8, marginBottom: formError ? 4 : 16 }}>{subtitle}</p>
          {formError && <p className="form-error">{formError}</p>}
          {children}
          <button type="button" onClick={onBack}
            style={{
              background: "none", color: "#9ca3af", border: "none", marginTop: 10,
              cursor: "pointer", fontSize: 13, boxShadow: "none", padding: "8px 20px",
              textTransform: "none", fontWeight: 400, letterSpacing: 0
            }}>
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

  /* view: 'auth' | 'register-otp' | 'forgot-email' | 'forgot-otp' | 'forgot-reset' */
  const [view, setView] = useState("auth");
  const [isRegister, setIsRegister] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "", email: "", mobile: "", dob: "", gender: "", country: "", state: "", city: "", password: "",
    terms: false, privacyConsent: false, hipaaConsent: false,
  });

  /* Google profile completion for new users */
  const [googlePending, setGooglePending] = useState(null);
  const [googleProfile, setGoogleProfile] = useState({
    mobile: "", dob: "", gender: "", country: "", privacyConsent: false, hipaaConsent: false,
  });

  /* OTP */
  const [otpValue, setOtpValue] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const timerRef = useRef(null);

  /* Forgot password */
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPasswords, setShowPasswords] = useState({ register: false, login: false, newPass: false, confirmPass: false });

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(
    location.state?.registered ? "Account created successfully! Please sign in." : ""
  );
  const registerPasswordError = registerForm.password ? getPasswordError(registerForm.password) : "";
  const { states, cities, loadingStates, loadingCities } = useLocationData(registerForm.country, registerForm.state);

  /* ── helpers ─────────────────────────────────────────────── */
  const clrErr = () => { setFormError(""); setFormSuccess(""); };
  const saveUserToken = () => {};

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setOtpTimer(60);
    timerRef.current = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const goTo = (v) => { setView(v); setFormError(""); setOtpValue(""); };

  const handleCountrySelect = (e) => {
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

  const selectedPhoneCountry = findCountryByName(registerForm.country);

  useEffect(() => {
    if (!countryOpen) return;
    const close = (e) => {
      if (!e.target.closest(".custom-country-dropdown")) setCountryOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [countryOpen]);

  function afterLogin(user) {
    login(user);
    if (!socket.connected) socket.connect();
    socket.emit("user-online", { userId: user._id, role: user.role });
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
        const res = await api.post("/api/auth/google", { accessToken: tokenResponse.access_token });
        if (res.data.isNewUser) {
          setGooglePending({ accessToken: tokenResponse.access_token, name: res.data.googleName, email: res.data.googleEmail });
          setIsRegister(true);
          return;
        }
        saveUserToken(res.data.token);
        afterLogin(res.data.user);
      } catch (err) { setFormError(err.response?.data?.msg || "Google Sign-In failed."); }
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
    if (!googleProfile.privacyConsent || !googleProfile.hipaaConsent) {
      return setFormError("Accept Terms, Privacy Policy, and HIPAA consent requirements");
    }
    setLoading(true); clrErr();
    try {
      const res = await api.post("/api/auth/google", {
        accessToken: googlePending.accessToken,
        mobile: googleProfile.mobile, dob: googleProfile.dob, gender: googleProfile.gender,
        country: googleProfile.country,
        privacyConsent: googleProfile.privacyConsent,
        hipaaConsent: googleProfile.hipaaConsent,
      });
      saveUserToken(res.data.token);
      afterLogin(res.data.user);
    } catch (err) { setFormError(err.response?.data?.msg || "Registration failed."); }
    finally { setLoading(false); }
  };

  /* ── Login ───────────────────────────────────────────────── */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); clrErr();
    try {
      const res = await api.post("/api/auth/login", loginForm);
      saveUserToken(res.data.token);
      afterLogin(res.data.user);
    } catch (err) { setFormError(err.response?.data?.msg || "Login failed."); }
    finally { setLoading(false); }
  };

  /* ── Register → send OTP ─────────────────────────────────── */
  const handleRegisterSubmit = async (e) => {
    e.preventDefault(); clrErr();
    if (!registerForm.terms || !registerForm.privacyConsent || !registerForm.hipaaConsent) {
      return setFormError("Accept Terms, Privacy Policy, and HIPAA consent requirements");
    }
    const passwordError = getPasswordError(registerForm.password);
    if (passwordError) return setFormError(passwordError);
    if (!registerForm.mobile) return setFormError("Enter mobile number");
    const dobError = getDobError(registerForm.dob);
    if (dobError) return setFormError(dobError);
    if (!registerForm.gender) return setFormError("Select Gender");
    if (!registerForm.country) return setFormError("Select your country");
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
    } catch (err) { setFormError(err.response?.data?.msg || "Failed to send OTP."); }
    finally { setLoading(false); }
  };

  /* ── OTP submit → create account ────────────────────────── */
  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    if (otpValue.length < 6) return setFormError("Enter the complete 6-digit OTP");
    setLoading(true); clrErr();
    try {
      const { terms, ...data } = registerForm;
      const res = await api.post("/api/auth/register", { ...data, otp: otpValue });
      saveUserToken(res.data.token);
      if (timerRef.current) clearInterval(timerRef.current);
      setOtpValue("");
      setRegisterForm({
        name: "", email: "", mobile: "", dob: "", gender: "", country: "", password: "",
        terms: false, privacyConsent: false, hipaaConsent: false,
      });
      afterLogin(res.data.user);
    } catch (err) {
      setOtpValue("");
      setFormError(err.response?.data?.msg || "Invalid OTP. Please try again.");
    } finally { setLoading(false); }
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
    }
    catch { setFormError("Could not resend OTP."); }
  };

  /* ── Forgot password ─────────────────────────────────────── */
  const handleForgotSend = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return setFormError("Enter your email address");
    setLoading(true); clrErr();
    try {
      await api.post("/api/auth/send-forgot-otp", { email: forgotEmail });
      goTo("forgot-otp"); startTimer();
    } catch (err) { setFormError(err.response?.data?.msg || "Could not send OTP."); }
    finally { setLoading(false); }
  };

  const handleForgotVerify = async (e) => {
    e.preventDefault();
    if (otpValue.length < 6) return setFormError("Enter the complete 6-digit OTP");
    setLoading(true); clrErr();
    try {
      const res = await api.post("/api/auth/verify-forgot-otp", { email: forgotEmail, otp: otpValue });
      setResetToken(res.data.resetToken);
      goTo("forgot-reset");
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (err) {
      setOtpValue("");
      setFormError(err.response?.data?.msg || "Invalid OTP. Please try again.");
    } finally { setLoading(false); }
  };

  const handleForgotResend = async () => {
    clrErr();
    try { await api.post("/api/auth/send-forgot-otp", { email: forgotEmail }); startTimer(); }
    catch { setFormError("Could not resend OTP."); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const passwordError = getPasswordError(newPass);
    if (passwordError) return setFormError(passwordError);
    if (newPass !== confirmPass) return setFormError("Passwords do not match");
    setLoading(true); clrErr();
    try {
      await api.post("/api/auth/reset-password", { resetToken, newPassword: newPass });
      setView("auth"); setIsRegister(false);
      setForgotEmail(""); setResetToken(""); setNewPass(""); setConfirmPass("");
      setFormSuccess("Password reset successfully! Please sign in.");
    } catch (err) { setFormError(err.response?.data?.msg || "Reset failed."); }
    finally { setLoading(false); }
  };

  /* ══════════════════════════════════════════
     RENDER PRIORITY
  ══════════════════════════════════════════ */

  /* Google profile completion */
  if (googlePending) {
    return (
      <div className="main-log">
        <div className="auth-wrapper" style={{ maxWidth: 440, minHeight: "auto" }}>
          <form onSubmit={handleGoogleComplete} className="flow-card">
            <div className="flow-icon">🩺</div>
            <h1 style={{ marginBottom: 0 }}>Complete Your Profile</h1>
            <p style={{ marginTop: 8, marginBottom: formError ? 4 : 16 }}>
              Welcome, <strong style={{ color: "#059669" }}>{googlePending.name}</strong>! Just a few more details.
            </p>
            {formError && <p className="form-error">{formError}</p>}
            <input type="text" value={googlePending.name} disabled style={{ opacity: .55, cursor: "not-allowed" }} />
            <input type="email" value={googlePending.email} disabled style={{ opacity: .55, cursor: "not-allowed" }} />
            <div className="row reg-row">
              <div className="reg-field-wrap">
                <label className="reg-label">Date of Birth</label>
                <DatePickerField
                  value={googleProfile.dob}
                  onChange={(v) => setGoogleProfile((p) => ({ ...p, dob: v }))}
                  min={DOB_MIN}
                  max={todayISO()}
                  placeholder="Date of Birth"
                />
              </div>
              <div className="reg-field-wrap">
                <label className="reg-label">Gender</label>
                <div className="reg-gender-wrap">
                  <select
                    value={googleProfile.gender}
                    onChange={(e) => setGoogleProfile((p) => ({ ...p, gender: e.target.value }))}
                    required
                    className="reg-gender-select"
                  >
                    <option value="" disabled>Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <svg className="reg-gender-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="row reg-row country-mobile-row">
              <div className="reg-field-wrap">
                <label className="reg-label">Country</label>
                <select
                  className="register-country-select"
                  value={googleProfile.country}
                  onChange={(e) => setGoogleProfile((p) => ({ ...p, country: e.target.value }))}
                  required
                >
              <option value="">Select Country</option>
              <option value="Afghanistan">Afghanistan</option>
              <option value="Albania">Albania</option>
              <option value="Algeria">Algeria</option>
              <option value="Argentina">Argentina</option>
              <option value="Australia">Australia</option>
              <option value="Austria">Austria</option>
              <option value="Azerbaijan">Azerbaijan</option>
              <option value="Bahrain">Bahrain</option>
              <option value="Bangladesh">Bangladesh</option>
              <option value="Belgium">Belgium</option>
              <option value="Bolivia">Bolivia</option>
              <option value="Brazil">Brazil</option>
              <option value="Canada">Canada</option>
              <option value="Chile">Chile</option>
              <option value="China">China</option>
              <option value="Colombia">Colombia</option>
              <option value="Croatia">Croatia</option>
              <option value="Czech Republic">Czech Republic</option>
              <option value="Denmark">Denmark</option>
              <option value="Ecuador">Ecuador</option>
              <option value="Egypt">Egypt</option>
              <option value="Ethiopia">Ethiopia</option>
              <option value="Finland">Finland</option>
              <option value="France">France</option>
              <option value="Germany">Germany</option>
              <option value="Ghana">Ghana</option>
              <option value="Greece">Greece</option>
              <option value="Guatemala">Guatemala</option>
              <option value="Hungary">Hungary</option>
              <option value="India">India</option>
              <option value="Indonesia">Indonesia</option>
              <option value="Iran">Iran</option>
              <option value="Iraq">Iraq</option>
              <option value="Ireland">Ireland</option>
              <option value="Israel">Israel</option>
              <option value="Italy">Italy</option>
              <option value="Japan">Japan</option>
              <option value="Jordan">Jordan</option>
              <option value="Kazakhstan">Kazakhstan</option>
              <option value="Kenya">Kenya</option>
              <option value="Kuwait">Kuwait</option>
              <option value="Lebanon">Lebanon</option>
              <option value="Libya">Libya</option>
              <option value="Malaysia">Malaysia</option>
              <option value="Mexico">Mexico</option>
              <option value="Morocco">Morocco</option>
              <option value="Myanmar">Myanmar</option>
              <option value="Nepal">Nepal</option>
              <option value="Netherlands">Netherlands</option>
              <option value="New Zealand">New Zealand</option>
              <option value="Nigeria">Nigeria</option>
              <option value="Norway">Norway</option>
              <option value="Oman">Oman</option>
              <option value="Pakistan">Pakistan</option>
              <option value="Peru">Peru</option>
              <option value="Philippines">Philippines</option>
              <option value="Poland">Poland</option>
              <option value="Portugal">Portugal</option>
              <option value="Qatar">Qatar</option>
              <option value="Romania">Romania</option>
              <option value="Russia">Russia</option>
              <option value="Saudi Arabia">Saudi Arabia</option>
              <option value="Serbia">Serbia</option>
              <option value="Singapore">Singapore</option>
              <option value="South Africa">South Africa</option>
              <option value="South Korea">South Korea</option>
              <option value="Spain">Spain</option>
              <option value="Sri Lanka">Sri Lanka</option>
              <option value="Sudan">Sudan</option>
              <option value="Sweden">Sweden</option>
              <option value="Switzerland">Switzerland</option>
              <option value="Syria">Syria</option>
              <option value="Taiwan">Taiwan</option>
              <option value="Tanzania">Tanzania</option>
              <option value="Thailand">Thailand</option>
              <option value="Tunisia">Tunisia</option>
              <option value="Turkey">Turkey</option>
              <option value="Uganda">Uganda</option>
              <option value="Ukraine">Ukraine</option>
              <option value="United Arab Emirates">United Arab Emirates</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="United States">United States</option>
              <option value="Uruguay">Uruguay</option>
              <option value="Uzbekistan">Uzbekistan</option>
              <option value="Venezuela">Venezuela</option>
              <option value="Vietnam">Vietnam</option>
              <option value="Yemen">Yemen</option>
              <option value="Zambia">Zambia</option>
              <option value="Zimbabwe">Zimbabwe</option>
                </select>
              </div>
              <div className="reg-field-wrap">
                <label className="reg-label">Mobile Number</label>
                <PhoneInputField
                  value={googleProfile.mobile}
                  onChange={(ph) => setGoogleProfile((p) => ({ ...p, mobile: ph }))}
                  defaultCountry="auto"
                  placeholder="Mobile number"
                />
              </div>
            </div>
            <label className="terms consent-terms">
              <input
                type="checkbox"
                checked={googleProfile.privacyConsent && googleProfile.hipaaConsent}
                onChange={(e) => setGoogleProfile((p) => ({
                  ...p,
                  privacyConsent: e.target.checked,
                  hipaaConsent: e.target.checked,
                }))}
                required
              />
              I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms</a>, <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>, and HIPAA consent requirements.
            </label>
            <button type="submit" disabled={loading} style={{ marginTop: 16, width: "100%" }}>
              {loading ? "Creating..." : "Create Account"}
            </button>
            <button type="button" onClick={() => { setGooglePending(null); setIsRegister(false); clrErr(); }}
              style={{ background: "none", color: "#9ca3af", border: "none", marginTop: 10, cursor: "pointer", fontSize: 13, boxShadow: "none", padding: "8px 20px", textTransform: "none", fontWeight: 400 }}>
              Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* Registration OTP */
  if (view === "register-otp") return (
    <FlowCard icon="📧" title="Verify Your Email"
      subtitle={<>We sent a 6-digit security code to <strong style={{ color: "#059669" }}>{registerForm.email}</strong></>}
      formError={formError} onBack={() => { goTo("auth"); setIsRegister(true); }}>
      <form onSubmit={handleOTPSubmit} style={{ width: "100%" }}>
        <OTPInput value={otpValue} onChange={(v) => { setOtpValue(v); clrErr(); }} />
        <p className="otp-resend">
          {otpTimer > 0
            ? <>Resend in <strong>{otpTimer}s</strong></>
            : <>Didn't receive it?{" "}<button type="button" onClick={handleResendRegisterOTP}>Resend OTP</button></>}
        </p>
        <button type="submit" disabled={loading || otpValue.length < 6} style={{ width: "100%", marginTop: 16 }}>
          {loading ? "Verifying..." : "Verify & Create Account"}
        </button>
      </form>
    </FlowCard>
  );

  /* Forgot — enter email */
  if (view === "forgot-email") return (
    <FlowCard icon="🔒" title="Forgot Password"
      subtitle="Enter your registered email and we'll send a reset OTP."
      formError={formError} onBack={() => goTo("auth")}>
      <form onSubmit={handleForgotSend} style={{ width: "100%" }}>
        <input type="email" placeholder="Your registered email" value={forgotEmail}
          onChange={(e) => { setForgotEmail(e.target.value); clrErr(); }}
          required style={{ marginBottom: 16 }} />
        <button type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Sending..." : "Send Reset OTP"}
        </button>
      </form>
    </FlowCard>
  );

  /* Forgot — enter OTP */
  if (view === "forgot-otp") return (
    <FlowCard icon="🔑" title="Enter OTP"
      subtitle={<>OTP sent to <strong style={{ color: "#059669" }}>{forgotEmail}</strong></>}
      formError={formError} onBack={() => goTo("forgot-email")}>
      <form onSubmit={handleForgotVerify} style={{ width: "100%" }}>
        <OTPInput value={otpValue} onChange={(v) => { setOtpValue(v); clrErr(); }} />
        <p className="otp-resend">
          {otpTimer > 0
            ? <>Resend in <strong>{otpTimer}s</strong></>
            : <>Didn't receive it?{" "}<button type="button" onClick={handleForgotResend}>Resend OTP</button></>}
        </p>
        <button type="submit" disabled={loading || otpValue.length < 6} style={{ width: "100%", marginTop: 16 }}>
          {loading ? "Verifying..." : "Verify OTP"}
        </button>
      </form>
    </FlowCard>
  );

  /* Forgot — new password */
  if (view === "forgot-reset") return (
    <FlowCard icon="🔐" title="Set New Password"
      subtitle="Choose a strong password for your account."
      formError={formError} onBack={() => goTo("forgot-otp")}>
      <form onSubmit={handleResetPassword} style={{ width: "100%" }}>
      <div className="password-wrapper">
        <input type={showPasswords.newPass ? "text" : "password"} placeholder="Example: MySecurePass@123!" value={newPass}
          onChange={(e) => { setNewPass(e.target.value); clrErr(); }} required />
        <button type="button" className="password-toggle" onClick={() => setShowPasswords((p) => ({ ...p, newPass: !p.newPass }))} tabIndex={-1}>
          <EyeIcon open={showPasswords.newPass} />
        </button>
      </div>
      <div className="password-wrapper">
        <input type={showPasswords.confirmPass ? "text" : "password"} placeholder="Confirm new password" value={confirmPass}
          onChange={(e) => { setConfirmPass(e.target.value); clrErr(); }} required />
        <button type="button" className="password-toggle" onClick={() => setShowPasswords((p) => ({ ...p, confirmPass: !p.confirmPass }))} tabIndex={-1}>
          <EyeIcon open={showPasswords.confirmPass} />
        </button>
      </div>
        <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </FlowCard>
  );

  /* ── Main auth UI ────────────────────────────────────────── */
  return (
    <div className="main-log">
      <div className={`auth-wrapper ${isRegister ? "panel-active" : ""}`}>

        {/* ── REGISTER FORM ─────────────────────────────────── */}
        <div className="auth-form-box register-form-box">
          <form onSubmit={handleRegisterSubmit} className="register-form">
            <h1>Create Account</h1>
            <p className="form-subtitle">Join Humancare and take charge of your health</p>

            <div className="social-links">
              <button type="button" className="google-btn" onClick={() => initiateGoogleLogin()}>
                <GoogleIcon /> Continue with Google
              </button>
            </div>

            {formError && <p className="form-error">{formError}</p>}
            <span>or use your email</span>

            <input type="text" placeholder="Full Name" value={registerForm.name}
              onChange={(e) => setRegisterForm((p) => ({ ...p, name: e.target.value }))} required />

            <input type="email" placeholder="Email Address" value={registerForm.email}
              onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))} required
              style={{ width: "100%" }} />

            <div className="row reg-row">
              <div className="reg-field-wrap">
                <DatePickerField
                  value={registerForm.dob}
                  onChange={(v) => setRegisterForm((p) => ({ ...p, dob: v }))}
                  min={DOB_MIN}
                  max={todayISO()}
                  placeholder="Date of Birth"
                />
              </div>
              <div className="reg-field-wrap">
                <div className="reg-gender-wrap">
                  <select value={registerForm.gender}
                    onChange={(e) => setRegisterForm((p) => ({ ...p, gender: e.target.value }))}
                    required className="reg-gender-select">
                    <option value="" disabled>Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <svg className="reg-gender-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="row reg-row country-mobile-row">
              <div className="reg-field-wrap">
                <div className="custom-country-dropdown">
 <button
  type="button"
  className="country-trigger"
  onClick={() => { setCountryOpen((v) => !v); if (!countryOpen) setCountrySearch(""); }}
>
  {selectedPhoneCountry ? (
    <>
      <img
        src={`https://flagcdn.com/w40/${selectedPhoneCountry.code.toLowerCase()}.png`}
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
    <div className="country-dropdown-menu">
      <div style={{ padding: "10px 10px 6px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px",
              background: "#f8fafc", border: "1.5px solid #e8edf2", borderRadius: 10,
            }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#94a3b8" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search country"
            value={countrySearch}
            onChange={e => setCountrySearch(e.target.value)}
            style={{
                  flex: 1, border: "none", background: "transparent",
                  fontSize: 13, fontFamily: "inherit",
                  color: "#1e293b", outline: "none",
                }}
          />
          {countrySearch && (
            <button type="button" onClick={() => setCountrySearch("")}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#cbd5e1", fontSize: 14, lineHeight: 1 }}>
              ✕
            </button>
          )}
        </div>
      </div>
      {PHONE_COUNTRIES.filter(c => !countrySearch || c.name.toLowerCase().includes(countrySearch.toLowerCase())).map((c) => (
        <button
          key={c.code}
          type="button"
          className="country-option"
          onClick={() => {
  const { local } = parsePhoneValue(
    registerForm.mobile,
    c.code
  );

  setRegisterForm((p) => ({
    ...p,
    country: c.name,
    mobile: `+${c.dial}${local}`,
  }));

  setCountryOpen(false);
  setCountrySearch("");
}}
        >
          <img
            src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`}
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
      ))}
    </div>
  )}
</div>
              </div>
              <div className="reg-field-wrap">
                <PhoneInputField
                  value={registerForm.mobile}
                  onChange={(ph, meta) => setRegisterForm((p) => ({
                    ...p,
                    mobile: ph,
                    country: meta?.name || p.country,
                  }))}
                  onCountryChange={(meta) => meta?.name && setRegisterForm((p) => ({ ...p, country: meta.name }))}
                  defaultCountry={selectedPhoneCountry?.code || "auto"}
                  placeholder="Mobile number"
                />
              </div>
            </div>

            <div className="row reg-row">
              <div className="reg-field-wrap">
                <select
                  value={registerForm.state}
                  onChange={(e) => setRegisterForm((p) => ({ ...p, state: e.target.value, city: "" }))}
                  disabled={!registerForm.country}
                  style={{
                    width: "100%", height: 46, padding: "0 14px",
                    border: "1.5px solid #c7d7fe", borderRadius: 12,
                    background: !registerForm.country ? "#f1f5f9" : "#f8fbff",
                    fontSize: 14, fontFamily: "inherit", color: registerForm.state ? "#1f2937" : "#9ca3af",
                    outline: "none", cursor: !registerForm.country ? "not-allowed" : "pointer",
                    appearance: "none", WebkitAppearance: "none",
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", backgroundSize: "10px 6px",
                    paddingRight: 36,
                  }}
                >
                  <option value="">{loadingStates ? "Loading..." : registerForm.country ? "Select state / province" : "Select country first"}</option>
                  {states.map((s) => <option key={s.isoCode} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="reg-field-wrap">
                <select
                  value={registerForm.city}
                  onChange={(e) => setRegisterForm((p) => ({ ...p, city: e.target.value }))}
                  disabled={!registerForm.state}
                  style={{
                    width: "100%", height: 46, padding: "0 14px",
                    border: "1.5px solid #c7d7fe", borderRadius: 12,
                    background: !registerForm.state ? "#f1f5f9" : "#f8fbff",
                    fontSize: 14, fontFamily: "inherit", color: registerForm.city ? "#1f2937" : "#9ca3af",
                    outline: "none", cursor: !registerForm.state ? "not-allowed" : "pointer",
                    appearance: "none", WebkitAppearance: "none",
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", backgroundSize: "10px 6px",
                    paddingRight: 36,
                  }}
                >
                  <option value="">{loadingCities ? "Loading..." : registerForm.state ? "Select city" : "Select state first"}</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="password-wrapper">
              <input type={showPasswords.register ? "text" : "password"} placeholder="Example: MySecurePass@123!" value={registerForm.password}
                onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))} required />
              <button type="button" className="password-toggle" onClick={() => setShowPasswords((p) => ({ ...p, register: !p.register }))} tabIndex={-1}>
                <EyeIcon open={showPasswords.register} />
              </button>
            </div>
            <p className={registerPasswordError ? "password-requirements password-error" : "password-requirements"}>
              {registerPasswordError || PASSWORD_REQUIREMENTS}
            </p>

           <label className="terms consent-terms">
  <input
    type="checkbox"
    checked={registerForm.terms && registerForm.privacyConsent && registerForm.hipaaConsent}
    onChange={(e) =>
      setRegisterForm((p) => ({
        ...p,
        terms: e.target.checked,
        privacyConsent: e.target.checked,
        hipaaConsent: e.target.checked,
      }))
    }
    required
  />
  <span>
I agree to <a href="/terms">Terms</a>, <a href="/privacy">Privacy Policy</a> & HIPAA Consent.
  </span>
</label>

            <button type="submit" disabled={loading}>
              {loading ? "Sending OTP…" : "Sign Up"}
            </button>

            <div className="mobile-switch">
              <p>Already have an account?</p>
              <button type="button" onClick={() => { setIsRegister(false); clrErr(); }}>Sign In</button>
            </div>
          </form>
        </div>

        {/* ── LOGIN FORM ───────────────────────────────────────── */}
        <div className="auth-form-box login-form-box">
          <form onSubmit={handleLoginSubmit}>
            <h1>Welcome Back</h1>
            <p className="form-subtitle">Sign in to continue your healthcare journey</p>

            <div className="social-links">
              <button type="button" className="google-btn" onClick={() => initiateGoogleLogin()}>
                <GoogleIcon /> Continue with Google
              </button>
            </div>

            {formSuccess && (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontSize: 13, color: "#15803d", display: "flex", alignItems: "center", gap: 8 }}>
                <span>&#10003;</span> {formSuccess}
              </div>
            )}
            {formError && <p className="form-error">{formError}</p>}
            <span>or use your email</span>

            <input type="email" placeholder="Email Address" value={loginForm.email}
              onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))} required />
            <div className="password-wrapper">
              <input type={showPasswords.login ? "text" : "password"} placeholder="Password" value={loginForm.password}
                onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} required />
              <button type="button" className="password-toggle" onClick={() => setShowPasswords((p) => ({ ...p, login: !p.login }))} tabIndex={-1}>
                <EyeIcon open={showPasswords.login} />
              </button>
            </div>

            <button type="button" className="forgot-link"
              onClick={() => { setView("forgot-email"); clrErr(); }}>
              Forgot your password?
            </button>

            <button type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>

            <div className="mobile-switch">
              <p>Don't have an account?</p>
              <button type="button" onClick={() => { setIsRegister(true); clrErr(); }}>Sign Up</button>
            </div>
          </form>
        </div>

        {/* ── SLIDING PANEL ─────────────────────────────────────── */}
        <div className="slide-panel-wrapper">
          <div className="slide-panel">
            <div className="panel-content panel-content-left">
              <div className="panel-badge">👋</div>
              <h1>Welcome Back!</h1>
              <p>Stay connected — log in with your credentials and continue your healthcare experience.</p>
              <button className="transparent-btn" onClick={() => setIsRegister(false)}>Sign In</button>
            </div>
            <div className="panel-content panel-content-right">
              <div className="panel-badge">🩺</div>
              <h1>Join Humancare Connect</h1>
              <p>Connect with top doctors, manage appointments, and take control of your health today.</p>
              <button className="transparent-btn" onClick={() => setIsRegister(true)}>Sign Up</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
