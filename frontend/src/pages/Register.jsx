import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import PhoneInputLib from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import "./register.css";

const PhoneInput = PhoneInputLib.default ?? PhoneInputLib;
const PASSWORD_REQUIREMENTS = "8+ chars with uppercase, lowercase, number, and symbol.";
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
  if (!dob) return "Please select your date of birth.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return "Please enter a valid date of birth.";
  if (Number.isNaN(new Date(`${dob}T00:00:00`).getTime())) return "Please enter a valid date of birth.";
  if (dob > todayISO()) return "Date of birth cannot be in the future.";
  if (dob < DOB_MIN) return "Date of birth must be in or after 1900.";
  return "";
}

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    country: "",
    dob: "",
    gender: "",
    password: "",
    terms: false,
    privacyConsent: false,
    hipaaConsent: false,
  });
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (formError) setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!form.terms || !form.privacyConsent || !form.hipaaConsent) {
      return setFormError("Please accept Terms, Privacy Policy, and HIPAA consent requirements.");
    }
    const passwordError = getPasswordError(form.password);
    if (passwordError) return setFormError(passwordError);
    if (!form.mobile) return setFormError("Please enter your mobile number.");
    const dobError = getDobError(form.dob);
    if (dobError) return setFormError(dobError);
    if (!form.gender) return setFormError("Please select your gender.");

    const { terms, ...data } = form;
    setLoading(true);
    try {
      await api.post("/api/auth/register", data);
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      setFormError(err?.response?.data?.msg || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const passwordError = form.password ? getPasswordError(form.password) : "";

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="register-form">
        <h2>Create Account</h2>

        {formError && (
          <div style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#dc2626",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span>&#9888;</span> {formError}
          </div>
        )}

        <input
          type="text"
          name="name"
          placeholder="Full Name"
          onChange={handleChange}
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Email Address"
          onChange={handleChange}
          required
        />

        <PhoneInput
          country="in"
          value={form.mobile}
          onChange={(phone) =>
            setForm((prev) => ({ ...prev, mobile: phone }))
          }
          inputStyle={{ width: "100%" }}
        />

        <div className="row">
          <input
            type="date"
            name="dob"
            value={form.dob}
            onChange={handleChange}
            min={DOB_MIN}
            max={todayISO()}
            required
          />

          <select name="gender" onChange={handleChange} required>
            <option value="">Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <input
          type="password"
          name="password"
          placeholder="Password (8+ chars, mixed case, number, symbol)"
          onChange={handleChange}
          required
        />
        <p style={{ fontSize: 12, color: passwordError ? "#dc2626" : "#475569", margin: "-6px 0 8px" }}>
          {passwordError || PASSWORD_REQUIREMENTS}
        </p>

        <label className="terms">
          <input
            type="checkbox"
            name="terms"
            checked={form.terms && form.privacyConsent && form.hipaaConsent}
            onChange={(e) => setForm((prev) => ({
              ...prev,
              terms: e.target.checked,
              privacyConsent: e.target.checked,
              hipaaConsent: e.target.checked,
            }))}
          />
          I agree to the <Link to="/terms" target="_blank">Terms</Link>, <Link to="/privacy" target="_blank">Privacy Policy</Link>, and HIPAA consent requirements.
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Registering…" : "Register"}
        </button>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
