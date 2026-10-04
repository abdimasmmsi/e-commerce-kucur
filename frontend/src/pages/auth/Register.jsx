import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { getAuthenticatedHome } from "../../utils/authNavigation";
import "./Register.css";

const initialForm = { fullName: "", email: "", phone: "", password: "", confirmPassword: "" };
function Register() {
  const navigate = useNavigate();
  const { activeRole, initialized, isAuthenticated, register, user } = useAuth();
  const { t } = usePreferences();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleChange = (event) => { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })); setError(""); };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (Object.values(form).some((value) => !value.trim())) return setError("Semua field wajib diisi.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError("Format email tidak valid.");
    if (form.password.length < 8) return setError("Password minimal 8 karakter.");
    if (form.password !== form.confirmPassword) return setError("Konfirmasi password tidak sama.");
    setSubmitting(true); const result = await register(form); setSubmitting(false);
    if (!result.success) return setError(result.message);
    navigate("/login", { replace: true, state: { message: "Akun berhasil dibuat. Silakan login." } });
  };
  if (!initialized) return <div className="auth-page"><section className="card auth-card" role="status">{t("auth.checking")}</section></div>;
  if (isAuthenticated) return <Navigate to={getAuthenticatedHome(activeRole, user.roles)} replace />;
  return <div className="auth-page register-page"><section className="card auth-card register-card">
    <div className="auth-heading"><span className="auth-eyebrow">{t("nav.account")}</span><h1>{t("auth.registerTitle")}</h1><p>{t("auth.registerDescription")}</p></div>
    <form className="auth-form register-form" onSubmit={handleSubmit} noValidate>
      <label><span>{t("auth.fullName")}</span><input name="fullName" value={form.fullName} onChange={handleChange} placeholder={t("auth.fullName")} /></label>
      <label><span>{t("auth.email")}</span><input name="email" type="email" value={form.email} onChange={handleChange} placeholder="nama@email.com" /></label>
      <label><span>{t("auth.phone")}</span><input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="08xxxxxxxxxx" /></label>
      <label><span>{t("auth.password")}</span><input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Minimal 8 karakter" /></label>
      <label><span>{t("auth.confirmPassword")}</span><input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder={t("auth.confirmPassword")} /></label>
      {error && <p className="auth-error register-full">{error}</p>}
      <button className="primary-button register-full" type="submit" disabled={submitting}>{submitting ? t("auth.creating") : t("auth.createAccount")}</button>
    </form>
    <p className="auth-switch-copy">{t("auth.hasAccount")} <Link to="/login">{t("auth.loginButton")}</Link></p>
  </section></div>;
}
export default Register;
