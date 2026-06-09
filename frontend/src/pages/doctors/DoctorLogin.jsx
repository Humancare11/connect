import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import "../log.css";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

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

/* ─── Main component ─────────────────────────────────────────── */
export default function DoctorAuthPage() {
  const navigate  = useNavigate();
  const { login } = useDoctorAuth();

  /* view: 'auth' | 'register-otp' | 'forgot-email' | 'forgot-otp' | 'forgot-reset' */
  const [view,       setView]       = useState("auth");
  const [isRegister, setIsRegister] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [formError,  setFormError]  = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
  });

  const [otpValue, setOtpValue] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const timerRef = useRef(null);

  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken,  setResetToken]  = useState("");
  const [newPass,     setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPasswords, setShowPasswords] = useState({ register: false, confirm: false, login: false, newPass: false, confirmPass: false });

  const clrErr = () => { setFormError(""); setFormSuccess(""); };

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

  const goTo = (nextView) => {
    setView(nextView);
    setFormError("");
    setOtpValue("");
  };

  function afterLogin(doctor, isNewUser = false) {
    login(doctor);
    navigate(isNewUser ? "/doctor-dashboard/enrollments" : "/doctor-dashboard");
  }

  /* ── Google ──────────────────────────────────────────────── */
  const initiateGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true); clrErr();
      try {
        const res = await api.post("/api/auth/google-doctor", {
          accessToken: tokenResponse.access_token,
        });
        afterLogin(res.data.doctor, res.data.isNewUser);
      } catch (err) { setFormError(err.response?.data?.msg || "Google Sign-In failed."); }
      finally { setLoading(false); }
    },
    onError: () => setFormError("Google Sign-In failed."),
  });

  /* ── Login ───────────────────────────────────────────────── */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); clrErr();
    try {
      const res = await api.post("/api/doctor/login", {
        email: loginForm.email.trim().toLowerCase(),
        password: loginForm.password,
      });
      afterLogin(res.data.doctor);
    } catch (err) {
      setFormError(err.response?.data?.msg || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Register → send OTP ─────────────────────────────────── */
  const handleRegisterSubmit = async (e) => {
    e.preventDefault(); clrErr();
    if (registerForm.password !== registerForm.confirmPassword)
      return setFormError("Passwords do not match.");
    if (registerForm.password.length < 8)
      return setFormError(PASSWORD_REQUIREMENTS);
    setLoading(true);
    try {
      await api.post("/api/doctor/send-register-otp", { email: registerForm.email, name: registerForm.name });
      goTo("register-otp");
      startTimer();
    } catch (err) { setFormError(err.response?.data?.message || "Failed to send OTP."); }
    finally { setLoading(false); }
  };

  /* ── OTP submit → create account ────────────────────────── */
  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    if (otpValue.length < 6) return setFormError("Enter the complete 6-digit OTP");
    setLoading(true); clrErr();
    try {
      const res = await api.post("/api/doctor/register", {
        name:            registerForm.name.trim(),
        email:           registerForm.email.trim().toLowerCase(),
        password:        registerForm.password,
        confirmPassword: registerForm.confirmPassword,
        otp:             otpValue,
      });
      if (timerRef.current) clearInterval(timerRef.current);
      setOtpValue("");
      setRegisterForm({ name: "", email: "", password: "", confirmPassword: "" });
      afterLogin(res.data.doctor, true);
    } catch (err) {
      setFormError(err.response?.data?.msg || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendRegisterOTP = async () => {
    clrErr();
    try { await api.post("/api/doctor/send-register-otp", { email: registerForm.email, name: registerForm.name }); startTimer(); }
    catch { setFormError("Could not resend OTP."); }
  };

  /* ── Forgot password ─────────────────────────────────────── */
  const handleForgotSend = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return setFormError("Enter your email address");
    setLoading(true); clrErr();
    try {
      await api.post("/api/doctor/send-forgot-otp", { email: forgotEmail });
      goTo("forgot-otp"); startTimer();
    } catch (err) { setFormError(err.response?.data?.message || "Could not send OTP."); }
    finally { setLoading(false); }
  };

  const handleForgotVerify = async (e) => {
    e.preventDefault();
    if (otpValue.length < 6) return setFormError("Enter the complete 6-digit OTP");
    setLoading(true); clrErr();
    try {
      const res = await api.post("/api/doctor/verify-forgot-otp", { email: forgotEmail, otp: otpValue });
      setResetToken(res.data.resetToken);
      goTo("forgot-reset");
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (err) { setFormError(err.response?.data?.message || "Invalid OTP."); }
    finally { setLoading(false); }
  };

  const handleForgotResend = async () => {
    clrErr();
    try { await api.post("/api/doctor/send-forgot-otp", { email: forgotEmail }); startTimer(); }
    catch { setFormError("Could not resend OTP."); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPass.length < 8)     return setFormError(PASSWORD_REQUIREMENTS);
    if (newPass !== confirmPass) return setFormError("Passwords do not match");
    setLoading(true); clrErr();
    try {
      await api.post("/api/doctor/reset-password", { resetToken, newPassword: newPass });
      setView("auth"); setIsRegister(false);
      setForgotEmail(""); setResetToken(""); setNewPass(""); setConfirmPass("");
      setFormSuccess("Password reset successfully! Please sign in.");
    } catch (err) { setFormError(err.response?.data?.message || "Reset failed."); }
    finally { setLoading(false); }
  };

  /* ══════════════════════════════════════════
     RENDER PRIORITY
  ══════════════════════════════════════════ */

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
          {loading ? "Verifying..." : "Verify & Register"}
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
          <input type={showPasswords.confirmPass ? "text" : "password"} placeholder="Example: MySecurePass@123!" value={confirmPass}
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
            <h1>Doctor Register</h1>
            <p className="form-subtitle">Join Humancare Connect as a healthcare professional</p>

            <div className="social-links">
              <button type="button" className="google-btn" onClick={() => initiateGoogleLogin()}>
                <GoogleIcon /> Continue with Google
              </button>
            </div>

            {formError && <p className="form-error">{formError}</p>}
            <span>or use your email</span>

            <input type="text" placeholder="Dr. Full Name"
              value={registerForm.name}
              onChange={(e) => { setRegisterForm((p) => ({ ...p, name: e.target.value })); clrErr(); }} required />

            <input type="email" placeholder="doctor@example.com"
              value={registerForm.email}
              onChange={(e) => { setRegisterForm((p) => ({ ...p, email: e.target.value })); clrErr(); }} required />

            <div className="password-wrapper">
              <input type={showPasswords.register ? "text" : "password"} placeholder="Example: MySecurePass@123!"
                value={registerForm.password}
                onChange={(e) => { setRegisterForm((p) => ({ ...p, password: e.target.value })); clrErr(); }} required />
              <button type="button" className="password-toggle" onClick={() => setShowPasswords((p) => ({ ...p, register: !p.register }))} tabIndex={-1}>
                <EyeIcon open={showPasswords.register} />
              </button>
            </div>
            <p className="password-requirements">{PASSWORD_REQUIREMENTS}</p>

            <div className="password-wrapper">
              <input type={showPasswords.confirm ? "text" : "password"} placeholder="Example: MySecurePass@123!"
                value={registerForm.confirmPassword}
                onChange={(e) => { setRegisterForm((p) => ({ ...p, confirmPassword: e.target.value })); clrErr(); }} required />
              <button type="button" className="password-toggle" onClick={() => setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))} tabIndex={-1}>
                <EyeIcon open={showPasswords.confirm} />
              </button>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? "Sending OTP…" : "Register"}
            </button>

            <div className="mobile-switch">
              <p>Already have an account?</p>
              <button type="button" onClick={() => { setIsRegister(false); clrErr(); }}>Sign In</button>
            </div>
          </form>
        </div>

        {/* ── LOGIN FORM ─────────────────────────────────────── */}
        <div className="auth-form-box login-form-box">
          <form onSubmit={handleLoginSubmit}>
            <h1>Doctor Login</h1>
            <p className="form-subtitle">Sign in to continue managing your patients</p>

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

            <input type="email" placeholder="doctor@example.com"
              value={loginForm.email}
              onChange={(e) => { setLoginForm((p) => ({ ...p, email: e.target.value })); clrErr(); }} required />

            <div className="password-wrapper">
              <input type={showPasswords.login ? "text" : "password"} placeholder="Password"
                value={loginForm.password}
                onChange={(e) => { setLoginForm((p) => ({ ...p, password: e.target.value })); clrErr(); }} required />
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
              <p>New to Humancare?</p>
              <button type="button" onClick={() => { setIsRegister(true); clrErr(); }}>Register</button>
            </div>
          </form>
        </div>

        {/* ── SLIDING PANEL ─────────────────────────────────────── */}
        <div className="slide-panel-wrapper">
          <div className="slide-panel">
            <div className="panel-content panel-content-left">
              <div className="panel-badge">👨‍⚕️</div>
              <h1>Welcome Back, Doctor!</h1>
              <p>Sign in to continue managing patients and appointments on Humancare Connect.</p>
              <button className="transparent-btn" onClick={() => { setIsRegister(false); setFormError(""); }}>
                Sign In
              </button>
            </div>
            <div className="panel-content panel-content-right">
              <div className="panel-badge">🩺</div>
              <h1>Join Our Network</h1>
              <p>Register now and become part of our trusted network of healthcare professionals.</p>
              <button className="transparent-btn" onClick={() => { setIsRegister(true); setFormError(""); }}>
                Register
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

