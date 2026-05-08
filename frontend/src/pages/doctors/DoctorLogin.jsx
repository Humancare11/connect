import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import "./Doctor.css";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

/* ─── Google icon ────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}

/* ─── 6-digit OTP input ──────────────────────────────────────── */
function OTPInput({ value, onChange, boxClass = "doctor-otp-box" }) {
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

/* ─── Flow card wrapper ──────────────────────────────────────── */
function DoctorFlowCard({ icon, title, subtitle, formError, onBack, children }) {
  return (
    <div className="doctor-main-log">
      <div className="doctor-auth-wrapper" style={{ maxWidth: 440, minHeight: "auto" }}>
        <div className="doctor-flow-card">
          <div className="doctor-flow-icon">{icon}</div>
          <h1 style={{ marginBottom: 0 }}>{title}</h1>
          <p style={{ marginTop: 8, marginBottom: formError ? 4 : 20 }}>{subtitle}</p>
          {formError && <p className="doctor-form-error">{formError}</p>}
          {children}
          <button type="button" onClick={onBack}
            style={{ background:"none", color:"#9ca3af", border:"none", marginTop:10,
              cursor:"pointer", fontSize:13, boxShadow:"none", padding:"8px 20px",
              textTransform:"none", fontWeight:400, letterSpacing:0 }}>
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

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
  });

  const handleLoginChange = (e) => {
    setLoginForm({ ...loginForm, [e.target.name]: e.target.value });
    setError("");
  };

  const handleRegisterChange = (e) => {
    setRegisterForm({ ...registerForm, [e.target.name]: e.target.value });
    setError("");
  };

  function afterLogin(doctor, isNewUser = false) {
    login(doctor);
    navigate(
      isNewUser ? "/doctor-dashboard?newAccount=1" : "/doctor-dashboard",
    );
  }

  /* ── Google ──────────────────────────────────────────────── */
  const handleGoogleSuccess = async (cr) => {
    setLoading(true); clrErr();
    try {
      const res = await api.post("/api/auth/google-doctor", {
        credential: credentialResponse.credential,
      });

      // ✅ Save token to localStorage (both keys used across app)
      if (res.data.token) {
        localStorage.setItem("doctorToken", res.data.token);
        localStorage.setItem("token", res.data.token);
      }

      afterLogin(res.data.doctor, res.data.isNewUser);
    } catch (err) { setFormError(err.response?.data?.msg || "Google Sign-In failed."); }
    finally { setLoading(false); }
  };

  /* ── Login ───────────────────────────────────────────────── */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); clrErr();
    try {
      const res = await api.post("/api/doctor/login", {
        email: loginForm.email.trim().toLowerCase(),
        password: loginForm.password,
      });

      // ✅ Save token to localStorage (both keys used across app)
      if (res.data.token) {
        localStorage.setItem("doctorToken", res.data.token);
        localStorage.setItem("token", res.data.token);
      }

      // Backend returns `doctor` key
      afterLogin(res.data.doctor);
    } catch (err) {
      // ✅ Backend sends "msg" not "message"
      setError(err.response?.data?.msg || "Invalid email or password.");
    }

    setLoading(false);
  };

  /* ── Register → send OTP ─────────────────────────────────── */
  const handleRegisterSubmit = async (e) => {
    e.preventDefault(); clrErr();
    if (registerForm.password !== registerForm.confirmPassword)
      return setFormError("Passwords do not match.");
    if (registerForm.password.length < 6)
      return setFormError("Password must be at least 6 characters.");
    setLoading(true);
    try {
      await api.post("/api/doctor/send-register-otp", { email: registerForm.email });
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
      await api.post("/api/doctor/register", {
        name: registerForm.name.trim(),
        email: registerForm.email.trim().toLowerCase(),
        password: registerForm.password,
        confirmPassword: registerForm.confirmPassword,
        otp:             otpValue,
      });

      // ✅ Register doesn't auto-login, redirect to login side
      setIsRegister(false);
      setError("");
      setRegisterForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      alert("Registration successful! Please login.");
    } catch (err) {
      setError(
        err.response?.data?.msg || "Registration failed. Please try again.",
      );
    }

    setLoading(false);
  };

  const handleResendRegisterOTP = async () => {
    clrErr();
    try { await api.post("/api/doctor/send-register-otp", { email: registerForm.email }); startTimer(); }
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
    if (newPass.length < 6)     return setFormError("Password must be at least 6 characters");
    if (newPass !== confirmPass) return setFormError("Passwords do not match");
    setLoading(true); clrErr();
    try {
      await api.post("/api/doctor/reset-password", { resetToken, newPassword: newPass });
      setView("auth"); setIsRegister(false);
      setForgotEmail(""); setResetToken(""); setNewPass(""); setConfirmPass("");
      alert("Password reset successfully! Please login. ✅");
    } catch (err) { setFormError(err.response?.data?.message || "Reset failed."); }
    finally { setLoading(false); }
  };

  /* ══════════════════════════════════════════
     RENDER PRIORITY
  ══════════════════════════════════════════ */

  /* Registration OTP */
  if (view === "register-otp") return (
    <DoctorFlowCard icon="📧" title="Verify Your Email"
      subtitle={<>We sent a 6-digit OTP to <strong style={{ color:"#14b8a6" }}>{registerForm.email}</strong></>}
      formError={formError} onBack={() => { goTo("auth"); setIsRegister(true); }}>
      <form onSubmit={handleOTPSubmit} style={{ width:"100%" }}>
        <OTPInput value={otpValue} onChange={(v) => { setOtpValue(v); clrErr(); }} />
        <p className="doctor-otp-resend">
          {otpTimer > 0
            ? <>Resend in <strong>{otpTimer}s</strong></>
            : <>Didn't receive it?{" "}<button type="button" onClick={handleResendRegisterOTP}>Resend OTP</button></>}
        </p>
        <button type="submit" disabled={loading || otpValue.length < 6} style={{ width:"100%", marginTop:16 }}>
          {loading ? "Verifying..." : "Verify & Register"}
        </button>
      </form>
    </DoctorFlowCard>
  );

  /* Forgot — enter email */
  if (view === "forgot-email") return (
    <DoctorFlowCard icon="🔒" title="Forgot Password"
      subtitle="Enter your registered email and we'll send a reset OTP."
      formError={formError} onBack={() => goTo("auth")}>
      <form onSubmit={handleForgotSend} style={{ width:"100%" }}>
        <input type="email" placeholder="Your registered email" value={forgotEmail}
          onChange={(e) => { setForgotEmail(e.target.value); clrErr(); }}
          required className="doctor-flow-input" style={{ marginBottom:16 }} />
        <button type="submit" disabled={loading} style={{ width:"100%" }}>
          {loading ? "Sending..." : "Send Reset OTP"}
        </button>
      </form>
    </DoctorFlowCard>
  );

  /* Forgot — enter OTP */
  if (view === "forgot-otp") return (
    <DoctorFlowCard icon="🔑" title="Enter OTP"
      subtitle={<>OTP sent to <strong style={{ color:"#14b8a6" }}>{forgotEmail}</strong></>}
      formError={formError} onBack={() => goTo("forgot-email")}>
      <form onSubmit={handleForgotVerify} style={{ width:"100%" }}>
        <OTPInput value={otpValue} onChange={(v) => { setOtpValue(v); clrErr(); }} />
        <p className="doctor-otp-resend">
          {otpTimer > 0
            ? <>Resend in <strong>{otpTimer}s</strong></>
            : <>Didn't receive it?{" "}<button type="button" onClick={handleForgotResend}>Resend OTP</button></>}
        </p>
        <button type="submit" disabled={loading || otpValue.length < 6} style={{ width:"100%", marginTop:16 }}>
          {loading ? "Verifying..." : "Verify OTP"}
        </button>
      </form>
    </DoctorFlowCard>
  );

  /* Forgot — new password */
  if (view === "forgot-reset") return (
    <DoctorFlowCard icon="🔐" title="Set New Password"
      subtitle="Choose a strong password for your account."
      formError={formError} onBack={() => goTo("forgot-otp")}>
      <form onSubmit={handleResetPassword} style={{ width:"100%" }}>
        <input type="password" placeholder="New password (min 6 chars)" value={newPass}
          onChange={(e) => { setNewPass(e.target.value); clrErr(); }}
          required className="doctor-flow-input" />
        <input type="password" placeholder="Confirm new password" value={confirmPass}
          onChange={(e) => { setConfirmPass(e.target.value); clrErr(); }}
          required className="doctor-flow-input" />
        <button type="submit" disabled={loading} style={{ width:"100%", marginTop:8 }}>
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </DoctorFlowCard>
  );

  /* ── Main auth UI ────────────────────────────────────────── */
  return (
    <div className={`doctor-auth-wrapper ${isRegister ? "panel-active" : ""}`}>
      {/* REGISTER FORM */}
      <div className="doctor-auth-form-box register-form-box">
        <form onSubmit={handleRegisterSubmit}>
          <h1>Doctor Register</h1>

          <div className="doctor-social-links">
            <a href="#">
              <FaFacebookF />
            </a>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google Sign-In failed.")}
              type="icon"
              shape="circle"
              size="large"
            />
            <a href="#">
              <FaLinkedinIn />
            </a>
          </div>

          <span>Create your professional account</span>

          {error && <p className="doctor-error">{error}</p>}

          <input type="text" placeholder="Dr. John Doe"
            value={registerForm.name}
            onChange={(e) => { setRegisterForm((p) => ({ ...p, name: e.target.value })); clrErr(); }} required />

          <input type="email" placeholder="doctor@example.com"
            value={registerForm.email}
            onChange={(e) => { setRegisterForm((p) => ({ ...p, email: e.target.value })); clrErr(); }} required />

          <input type="password" placeholder="Create password"
            value={registerForm.password}
            onChange={(e) => { setRegisterForm((p) => ({ ...p, password: e.target.value })); clrErr(); }} required />

          <input type="password" placeholder="Confirm password"
            value={registerForm.confirmPassword}
            onChange={(e) => { setRegisterForm((p) => ({ ...p, confirmPassword: e.target.value })); clrErr(); }} required />

          <button type="submit" disabled={loading}>
            {loading ? "Sending OTP…" : "Register"}
          </button>

          <div className="doctor-mobile-switch">
            <p>Already have an account?</p>
            <button type="button" onClick={() => { setIsRegister(false); clrErr(); }}>Login</button>
          </div>
        </form>
      </div>

      {/* ── LOGIN FORM ─────────────────────────────────────────── */}
      <div className="doctor-auth-form-box login-form-box">
        <form onSubmit={handleLoginSubmit}>
          <h1>Doctor Login</h1>

          <div className="doctor-social-links">
            <a href="#">
              <FaFacebookF />
            </a>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google Sign-In failed.")}
              type="icon"
              shape="circle"
              size="large"
            />
            <a href="#">
              <FaLinkedinIn />
            </a>
          </div>

          <span>Login to your doctor dashboard</span>

          {error && <p className="doctor-error">{error}</p>}

          <input type="email" placeholder="doctor@example.com"
            value={loginForm.email}
            onChange={(e) => { setLoginForm((p) => ({ ...p, email: e.target.value })); clrErr(); }} required />

          <input type="password" placeholder="Enter password"
            value={loginForm.password}
            onChange={(e) => { setLoginForm((p) => ({ ...p, password: e.target.value })); clrErr(); }} required />

          <button type="button" className="doctor-forgot-link"
            onClick={() => { setView("forgot-email"); clrErr(); }}>
            Forgot your password?
          </button>

          <button type="submit" disabled={loading}>
            {loading ? "Logging in…" : "Login"}
          </button>

          <div className="doctor-mobile-switch">
            <p>New doctor?</p>
            <button type="button" onClick={() => { setIsRegister(true); clrErr(); }}>Register</button>
          </div>
        </form>
      </div>

      {/* ── SLIDING PANEL ─────────────────────────────────────── */}
      <div className="doctor-slide-panel-wrapper">
        <div className="doctor-slide-panel">
          <div className="doctor-panel-content doctor-panel-left">
            <h1>Welcome Back Doctor!</h1>
            <p>Login to continue managing patients and appointments.</p>
            <button
              className="doctor-transparent-btn"
              onClick={() => {
                setIsRegister(false);
                setError("");
              }}
            >
              Login
            </button>
          </div>
          <div className="doctor-panel-content doctor-panel-right">
            <h1>Join HumaniCare</h1>
            <p>Register now and become part of our trusted doctor network.</p>
            <button
              className="doctor-transparent-btn"
              onClick={() => {
                setIsRegister(true);
                setError("");
              }}
            >
              Register
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
