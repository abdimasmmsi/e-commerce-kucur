import { openBrowser, newCtx, go, settle, shot, audit } from "./lib.mjs";
const b = await openBrowser();
const ctx = {}; for (const vk of ["m", "d"]) ctx[vk] = await newCtx(b, vk, "courier@kucur.test");
async function both(name, route, prep) { for (const vk of ["m", "d"]) { const p = ctx[vk].page; if (route) await go(p, route); if (prep) await prep(p, vk); await settle(p, 500); await shot(p, "kurir", name, vk); await audit(p, `${name}-${vk}`); const e = p.errors.splice(0); if (e.length) console.log("  errors", name, vk, e); } }
await both("beranda", "/courier");
await both("penugasan", "/courier/assignments");
await both("jadwal", "/courier/batches");
await both("detail-jadwal-planned", "/courier/batches/62dc5508-3fe8-4a53-8cfe-45dca435cd7a");
await both("detail-jadwal-berjalan", "/courier/batches/ed0d7aa0-49ac-4cb6-bc09-99e92c4ad2e1");
await both("pengantaran-aktif", "/courier/active-deliveries");
await both("riwayat", "/courier/history");
await both("cuti", "/courier/availability");
await both("pengaturan", "/courier/settings");
await both("profil", "/profile");
await b.close();
