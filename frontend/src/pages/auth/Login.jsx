import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DevelopmentQaAccounts from "../../components/DevelopmentQaAccounts";
import { usePreferences } from "../../context/PreferencesContext";
import { getAuthenticatedHome, getRequiredRoleForPath, roleHomePaths } from "../../utils/authNavigation";
import { uatAccounts } from "../../utils/uatAccounts";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { activeRole, initialized, isAuthenticated, login, user } = useAuth();
  const { language, t } = usePreferences();
  const [email, setEmail] = useState(() => location.state?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionExpired] = useState(() => {
    const expired = sessionStorage.getItem("kucur_session_expired") === "1";
    sessionStorage.removeItem("kucur_session_expired");
    return expired;
  });
  const requestedPath = searchParams.get("redirect") ?? location.state?.from ?? null;
  const fillQaAccount = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError(""); setSubmitting(true);
    let requiredRole = null;
    let result;
    try {
      requiredRole = getRequiredRoleForPath(requestedPath);
      result = await login(email, password, requiredRole);
    } catch {
      result = { success: false, message: "Login tidak dapat diproses. Silakan coba lagi." };
    } finally {
      setSubmitting(false);
    }
    if (!result.success) return setError(result.message);
    const destination = requiredRole && !result.user.roles.includes(requiredRole) ? roleHomePaths[result.activeRole] : requestedPath;
    navigate(destination ?? roleHomePaths[requiredRole ?? result.activeRole] ?? "/", { replace: true });
  };

  if (searchParams.get("mode") === "register") return <Navigate to="/register" replace />;
  if (!initialized) return <div className="auth-page"><section className="card auth-card" role="status">{t("auth.checking")}</section></div>;
  if (isAuthenticated) {
    const requiredRole = getRequiredRoleForPath(requestedPath);
    return <Navigate to={!requiredRole || requiredRole === activeRole ? requestedPath ?? getAuthenticatedHome(activeRole, user.roles) : getAuthenticatedHome(activeRole, user.roles)} replace />;
  }

  return <div className="auth-page"><section className="card auth-card">
    <div className="auth-heading"><span className="auth-eyebrow">{t("auth.eyebrow")}</span><h1>{t("auth.loginTitle")}</h1><p>{t("auth.loginDescription")}</p></div>
    {location.state?.message && <p className="auth-success">{location.state.message}</p>}
    {sessionExpired && <p className="auth-session-warning" role="status">{t("passwordSecurity.sessionExpired")}</p>}
    <form className="auth-form" onSubmit={handleSubmit}>
      <label><span>{t("auth.email")}</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@kucur.test" /></label>
      <label><span>{t("auth.password")}</span><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("auth.passwordPlaceholder")} /></label>
      {error && <p className="auth-error">{error}</p>}
      <button className="primary-button" type="submit" disabled={submitting}>{submitting ? t("auth.processing") : t("auth.loginButton")}</button>
    </form>
    {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === "true" || uatAccounts.length > 0) &&<DevelopmentQaAccounts onSelect={fillQaAccount} />}
    <p className="auth-switch-copy">{t("auth.noAccount")} <Link to="/register">{t("auth.registerCustomer")}</Link></p>
    <p className="auth-switch-copy"><Link to="/privacy">{language === "id" ? "Kebijakan Privasi" : "Privacy Policy"}</Link></p>
  </section></div>;
}

export default Login;
