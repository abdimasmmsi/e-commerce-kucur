import { useState } from "react";
import { Link } from "react-router-dom";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import { usePreferences } from "../../context/PreferencesContext";
import { openFaqBot } from "../../utils/faqMatcher.js";
import { APP_INFO } from "../../config/appInfo";
import "./About.css";

// Halaman Tentang: identitas pengembang dan lisensi, di luar halaman kerja supaya operasional tidak terganggu.
const COPY = {
  id: {
    eyebrow: "Desa Wisata Kucur",
    title: "Tentang Kucur Local Market",
    intro: "Platform jual beli produk lokal warga Desa Wisata Kucur: belanja dari lapak warga, diantar kurir desa, dan dikelola bersama pengelola desa.",
    version: "Versi {version} · {released}",
    builtBy: "Dikembangkan oleh",
    builtByNote: "Dikembangkan sebagai Tugas Akhir program TTG, dengan bantuan Claude Code (Anthropic) sebagai asisten pemrograman.",
    photoLabel: "Foto profesional",
    partners: "Pembimbing dan mitra",
    advisor: "Dosen pembimbing",
    village: "Mitra desa",
    villageValue: "Pengelola Desa Wisata Kucur",
    help: "Butuh bantuan?",
    helpBody: "Tanya lewat Bantuan (FAQ). Kalau belum terjawab, hubungi Admin desa lewat Chat Bantuan.",
    faq: "Bantuan (FAQ)",
    tech: "Teknologi dan lisensi",
    techItems: ["Peta © kontributor OpenStreetMap (lisensi ODbL)", "Leaflet dan React Leaflet untuk tampilan peta", "OpenRouteService untuk perhitungan jarak", "React, Vite, Tailwind CSS", "Node.js, Express, Prisma, Socket.IO", "MySQL"],
    privacy: "Kebijakan Privasi",
    rights: "Hak cipta dilindungi.",
  },
  en: {
    eyebrow: "Kucur Tourism Village",
    title: "About Kucur Local Market",
    intro: "A marketplace for local products of Kucur Tourism Village: shop from villagers' stores, delivered by village couriers, and run together with the village managers.",
    version: "Version {version} · {released}",
    builtBy: "Developed by",
    builtByNote: "Developed as a Final Project of the TTG program, with Claude Code (Anthropic) as a programming assistant.",
    photoLabel: "Professional photo",
    partners: "Supervisor and partners",
    advisor: "Supervisor",
    village: "Village partner",
    villageValue: "Kucur Tourism Village managers",
    help: "Need help?",
    helpBody: "Ask through Help (FAQ). If it is not answered, contact the village Admin through Support Chat.",
    faq: "Help (FAQ)",
    tech: "Technology and licenses",
    techItems: ["Map © OpenStreetMap contributors (ODbL license)", "Leaflet and React Leaflet for the map view", "OpenRouteService for distance calculation", "React, Vite, Tailwind CSS", "Node.js, Express, Prisma, Socket.IO", "MySQL"],
    privacy: "Privacy Policy",
    rights: "All rights reserved.",
  },
};

const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-[15px] font-bold";
const titleClass = "m-0 flex items-center gap-3 text-lg font-extrabold";

const ICONS = {
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>,
  people: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.4" /><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M15.5 14.4c2.6-.2 5 1.2 5 3.6" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8M12 17h.01" /></>,
  code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5.5l-3 13" /></>,
};
function Chip({ tone, icon }) {
  return <span className={`about-chip about-chip-${tone}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg></span>;
}

// Foto pengembang: taruh berkas di frontend/public/about/developer.webp (atau ubah APP_INFO.photoUrl). Belum ada = pola kosong.
function DeveloperPhoto({ label }) {
  const [failed, setFailed] = useState(false);
  if (!APP_INFO.photoUrl || failed) return <div className="about-photo kucur-placeholder grid size-20 shrink-0 place-items-center text-center text-[11px] font-semibold leading-tight text-[var(--kucur-text-muted)]" role="img" aria-label={label}>{label}</div>;
  return <img className="about-photo size-20 shrink-0 object-cover" src={APP_INFO.photoUrl} alt={APP_INFO.developer.name} onError={() => setFailed(true)} />;
}

export default function About() {
  const { language } = usePreferences();
  const copy = COPY[language] ?? COPY.id;
  return <PageContainer as="main" className="max-w-3xl">
    <article className="about-page grid gap-4">
      <section className="about-glass about-hero">
        <div className="about-hero-inner grid gap-3">
          <span className="about-logo" aria-hidden="true">K</span>
          <PageHeader className="!mb-0" eyebrow={copy.eyebrow} title={copy.title} description={copy.intro} />
          <span className="about-version">{copy.version.replace("{version}", APP_INFO.version).replace("{released}", language === "id" ? APP_INFO.releasedId : APP_INFO.releasedEn)}</span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="about-glass grid min-w-0 content-start gap-4 p-5" aria-labelledby="about-developer">
          <h2 className={titleClass} id="about-developer"><Chip tone="indigo" icon="user" />{copy.builtBy}</h2>
          <div className="flex min-w-0 flex-col items-start gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-4">
            <DeveloperPhoto label={copy.photoLabel} />
            <div className="grid min-w-0 gap-0.5">
              <strong className="text-base">{APP_INFO.developer.name}</strong>
              <span className="text-sm text-[var(--kucur-text-muted)]">{APP_INFO.developer.affiliation}</span>
              <span className="text-sm text-[var(--kucur-text-muted)] [overflow-wrap:anywhere]">{APP_INFO.developer.email}</span>
            </div>
          </div>
          <p className="m-0 text-sm leading-relaxed text-[var(--kucur-text-muted)]">{copy.builtByNote}</p>
        </section>

        <section className="about-glass grid min-w-0 content-start gap-4 p-5" aria-labelledby="about-partners">
          <h2 className={titleClass} id="about-partners"><Chip tone="amber" icon="people" />{copy.partners}</h2>
          <dl className="m-0 grid gap-3 text-[15px]">
            <div><dt className="text-sm text-[var(--kucur-text-muted)]">{copy.advisor}</dt><dd className="m-0 font-semibold">{APP_INFO.advisor}</dd></div>
            <div><dt className="text-sm text-[var(--kucur-text-muted)]">{copy.village}</dt><dd className="m-0 font-semibold">{copy.villageValue}</dd></div>
          </dl>
        </section>
      </div>

      <section className="about-glass grid min-w-0 content-start gap-3 p-5" aria-labelledby="about-help">
        <h2 className={titleClass} id="about-help"><Chip tone="green" icon="help" />{copy.help}</h2>
        <p className="m-0 text-sm leading-relaxed text-[var(--kucur-text-muted)]">{copy.helpBody}</p>
        <div className="flex flex-wrap gap-2">
          <button className={`${buttonClass} about-btn-primary`} type="button" onClick={openFaqBot}>{copy.faq}</button>
        </div>
      </section>

      <details className="about-glass group grid min-w-0 gap-3 p-5">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-lg font-extrabold"><span className="flex items-center gap-3"><Chip tone="teal" icon="code" />{copy.tech}</span><span aria-hidden="true" className="text-[var(--kucur-green-ink)] transition group-open:rotate-180">▾</span></summary>
        <ul className="about-tech">{copy.techItems.map((item) => <li key={item}>{item}</li>)}</ul>
      </details>

      <footer className="flex flex-wrap items-center justify-between gap-2 pr-16 text-[13px] text-[var(--kucur-text-muted)]">
        <Link className="inline-flex min-h-11 items-center font-semibold text-[var(--kucur-green-ink)] underline" to="/privacy">{copy.privacy}</Link>
        <span>© {APP_INFO.year} {APP_INFO.developer.name}. {copy.rights}</span>
      </footer>
    </article>
  </PageContainer>;
}
