// Notifikasi push ke HP/browser (Web Push + VAPID). Kunci di .env: WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, WEB_PUSH_SUBJECT.
// Tanpa kunci, push dilewati diam-diam (notifikasi di aplikasi tetap jalan).
let webPush = null;
const configured = () => Boolean(process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY);
function client() {
  if (!configured()) return null;
  if (!webPush) {
    webPush = require("web-push");
    webPush.setVapidDetails(process.env.WEB_PUSH_SUBJECT || "mailto:admin@kucur.test", process.env.WEB_PUSH_PUBLIC_KEY, process.env.WEB_PUSH_PRIVATE_KEY);
  }
  return webPush;
}

const publicKey = () => process.env.WEB_PUSH_PUBLIC_KEY || null;

// Kirim ke semua perangkat pengguna; langganan yang sudah kedaluwarsa (404/410) dibuang.
async function sendToUser(repository, userId, payload) {
  const push = client();
  if (!push || !userId) return { sent: 0 };
  try {
    const user = await repository.users.findById(userId);
    const subscriptions = Array.isArray(user?.pushSubscriptions) ? user.pushSubscriptions : [];
    if (!subscriptions.length) return { sent: 0 };
    const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || "/", tag: payload.tag || undefined });
    const expired = new Set(); let sent = 0;
    await Promise.all(subscriptions.map(async (subscription) => {
      try { await push.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, body, { TTL: 3600 }); sent += 1; }
      catch (error) { if ([404, 410].includes(error?.statusCode)) expired.add(subscription.endpoint); }
    }));
    if (expired.size) await repository.users.update(userId, { pushSubscriptions: subscriptions.filter((item) => !expired.has(item.endpoint)) });
    return { sent };
  } catch (error) {
    console.warn(`[push] ${error.message}`);
    return { sent: 0 };
  }
}

module.exports = { publicKey, sendToUser, configured };
