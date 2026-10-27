import { useState } from "react";
import { Link } from "react-router-dom";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import { usePreferences } from "../../context/PreferencesContext";
import { openFaqBot } from "../../utils/faqMatcher.js";
import { APP_INFO } from "../../config/appInfo";

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

const cardClass = "grid min-w-0 content-start gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-5";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-[15px] font-bold";

// Foto pengembang: taruh berkas di frontend/public/about/developer.webp (atau ubah APP_INFO.photoUrl). Belum ada = pola kosong.
function DeveloperPhoto({ label }) {
  const [failed, setFailed] = useState(false);
  if (!APP_INFO.photoUrl || failed) return <div className="kucur-placeholder grid size-20 shrink-0 place-items-center rounded-2xl text-center text-[11px] font-semibold leading-tight text-[var(--kucur-text-muted)]" role="img" aria-label={label}>{label}</div>;
  return <img className="size-20 shrink-0 rounded-2xl object-cover" src={APP_INFO.photoUrl} alt={APP_INFO.developer.name} onError={() => setFailed(true)} />;
}

export default function About() {
  const { language } = usePreferences();
  const copy = COPY[language] ?? COPY.id;
  return <PageContainer as="main" className="max-w-3xl">
    <article className="grid gap-5">
      <div className="grid gap-1">
        <PageHeader className="!mb-0" eyebrow={copy.eyebrow} title={copy.title} description={copy.intro} />
        <p className="text-[13px] text-[var(--kucur-text-muted)]">{copy.version.replace("{version}", APP_INFO.version).replace("{released}", language === "id" ? APP_INFO.releasedId : APP_INFO.releasedEn)}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={cardClass} aria-labelledby="about-developer">
          <h2 className="text-lg font-extrabold" id="about-developer">{copy.builtBy}</h2>
          <div className="flex min-w-0 flex-col items-start gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-4">
            <DeveloperPhoto label={copy.photoLabel} />
            <div className="grid min-w-0 gap-0.5">
              <strong className="text-base">{APP_INFO.developer.name}</strong>
              <span className="text-sm text-[var(--kucur-text-muted)]">{APP_INFO.developer.affiliation}</span>            </div>
          </div>
          <p className="text-sm leading-relaxed text-[var(--kucur-text-muted)]">{copy.builtByNote}</p>
        </section>

        <section className={cardClass} aria-labelledby="about-partners">
          <h2 className="text-lg font-extrabold" id="about-partners">{copy.partners}</h2>
          <dl className="m-0 grid gap-2 text-[15px]">
            <div><dt className="text-sm text-[var(--kucur-text-muted)]">{copy.advisor}</dt><dd className="m-0 font-semibold">{APP_INFO.advisor}</dd></div>
            <div><dt className="text-sm text-[var(--kucur-text-muted)]">{copy.village}</dt><dd className="m-0 font-semibold">{copy.villageValue}</dd></div>
          </dl>
        </section>
      </div>

      <section className={cardClass} aria-labelledby="about-help">
        <h2 className="text-lg font-extrabold" id="about-help">{copy.help}</h2>
        <p className="text-sm leading-relaxed text-[var(--kucur-text-muted)]">{copy.helpBody}</p>
        <div className="flex flex-wrap gap-2">
          <button className={`${buttonClass} border-[var(--kucur-green)] text-[var(--kucur-green-ink)]`} type="button" onClick={openFaqBot}>{copy.faq}</button>        </div>
      </section>

      <details className={`${cardClass} group`}>
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-lg font-extrabold">{copy.tech}<span aria-hidden="true" className="text-[var(--kucur-green-ink)] transition group-open:rotate-180">▾</span></summary>
        <ul className="m-0 grid list-disc gap-1.5 pl-5 text-sm leading-relaxed text-[var(--kucur-text-muted)]">{copy.techItems.map((item) => <li key={item}>{item}</li>)}</ul>
      </details>

      <footer className="flex flex-wrap items-center justify-between gap-2 pr-16 text-[13px] text-[var(--kucur-text-muted)]">
        <Link className="inline-flex min-h-11 items-center font-semibold text-[var(--kucur-green-ink)] underline" to="/privacy">{copy.privacy}</Link>
        <span>© {APP_INFO.year} {APP_INFO.developer.name}. {copy.rights}</span>
      </footer>
    </article>
  </PageContainer>;
}
