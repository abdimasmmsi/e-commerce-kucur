// Isi notifikasi dari server sudah berbahasa Indonesia dan spesifik (nama lapak, alasan, kode pesanan),
// jadi bahasa Indonesia memakai teks server. Bahasa Inggris memakai terjemahan per tipe (dan per status pesanan).
export const localizeNotificationContent = (notification, t, language = "id") => {
  // Status pesanan memakai teks per tahap di kedua bahasa (notifikasi lama dari server berisi kode status mentah).
  const status = notification.metadata?.status;
  const statusRoot = notification.type === "COMMERCE_ORDER_STATUS_CHANGED" && status && t(`notificationContent.orderStatus.${status}.title`) !== `notificationContent.orderStatus.${status}.title`
    ? `notificationContent.orderStatus.${status}` : null;
  if (language === "id" && !statusRoot) return { title: notification.title, message: notification.message ?? notification.body };

  const root = statusRoot ?? `notificationContent.${notification.type}`;
  const titleKey = `${root}.title`;
  const title = t(titleKey);
  if (title === titleKey) return { title: notification.title, message: notification.message ?? notification.body };

  const reference = `${notification.title ?? ""} ${notification.message ?? notification.body ?? ""}`.match(/\bKUC-[A-Z0-9]+\b/i)?.[0];
  const bodyKey = `${root}.${reference ? "bodyWithReference" : "body"}`;
  const body = t(bodyKey, { reference });
  return {
    title,
    message: body === bodyKey ? t(`${root}.body`) : body,
  };
};
