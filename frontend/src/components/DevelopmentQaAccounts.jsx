import "./DevelopmentQaAccounts.css";
import { usePreferences } from "../context/PreferencesContext";

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
  return (
    <aside className="qa-accounts" aria-labelledby="qa-accounts-heading">
      <header className="qa-accounts-heading">
        <div><h2 id="qa-accounts-heading">{t("qa.title")}</h2><p>{t("qa.description")}</p></div>
        <span>{t("qa.developmentOnly")}</span>
      </header>
      <div className="qa-account-list">
        {qaAccounts.map((account) => (
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
