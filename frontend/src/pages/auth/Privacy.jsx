import { Link } from "react-router-dom";
import PageContainer from "../../components/ui/PageContainer";
import { usePreferences } from "../../context/PreferencesContext";

// Kebijakan Privasi ringkas untuk pengguna Kucur Local Market (dibaca warga, jadi bahasanya sengaja sederhana).
const COPY = {
  id: {
    title: "Kebijakan Privasi",
    intro: "Kucur Local Market adalah platform jual beli produk lokal Desa Wisata Kucur. Halaman ini menjelaskan data apa yang kami simpan dan untuk apa. Selama masa uji coba, data yang tersimpan hanya dipakai untuk menguji sistem.",
    sections: [
      { heading: "Data yang kami simpan", items: ["Akun: nama, email, nomor telepon, dan kata sandi (disimpan dalam bentuk sandi acak satu arah, bukan teks asli).", "Alamat pengiriman dan titik peta yang kamu isi.", "Pesanan, ulasan, pesan chat, dan notifikasi.", "Foto lapak, foto produk, foto profil, dan foto bukti antar yang diunggah.", "Preferensi bahasa dan tema, serta riwayat pencarian dan produk yang dilihat (untuk rekomendasi, hanya untuk akun yang masuk)."] },
      { heading: "Untuk apa data dipakai", items: ["Memproses pesanan, menghitung ongkir, dan mengatur pengiriman oleh kurir desa.", "Mengelola keuangan lapak oleh pengelola desa.", "Menjaga keamanan sistem dan mencegah penyalahgunaan.", "Kami tidak menjual data kamu dan tidak memakainya untuk iklan."] },
      { heading: "Siapa yang bisa melihat", items: ["Penjual melihat nama, telepon, dan alamat pembeli hanya untuk pesanan di lapaknya.", "Kurir melihat data penerima hanya untuk pesanan dalam jadwalnya.", "Admin (pengelola desa) dapat melihat data akun dan transaksi untuk keperluan pengelolaan.", "Pengunjung hanya melihat produk, lapak, dan ulasan publik."] },
      { heading: "Layanan pihak ketiga", items: ["Peta memakai OpenStreetMap, dan jarak dihitung dengan OpenRouteService. Koordinat lapak dan alamat tujuan dikirim ke layanan itu hanya untuk menghitung jarak.", "Notifikasi push memakai layanan push browser bila kamu mengaktifkannya."] },
      { heading: "Keamanan dan penyimpanan", items: ["Sambungan memakai HTTPS. Akses ke data dibatasi sesuai peran.", "Data transaksi disimpan selama diperlukan untuk pencatatan. Data akun uji coba dihapus setelah masa uji selesai.", "Tidak ada sistem yang sepenuhnya kebal; bila ada kebocoran yang berdampak pada kamu, pengelola akan memberi tahu."] },
      { heading: "Hak kamu", items: ["Melihat dan memperbaiki data akunmu di menu Akun.", "Meminta penghapusan akun dan data pribadi dengan menghubungi admin (kontak ada di menu Akun). Sebagian catatan transaksi dapat tetap disimpan tanpa identitas bila diperlukan untuk pembukuan."] },
    ],
    contactTitle: "Pertanyaan",
    contact: "Hubungi admin pengelola melalui menu Akun atau Chat Bantuan.",
    updated: "Diperbarui: Oktober 2026",
    back: "Kembali",
  },
  en: {
    title: "Privacy Policy",
    intro: "Kucur Local Market is a platform for buying and selling local products of Kucur Tourism Village. This page explains what data we keep and why. During the trial period, stored data is only used to test the system.",
    sections: [
      { heading: "Data we keep", items: ["Account: name, email, phone number, and password (stored as a one-way scramble, not plain text).", "Delivery addresses and the map pin you enter.", "Orders, reviews, chat messages, and notifications.", "Uploaded store photos, product photos, profile photos, and delivery proof photos.", "Language and theme preferences, plus search and viewed-product history (for recommendations, signed-in accounts only)."] },
      { heading: "What the data is used for", items: ["Processing orders, calculating delivery fees, and arranging deliveries by village couriers.", "Managing store finances by the village managers.", "Keeping the system secure and preventing abuse.", "We do not sell your data and do not use it for advertising."] },
      { heading: "Who can see it", items: ["Sellers see a buyer's name, phone, and address only for orders in their store.", "Couriers see recipient details only for orders in their schedule.", "Admins (village managers) can see account and transaction data for management purposes.", "Visitors only see products, stores, and public reviews."] },
      { heading: "Third-party services", items: ["Maps use OpenStreetMap and distances are calculated with OpenRouteService. Store and destination coordinates are sent to that service only to calculate distance.", "Push notifications use your browser's push service if you turn them on."] },
      { heading: "Security and retention", items: ["Connections use HTTPS. Access to data is limited by role.", "Transaction data is kept as long as needed for record keeping. Trial accounts are deleted after the test period ends.", "No system is completely immune; if a breach affects you, the managers will let you know."] },
      { heading: "Your rights", items: ["View and correct your account data in the Account menu.", "Ask for your account and personal data to be deleted by contacting an admin (contact details are in the Account menu). Some transaction records may be kept without your identity if needed for bookkeeping."] },
    ],
    contactTitle: "Questions",
    contact: "Contact the managing admin through the Account menu or Help Chat.",
    updated: "Updated: October 2026",
    back: "Back",
  },
};

function Privacy() {
  const { language } = usePreferences();
  const copy = COPY[language] ?? COPY.id;
  return (
    <PageContainer as="main" className="max-w-3xl">
      <article className="grid gap-6">
        <header className="grid gap-2">
          <h1 className="text-3xl font-extrabold">{copy.title}</h1>
          <p className="text-base leading-relaxed text-[var(--kucur-text-muted)]">{copy.intro}</p>
          <p className="text-sm text-[var(--kucur-text-muted)]">{copy.updated}</p>
        </header>
        {copy.sections.map((section) => (
          <section className="grid gap-2 border-t border-[var(--kucur-border)] pt-4" key={section.heading}>
            <h2 className="text-xl font-extrabold">{section.heading}</h2>
            <ul className="grid list-disc gap-1.5 pl-5 text-base leading-relaxed">{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        ))}
        <section className="grid gap-2 border-t border-[var(--kucur-border)] pt-4">
          <h2 className="text-xl font-extrabold">{copy.contactTitle}</h2>
          <p className="text-base leading-relaxed">{copy.contact}</p>
        </section>
        <Link className="inline-flex min-h-12 w-fit items-center rounded-xl border border-[var(--kucur-border)] px-5 font-bold text-[var(--kucur-green-ink)]" to="/">{copy.back}</Link>
      </article>
    </PageContainer>
  );
}

export default Privacy;
