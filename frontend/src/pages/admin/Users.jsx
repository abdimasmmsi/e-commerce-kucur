import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import Pagination from "../../components/ui/Pagination";
import { usePreferences } from "../../context/PreferencesContext";
import { adminUserService } from "../../services/adminUserService";
import { paginate } from "../../utils/pagination";
import "./Users.css";

const PAGE_SIZE = 10;

const securityState = (user, t) => {
  if (user.passwordSecurity?.resetRequired) return { className: "warning", label: t("adminUsers.resetRequired") };
  if (user.passwordSecurity?.rotationRecommended) return { className: "warning", label: t("adminUsers.overdue") };
  return { className: "current", label: t("adminUsers.current") };
};

export default function Users() {
  const { formatDate, language, statusLabel, t } = usePreferences();
  const roleNames = language === "id" ? { customer: "Pembeli", merchant: "Merchant", courier: "Kurir", admin: "Admin" } : { customer: "Customer", merchant: "Merchant", courier: "Courier", admin: "Admin" };
  const roleLabel = (role) => roleNames[String(role).toLowerCase()] ?? statusLabel(role);
  const [users, setUsers] = useState([]); const [query, setQuery] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null); const [form, setForm] = useState({ adminPassword: "", temporaryPassword: "", confirmPassword: "" }); const [resetState, setResetState] = useState({ busy: false, error: "", message: "" });
  useEffect(() => { let active = true; adminUserService.list().then((rows) => { if (active) setUsers(rows); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const filtered = useMemo(() => { const term = query.trim().toLowerCase(); return term ? users.filter((user) => `${user.fullName || user.name} ${user.email} ${(user.roles || []).join(" ")}`.toLowerCase().includes(term)) : users; }, [query, users]);
  const visibleUsers = paginate(filtered, page, PAGE_SIZE);
  const closeReset = () => { setSelected(null); setForm({ adminPassword: "", temporaryPassword: "", confirmPassword: "" }); setResetState({ busy: false, error: "", message: "" }); };
  const submitReset = async (event) => { event.preventDefault(); if (form.temporaryPassword.length < 8) return setResetState({ busy: false, error: t("adminUsers.minimum"), message: "" }); if (form.temporaryPassword !== form.confirmPassword) return setResetState({ busy: false, error: t("adminUsers.mismatch"), message: "" }); setResetState({ busy: true, error: "", message: "" }); try { const updated = await adminUserService.resetPassword(selected.id, { adminPassword: form.adminPassword, temporaryPassword: form.temporaryPassword }); setUsers((current) => current.map((user) => user.id === updated.user.id ? updated.user : user)); setResetState({ busy: false, error: "", message: t("adminUsers.success") }); setForm({ adminPassword: "", temporaryPassword: "", confirmPassword: "" }); } catch (resetError) { setResetState({ busy: false, error: resetError.message, message: "" }); } };

  return <div className="page-container admin-users-page"><PageHeader eyebrow={t("workspace.adminEyebrow")} title={t("adminUsers.title")} description={t("adminUsers.subtitle")} /><p className="admin-users-security-note">{t("adminUsers.neverExposed")}</p><label className="admin-users-search"><span>{t("commerce.search")}</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("adminUsers.search")}/></label>{error && <p className="admin-users-feedback error" role="alert">{t("adminUsers.loadFailed")}</p>}
    {loading ? <LoadingPanel label={t("common.loading")} rows={5} /> : error ? null : filtered.length ? <><div className="admin-users-table-wrap"><table><thead><tr><th>{t("adminUsers.account")}</th><th>{t("adminUsers.role")}</th><th>{t("adminUsers.passwordState")}</th><th>{t("adminUsers.action")}</th></tr></thead><tbody>{visibleUsers.map((user) => { const state = securityState(user, t); return <tr key={user.id}><td><strong>{user.fullName || user.name}</strong><small>{user.email}</small></td><td>{(user.roles || []).map(roleLabel).join(", ")}</td><td><span className={`admin-password-state ${state.className}`}>{state.label}</span>{user.passwordSecurity?.changedAt && <small>{t("passwordSecurity.changedAt")}: {formatDate(user.passwordSecurity.changedAt)}</small>}</td><td><Button variant="secondary" onClick={() => { setSelected(user); setResetState({ busy: false, error: "", message: "" }); }}>{t("adminUsers.reset")}</Button></td></tr>; })}</tbody></table></div><Pagination page={page} pageSize={PAGE_SIZE} totalItems={filtered.length} onPageChange={setPage}/></> : <EmptyState title={t("adminUsers.empty")} description={t("adminUsers.subtitle")} />}
    {selected && <div className="admin-users-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !resetState.busy) closeReset(); }}><section className="admin-users-modal" role="dialog" aria-modal="true" aria-labelledby="admin-reset-title"><header><div><h2 id="admin-reset-title">{t("adminUsers.resetTitle")}</h2><p>{selected.fullName || selected.name} · {selected.email}</p></div><button type="button" aria-label={t("adminUsers.cancel")} onClick={closeReset}>×</button></header><form onSubmit={submitReset}><label>{t("adminUsers.adminPassword")}<input type="password" autoComplete="current-password" required value={form.adminPassword} onChange={(event) => setForm((current) => ({ ...current, adminPassword: event.target.value }))}/></label><label>{t("adminUsers.temporaryPassword")}<input type="password" autoComplete="new-password" minLength="8" required value={form.temporaryPassword} onChange={(event) => setForm((current) => ({ ...current, temporaryPassword: event.target.value }))}/></label><label>{t("adminUsers.confirmPassword")}<input type="password" autoComplete="new-password" minLength="8" required value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}/></label>{(resetState.error || resetState.message) && <p className={`admin-users-feedback ${resetState.error ? "error" : "success"}`} role={resetState.error ? "alert" : "status"}>{resetState.error || resetState.message}</p>}<footer><button type="button" className="secondary-button" onClick={closeReset} disabled={resetState.busy}>{t("adminUsers.cancel")}</button><button type="submit" className="primary-button" disabled={resetState.busy}>{t("adminUsers.submit")}</button></footer></form></section></div>}
  </div>;
}
