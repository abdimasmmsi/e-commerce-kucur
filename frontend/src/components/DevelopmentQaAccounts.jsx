import "./DevelopmentQaAccounts.css";
import { usePreferences } from "../context/PreferencesContext";
import { uatAccounts } from "../utils/uatAccounts";

const qaAccounts = [
  { name: ["Pembeli", "Customer"], roles: ["Pembeli", "Customer"], email: "customer@kucur.test", password: "KucurDev123!" },
  { name: ["Penjual A", "Seller A"], roles: ["Pembeli + Penjual", "Customer + Seller"], email: "merchant.a@kucur.test", password: "KucurDev123!" },
  { name: ["Penjual B", "Seller B"], roles: ["Pembeli + Penjual", "Customer + Seller"], email: "merchant.b@kucur.test", password: "KucurDev123!" },
  { name: ["Kurir", "Courier"], roles: ["Kurir", "Courier"], email: "courier@kucur.test", password: "KucurDev123!" },
  { name: ["Admin", "Admin"], roles: ["Admin", "Admin"], email: "admin@kucur.test", password: "KucurDev123!" },
];

function DevelopmentQaAccounts({ onSelect }) {
  const { language, t } = usePreferences();
  const pick = (pair) => (language === "id" ? pair[0] : pair[1]);
  // Server UAT: tampilkan hanya akun penjual contoh (dari VITE_UAT_ACCOUNTS), bukan akun QA pengembangan.
  const uatMode = uatAccounts.length > 0;
  const accounts = uatMode
    ? uatAccounts.map((account) => ({ name: [`Penjual contoh: ${account.label || account.email}`, `Sample seller: ${account.label || account.email}`], roles: ["Pembeli + Penjual", "Customer + Seller"], email: account.email, password: account.password }))
    : qaAccounts;
  const heading = uatMode
    ? { title: language === "id" ? "Akun contoh untuk uji coba" : "Sample accounts for the trial", description: language === "id" ? "Pakai akun penjual contoh ini, atau daftar akun sendiri. Jangan isi data pribadi sungguhan." : "Use one of these sample seller accounts, or sign up for your own. Do not enter real personal data.", badge: language === "id" ? "Uji coba" : "Trial" }
    : { title: t("qa.title"), description: t("qa.description"), badge: t("qa.developmentOnly") };
  return (
    <aside className="qa-accounts" aria-labelledby="qa-accounts-heading">
      <header className="qa-accounts-heading">
        <div><h2 id="qa-accounts-heading">{heading.title}</h2><p>{heading.description}</p></div>
        <span>{heading.badge}</span>
      </header>
      <div className="qa-account-list">
        {accounts.map((account) => (
          <article className="qa-account-row" key={account.email}>
            <div className="qa-account-identity"><strong>{pick(account.name)}</strong><span>{pick(account.roles)}</span></div>
            <dl className="qa-account-credentials">
              <div><dt>Email</dt><dd>{account.email}</dd></div>
              <div><dt>{language === "id" ? "Kata sandi" : "Password"}</dt><dd>{account.password}</dd></div>
            </dl>
            <button type="button" onClick={() => onSelect(account)}>{t("qa.useAccount")}</button>
          </article>
        ))}
      </div>
    </aside>
  );
}

export default DevelopmentQaAccounts;
