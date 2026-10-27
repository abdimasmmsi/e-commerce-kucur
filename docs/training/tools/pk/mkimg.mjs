import { openBrowser } from "./lib.mjs";
const b = await openBrowser(); const p = await b.newPage({ viewport: { width: 1200, height: 1200 } });
const html = (bg, txt) => `<body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><rect width="1200" height="1200" fill="${bg}"/><circle cx="600" cy="560" r="330" fill="#c98a3b"/><circle cx="600" cy="560" r="250" fill="#e8b45f"/><text x="600" y="1000" font-size="90" text-anchor="middle" fill="#5a3a12" font-family="Arial">${txt}</text></svg></body>`;
await p.setContent(html("#e9d8b4", "Foto contoh produk")); await p.screenshot({ path: "D:/kucur-platform/docs/training/tools/pk/foto-contoh.png" });
await p.setContent(html("#d8e6d0", "Bukti antar contoh")); await p.screenshot({ path: "D:/kucur-platform/docs/training/tools/pk/bukti-contoh.jpg", type: "jpeg" });
await b.close(); console.log("ok");
