import "./DevelopmentQaAccounts.css";
import { usePreferences } from "../context/PreferencesContext";

const qaAccounts = [
  { name: "Customer", roles: "Customer", email: "customer@kucur.test", password: "KucurDev123!" },
  { name: "Merchant A", roles: "Customer + Merchant", email: "merchant.a@kucur.test", password: "KucurDev123!" },
  { name: "Merchant B", roles: "Customer + Merchant", email: "merchant.b@kucur.test", password: "KucurDev123!" },
  { name: "Courier", roles: "Courier", email: "courier@kucur.test", password: "KucurDev123!" },
  { name: "Admin", roles: "Admin", email: "admin@kucur.test", password: "KucurDev123!" },
];

function DevelopmentQaAccounts({ onSelect }) {
  const { t } = usePreferences();
  return (
    <aside className="qa-accounts" aria-labelledby="qa-accounts-heading">
      <header className="qa-accounts-heading">
        <div><h2 id="qa-accounts-heading">{t("qa.title")}</h2><p>{t("qa.description")}</p></div>
        <span>{t("qa.developmentOnly")}</span>
      </header>
      <div className="qa-account-list">
        {qaAccounts.map((account) => (
          <article className="qa-account-row" key={account.email}>
            <div className="qa-account-identity"><strong>{account.name}</strong><span>{account.roles}</span></div>
            <dl className="qa-account-credentials">
              <div><dt>Email</dt><dd>{account.email}</dd></div>
              <div><dt>Password</dt><dd>{account.password}</dd></div>
            </dl>
            <button type="button" onClick={() => onSelect(account)}>{t("qa.useAccount")}</button>
          </article>
        ))}
      </div>
    </aside>
  );
}

export default DevelopmentQaAccounts;
