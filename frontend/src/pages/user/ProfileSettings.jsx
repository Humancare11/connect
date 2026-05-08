import { useEffect, useState } from "react";
import "./ProfileSettings.css";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";

export default function ProfileSettings() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    gender: "",
    dob: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        mobile: user.mobile || "",
        gender: user.gender || "",
        dob: user.dob || "",
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.put("/api/auth/update-profile", formData);
      updateUser({ ...user, ...formData });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getMemberSince = () => {
    if (!user?.createdAt) return "—";
    return new Date(user.createdAt).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });
  };

  const getAge = () => {
    if (!formData.dob) return null;
    const diff = Date.now() - new Date(formData.dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  if (!user) return null;

  return (
    <div className="hc-ps__page">

      {/* Header */}
      {/* <div className="hc-ps__header">
        <div>
          <p className="hc-ps__eyebrow">Account</p>
          <h1 className="hc-ps__title">Profile Settings</h1>
          <p className="hc-ps__subtitle">Manage your personal information and preferences</p>
        </div>
      </div> */}

      <div className="hc-ps__body">

        {/* Left: Avatar Card */}
        <div className="hc-ps__sidebar-col">
          <div className="hc-ps__avatar-card">
            <div className="hc-ps__avatar-ring">
              <div className="hc-ps__avatar">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            </div>
            <h3 className="hc-ps__avatar-name">{user?.name}</h3>
            <p className="hc-ps__avatar-email">{user?.email}</p>
            <span className="hc-ps__avatar-badge">Patient</span>

            <div className="hc-ps__avatar-divider" />

            <div className="hc-ps__avatar-meta">
              <div className="hc-ps__meta-row">
                <span className="hc-ps__meta-icon">📅</span>
                <div>
                  <p className="hc-ps__meta-label">Member since</p>
                  <p className="hc-ps__meta-val">{getMemberSince()}</p>
                </div>
              </div>
              {formData.gender && (
                <div className="hc-ps__meta-row">
                  <span className="hc-ps__meta-icon">👤</span>
                  <div>
                    <p className="hc-ps__meta-label">Gender</p>
                    <p className="hc-ps__meta-val" style={{ textTransform: "capitalize" }}>
                      {formData.gender}
                    </p>
                  </div>
                </div>
              )}
              {getAge() && (
                <div className="hc-ps__meta-row">
                  <span className="hc-ps__meta-icon">🎂</span>
                  <div>
                    <p className="hc-ps__meta-label">Age</p>
                    <p className="hc-ps__meta-val">{getAge()} years old</p>
                  </div>
                </div>
              )}
              {formData.mobile && (
                <div className="hc-ps__meta-row">
                  <span className="hc-ps__meta-icon">📞</span>
                  <div>
                    <p className="hc-ps__meta-label">Mobile</p>
                    <p className="hc-ps__meta-val">{formData.mobile}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Form */}
        <div className="hc-ps__form-col">
          <div className="hc-ps__form-card">
            <div className="hc-ps__form-card-header">
              <h2 className="hc-ps__form-title">Personal Information</h2>
              <p className="hc-ps__form-sub">Update your details below and save</p>
            </div>

            {/* Toast messages */}
            {saved && (
              <div className="hc-ps__toast hc-ps__toast--success">
                ✅ Profile updated successfully!
              </div>
            )}
            {error && (
              <div className="hc-ps__toast hc-ps__toast--error">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="hc-ps__form">

              {/* Row 1 */}
              <div className="hc-ps__form-row">
                <div className="hc-ps__field">
                  <label className="hc-ps__label" htmlFor="name">
                    Full Name <span className="hc-ps__required">*</span>
                  </label>
                  <div className="hc-ps__input-wrap">
                    <span className="hc-ps__input-icon">👤</span>
                    <input
                      className="hc-ps__input"
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                </div>

                <div className="hc-ps__field">
                  <label className="hc-ps__label" htmlFor="email">
                    Email Address <span className="hc-ps__required">*</span>
                  </label>
                  <div className="hc-ps__input-wrap">
                    <span className="hc-ps__input-icon">✉️</span>
                    <input
                      className="hc-ps__input"
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@email.com"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              <div className="hc-ps__form-row">
                <div className="hc-ps__field">
                  <label className="hc-ps__label" htmlFor="mobile">Mobile Number</label>
                  <div className="hc-ps__input-wrap">
                    <span className="hc-ps__input-icon">📞</span>
                    <input
                      className="hc-ps__input"
                      type="tel"
                      id="mobile"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleChange}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div className="hc-ps__field">
                  <label className="hc-ps__label" htmlFor="gender">Gender</label>
                  <div className="hc-ps__input-wrap">
                    <span className="hc-ps__input-icon">⚧</span>
                    <select
                      className="hc-ps__input hc-ps__select"
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 3 */}
              <div className="hc-ps__form-row hc-ps__form-row--half">
                <div className="hc-ps__field">
                  <label className="hc-ps__label" htmlFor="dob">Date of Birth</label>
                  <div className="hc-ps__input-wrap">
                    <span className="hc-ps__input-icon">🎂</span>
                    <input
                      className="hc-ps__input"
                      type="date"
                      id="dob"
                      name="dob"
                      value={formData.dob}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="hc-ps__form-actions">
                <button
                  type="button"
                  className="hc-ps__btn hc-ps__btn--ghost"
                  onClick={() => {
                    if (user) {
                      setFormData({
                        name: user.name || "",
                        email: user.email || "",
                        mobile: user.mobile || "",
                        gender: user.gender || "",
                        dob: user.dob || "",
                      });
                    }
                    setSaved(false);
                    setError("");
                  }}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className={`hc-ps__btn hc-ps__btn--primary ${saving ? "hc-ps__btn--loading" : ""}`}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="hc-ps__btn-spinner" />
                      Saving…
                    </>
                  ) : saved ? (
                    "✅ Saved!"
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}