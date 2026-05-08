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

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.terms) return alert("Accept Terms & Conditions");
    if (form.password.length < 6) return alert("Password must be at least 6 characters");
    if (!form.mobile) return alert("Enter mobile number");
    if (!form.dob) return alert("Select Date of Birth");
    if (!form.gender) return alert("Select Gender");

    const { terms, ...data } = form;

    try {
      await api.post("/api/auth/register", data);
      alert("Registered Successfully ✅");
      navigate("/login");
    } catch (err) {
      alert(err?.response?.data?.msg || "Server Error ❌");
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="register-form">
        <h2>Create Account</h2>

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

        {/* ✅ DOB + Gender same line */}
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
          I accept Terms & Conditions
        </label>

        <button type="submit">Register</button>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}