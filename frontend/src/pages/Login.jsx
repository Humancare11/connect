import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import socket from "../socket";
import PhoneInputLib from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import "./log.css";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const PhoneInput = PhoneInputLib.default ?? PhoneInputLib;

/* ─── Google icon ────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
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

/* ─── Main auth component ────────────────────────────────────── */
export default function AuthPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  /* view: 'auth' | 'register-otp' | 'forgot-email' | 'forgot-otp' | 'forgot-reset' */
  const [view,       setView]       = useState("auth");
  const [isRegister, setIsRegister] = useState(false);

  const [loginForm,    setLoginForm]    = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "", email: "", mobile: "", dob: "", gender: "", password: "", terms: false,
  });

  /* Google profile completion for new users */
  const [googlePending, setGooglePending] = useState(null);
  const [googleProfile, setGoogleProfile] = useState({ mobile: "", dob: "", gender: "" });

  /* OTP */
  const [otpValue, setOtpValue] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const timerRef = useRef(null);

  /* Forgot password */
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken,  setResetToken]  = useState("");
  const [newPass,     setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const [loading,   setLoading]   = useState(false);
  const [formError, setFormError] = useState("");

  /* ── helpers ─────────────────────────────────────────────── */
  const clrErr = () => setFormError("");

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

  function afterLogin(user) {
    login(user);
    if (!socket.connected) socket.connect();
    socket.emit("user-online", { userId: user._id, role: user.role });
    navigate("/user/dashboard");
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
        if (res.data.token) localStorage.setItem("token", res.data.token);
        afterLogin(res.data.user);
      } catch (err) { setFormError(err.response?.data?.msg || "Google Sign-In failed."); }
    },
    onError: () => setFormError("Google Sign-In failed."),
  });

  const handleGoogleComplete = async (e) => {
    e.preventDefault();
    if (!googleProfile.mobile) return setFormError("Enter mobile number");
    if (!googleProfile.dob)    return setFormError("Select Date of Birth");
    if (!googleProfile.gender) return setFormError("Select Gender");
    setLoading(true); clrErr();
    try {
      const res = await api.post("/api/auth/google", {
        accessToken: googlePending.accessToken,
        mobile: googleProfile.mobile, dob: googleProfile.dob, gender: googleProfile.gender,
      });
      if (res.data.token) localStorage.setItem("token", res.data.token);
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
      if (res.data.token) localStorage.setItem("token", res.data.token);
      afterLogin(res.data.user);
    } catch (err) { setFormError(err.response?.data?.msg || "Login failed."); }
    finally { setLoading(false); }
  };

  /* ── Register → send OTP ─────────────────────────────────── */
  const handleRegisterSubmit = async (e) => {
    e.preventDefault(); clrErr();
    if (!registerForm.terms)              return setFormError("Accept Terms & Conditions");
    if (registerForm.password.length < 6) return setFormError("Password must be at least 6 characters");
    if (!registerForm.mobile)             return setFormError("Enter mobile number");
    if (!registerForm.dob)                return setFormError("Select Date of Birth");
    if (!registerForm.gender)             return setFormError("Select Gender");
    setLoading(true);
    try {
      await api.post("/api/auth/send-register-otp", { email: registerForm.email });
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
      if (res.data.token) localStorage.setItem("token", res.data.token);
      if (timerRef.current) clearInterval(timerRef.current);
      setView("auth"); setIsRegister(false); setOtpValue("");
      setRegisterForm({ name:"", email:"", mobile:"", dob:"", gender:"", password:"", terms:false });
      alert("Account created successfully! Please sign in. ✅");
    } catch (err) { setFormError(err.response?.data?.msg || "Registration failed."); }
    finally { setLoading(false); }
  };

  const handleResendRegisterOTP = async () => {
    clrErr();
    try { await api.post("/api/auth/send-register-otp", { email: registerForm.email }); startTimer(); }
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
    } catch (err) { setFormError(err.response?.data?.msg || "Invalid OTP."); }
    finally { setLoading(false); }
  };

  const handleForgotResend = async () => {
    clrErr();
    try { await api.post("/api/auth/send-forgot-otp", { email: forgotEmail }); startTimer(); }
    catch { setFormError("Could not resend OTP."); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPass.length < 6)     return setFormError("Password must be at least 6 characters");
    if (newPass !== confirmPass) return setFormError("Passwords do not match");
    setLoading(true); clrErr();
    try {
      await api.post("/api/auth/reset-password", { resetToken, newPassword: newPass });
      setView("auth"); setIsRegister(false);
      setForgotEmail(""); setResetToken(""); setNewPass(""); setConfirmPass("");
      alert("Password reset successfully! Please sign in. ✅");
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
            <input type="text"  value={googlePending.name}  disabled style={{ opacity:.55, cursor:"not-allowed" }} />
            <input type="email" value={googlePending.email} disabled style={{ opacity:.55, cursor:"not-allowed" }} />
            <PhoneInput country="in" value={googleProfile.mobile}
              onChange={(ph) => setGoogleProfile((p) => ({ ...p, mobile: ph }))}
              inputStyle={{ width:"100%", borderRadius:12, border:"1.5px solid #d1fae5", background:"#f8fdfb", fontFamily:"DM Sans,sans-serif", fontSize:14, height:46 }} />
            <div className="row">
              <input type="date" value={googleProfile.dob}
                onChange={(e) => setGoogleProfile((p) => ({ ...p, dob: e.target.value }))} required />
              <select value={googleProfile.gender}
                onChange={(e) => setGoogleProfile((p) => ({ ...p, gender: e.target.value }))} required>
                <option value="">Gender</option>
                <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
              </select>
            </div>
            <button type="submit" disabled={loading} style={{ marginTop:16, width:"100%" }}>
              {loading ? "Creating..." : "Create Account"}
            </button>
            <button type="button" onClick={() => { setGooglePending(null); setIsRegister(false); clrErr(); }}
              style={{ background:"none", color:"#9ca3af", border:"none", marginTop:10, cursor:"pointer", fontSize:13, boxShadow:"none", padding:"8px 20px", textTransform:"none", fontWeight:400 }}>
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
      subtitle={<>We sent a 6-digit OTP to <strong style={{ color:"#059669" }}>{registerForm.email}</strong></>}
      formError={formError} onBack={() => { goTo("auth"); setIsRegister(true); }}>
      <form onSubmit={handleOTPSubmit} style={{ width:"100%" }}>
        <OTPInput value={otpValue} onChange={(v) => { setOtpValue(v); clrErr(); }} />
        <p className="otp-resend">
          {otpTimer > 0
            ? <>Resend in <strong>{otpTimer}s</strong></>
            : <>Didn't receive it?{" "}<button type="button" onClick={handleResendRegisterOTP}>Resend OTP</button></>}
        </p>
        <button type="submit" disabled={loading || otpValue.length < 6} style={{ width:"100%", marginTop:16 }}>
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
      <form onSubmit={handleForgotSend} style={{ width:"100%" }}>
        <input type="email" placeholder="Your registered email" value={forgotEmail}
          onChange={(e) => { setForgotEmail(e.target.value); clrErr(); }}
          required style={{ marginBottom:16 }} />
        <button type="submit" disabled={loading} style={{ width:"100%" }}>
          {loading ? "Sending..." : "Send Reset OTP"}
        </button>
      </form>
    </FlowCard>
  );

  /* Forgot — enter OTP */
  if (view === "forgot-otp") return (
    <FlowCard icon="🔑" title="Enter OTP"
      subtitle={<>OTP sent to <strong style={{ color:"#059669" }}>{forgotEmail}</strong></>}
      formError={formError} onBack={() => goTo("forgot-email")}>
      <form onSubmit={handleForgotVerify} style={{ width:"100%" }}>
        <OTPInput value={otpValue} onChange={(v) => { setOtpValue(v); clrErr(); }} />
        <p className="otp-resend">
          {otpTimer > 0
            ? <>Resend in <strong>{otpTimer}s</strong></>
            : <>Didn't receive it?{" "}<button type="button" onClick={handleForgotResend}>Resend OTP</button></>}
        </p>
        <button type="submit" disabled={loading || otpValue.length < 6} style={{ width:"100%", marginTop:16 }}>
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
      <form onSubmit={handleResetPassword} style={{ width:"100%" }}>
        <input type="password" placeholder="New password (min 6 chars)" value={newPass}
          onChange={(e) => { setNewPass(e.target.value); clrErr(); }} required />
        <input type="password" placeholder="Confirm new password" value={confirmPass}
          onChange={(e) => { setConfirmPass(e.target.value); clrErr(); }} required />
        <button type="submit" disabled={loading} style={{ width:"100%", marginTop:8 }}>
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
            <p className="form-subtitle">Join HumaniCare and take charge of your health</p>

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
              onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))} required />

            <PhoneInput country="in" value={registerForm.mobile}
              onChange={(ph) => setRegisterForm((p) => ({ ...p, mobile: ph }))}
              inputStyle={{ width:"100%", borderRadius:12, border:"1.5px solid #d1fae5", background:"#f8fdfb", fontFamily:"DM Sans,sans-serif", fontSize:14, height:46 }} />

            <div className="row">
              <input type="date" value={registerForm.dob}
                onChange={(e) => setRegisterForm((p) => ({ ...p, dob: e.target.value }))} required />
              <select value={registerForm.gender}
                onChange={(e) => setRegisterForm((p) => ({ ...p, gender: e.target.value }))} required>
                <option value="">Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <input type="password" placeholder="Password (min 6 chars)" value={registerForm.password}
              onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))} required />

            <label className="terms">
              <input type="checkbox" checked={registerForm.terms}
                onChange={(e) => setRegisterForm((p) => ({ ...p, terms: e.target.checked }))} />
              I accept Terms &amp; Conditions
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

            {formError && <p className="form-error">{formError}</p>}
            <span>or use your email</span>

            <input type="email" placeholder="Email Address" value={loginForm.email}
              onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))} required />
            <input type="password" placeholder="Password" value={loginForm.password}
              onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} required />

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
              <h1>Join HumaniCare</h1>
              <p>Connect with top doctors, manage appointments, and take control of your health today.</p>
              <button className="transparent-btn" onClick={() => setIsRegister(true)}>Sign Up</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
