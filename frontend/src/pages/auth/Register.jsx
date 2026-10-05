import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/authService";
import { usePreferences } from "../../context/PreferencesContext";
import AddressForm from "../../components/location/AddressForm";
import { addressProblem, emptyAddress } from "../../utils/address";
import { getAuthenticatedHome } from "../../utils/authNavigation";
import "./Register.css";

const initialForm = { fullName: "", email: "", phone: "", password: "", confirmPassword: "" };
function Register() {
  const navigate = useNavigate();
  const { activeRole, initialized, isAuthenticated, register, user } = useAuth();
  const { language, t } = usePreferences();
  const [form, setForm] = useState(initialForm);
  const [address, setAddress] = useState(() => emptyAddress({ label: language === "id" ? "Rumah" : "Home" }));
  const addressCopy = language === "id" ? { title: "Alamat pengiriman utama", hint: "Dipakai otomatis saat checkout. Kamu bisa menambah sampai 5 alamat nanti di menu Akun." } : { title: "Main delivery address", hint: "Used automatically at checkout. You can add up to 5 addresses later from Account." };
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleChange = (event) => { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })); setError(""); };
  const [emailTaken, setEmailTaken] = useState("");
  const emailCopy = language === "id"
    ? { taken: "Email ini sudah terdaftar. Kamu tidak perlu daftar lagi, cukup masuk.", login: "Masuk dengan email ini" }
    : { taken: "This email is already registered. No need to sign up again, just log in.", login: "Log in with this email" };
  // Beri tahu sejak awal kalau email sudah punya akun, sebelum user mengisi seluruh form.
  const checkEmail = async () => {
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    try { const status = await authService.emailStatus(email); setEmailTaken(status?.registered ? email : ""); } catch { /* cek ulang saat submit */ }
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (Object.values(form).some((value) => !value.trim())) return setError("Semua field wajib diisi.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError("Format email tidak valid.");
    if (form.password.length < 8) return setError("Password minimal 8 karakter.");
    if (form.password !== form.confirmPassword) return setError("Konfirmasi password tidak sama.");
    const delivery = { ...address, recipientName: address.recipientName.trim() || form.fullName.trim(), phone: address.phone.trim() || form.phone.trim() };
    const problem = addressProblem(delivery, language);
    if (problem) return setError(problem);
    setSubmitting(true); const result = await register({ ...form, address: { ...delivery, latitude: Number(delivery.latitude), longitude: Number(delivery.longitude) } }); setSubmitting(false);
    if (!result.success) { if (result.code === "CONFLICT") { setEmailTaken(form.email.trim().toLowerCase()); return setError(""); } return setError(result.message); }
    navigate("/login", { replace: true, state: { message: "Akun berhasil dibuat. Silakan login." } });
  };
  if (!initialized) return <div className="auth-page"><section className="card auth-card" role="status">{t("auth.checking")}</section></div>;
  if (isAuthenticated) return <Navigate to={getAuthenticatedHome(activeRole, user.roles)} replace />;
  return <div className="auth-page register-page"><section className="card auth-card register-card">
    <div className="auth-heading"><span className="auth-eyebrow">{t("auth.eyebrow")}</span><h1>{t("auth.registerTitle")}</h1><p>{t("auth.registerDescription")}</p></div>
    <form className="auth-form register-form" onSubmit={handleSubmit} noValidate>
      <label><span>{t("auth.fullName")}</span><input name="fullName" value={form.fullName} onChange={handleChange} placeholder={t("auth.fullName")} /></label>
      <label><span>{t("auth.email")}</span><input name="email" type="email" autoComplete="email" value={form.email} onChange={(event) => { handleChange(event); setEmailTaken(""); }} onBlur={checkEmail} placeholder="nama@email.com" aria-describedby={emailTaken ? "register-email-taken" : undefined} /></label>
      {emailTaken && <div className="grid gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[15px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100" id="register-email-taken" role="alert"><span>{emailCopy.taken}</span><Link className="inline-flex min-h-11 w-fit items-center rounded-xl bg-[var(--kucur-green)] px-4 text-sm font-bold text-[var(--kucur-on-green)]" to="/login" state={{ email: emailTaken }}>{emailCopy.login} →</Link></div>}
      <label><span>{t("auth.phone")}</span><input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="08xxxxxxxxxx" /></label>
      <label><span>{t("auth.password")}</span><input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Minimal 8 karakter" /></label>
      <label><span>{t("auth.confirmPassword")}</span><input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder={t("auth.confirmPassword")} /></label>
      <fieldset className="register-full grid min-w-0 gap-3 border-t border-[var(--kucur-border)] pt-4"><legend className="sr-only">{addressCopy.title}</legend><div><strong className="block text-base">{addressCopy.title}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{addressCopy.hint}</span></div><AddressForm value={{ ...address, recipientName: address.recipientName || form.fullName, phone: address.phone || form.phone }} onChange={setAddress} /></fieldset>
      {error && <p className="auth-error register-full" role="alert">{error}</p>}
      <button className="primary-button register-full" type="submit" disabled={submitting}>{submitting ? t("auth.creating") : t("auth.createAccount")}</button>
    </form>
    <p className="auth-switch-copy">{t("auth.hasAccount")} <Link to="/login">{t("auth.loginButton")}</Link></p>
  </section></div>;
}
export default Register;
