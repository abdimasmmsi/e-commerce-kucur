import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { roleHomePaths, roleLabels } from "../../utils/authNavigation";
import "./Unauthorized.css";

function Unauthorized() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeRole, isAuthenticated, switchRole, user } = useAuth();
  const requestedRoles = location.state?.allowedRoles ?? [];
  const availableRoles = user?.roles ?? [];

  const openDashboard = (role) => {
    const result = switchRole(role);
    if (result.success) navigate(roleHomePaths[role] ?? "/", { replace: true });
  };

  return (
    <div className="unauthorized-page">
      <section className="card unauthorized-card">
        <div className="unauthorized-icon">!</div>
        <span className="unauthorized-eyebrow">403 · Forbidden</span>
        <h1>Akses Tidak Diizinkan</h1>
        <p>
          Akun Anda tidak memiliki role yang diperlukan untuk membuka halaman ini.
          {location.state?.from && <small>Route: {location.state.from}</small>}
        </p>

        {requestedRoles.length > 0 && (
          <div className="required-role-notice">
            Role yang diizinkan: <strong>{requestedRoles.join(", ")}</strong>
          </div>
        )}

        <div className="unauthorized-actions">
          <Link className="primary-button" to="/">Kembali ke Home</Link>
          {!isAuthenticated && <Link className="secondary-button" to="/login">Login</Link>}
        </div>

        {isAuthenticated && availableRoles.length > 1 && (
          <div className="role-switch-options">
            <strong>Buka dashboard role lain</strong>
            <div>
              {availableRoles.map((role) => (
                <button
                  key={role}
                  className={role === activeRole ? "active" : ""}
                  type="button"
                  onClick={() => openDashboard(role)}
                >
                  Workspace {roleLabels[role] ?? role}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default Unauthorized;
