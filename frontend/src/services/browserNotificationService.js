export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}

export function showBrowserNotification(title, options = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return { shown: false, reason: "In-app notification tetap tersedia." };
  }
  const { link, ...notificationOptions } = options;
  const notification = new Notification(title, notificationOptions);
  if (link) notification.onclick = () => {
    window.focus();
    window.location.assign(link);
    notification.close();
  };
  return { shown: true, notification };
}
