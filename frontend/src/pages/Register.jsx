import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import PhoneInputLib from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import "./register.css";

const PhoneInput = PhoneInputLib.default ?? PhoneInputLib;

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

    if (!form.terms) return setFormError("Please accept Terms & Conditions to continue.");
    if (form.password.length < 6) return setFormError("Password must be at least 6 characters.");
    if (!form.mobile) return setFormError("Please enter your mobile number.");
    if (!form.dob) return setFormError("Please select your date of birth.");
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
          placeholder="Password"
          onChange={handleChange}
          required
        />

        <label className="terms">
          <input type="checkbox" name="terms" onChange={handleChange} />
          I accept Terms &amp; Conditions
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
