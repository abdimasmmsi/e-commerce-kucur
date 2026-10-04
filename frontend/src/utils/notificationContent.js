export const localizeNotificationContent = (notification, t) => {
  const root = `notificationContent.${notification.type}`;
  const titleKey = `${root}.title`;
  const title = t(titleKey);
  if (title === titleKey) return { title: notification.title, message: notification.message };

  const reference = `${notification.title ?? ""} ${notification.message ?? ""}`.match(/\bKUC-[A-Z0-9]+\b/i)?.[0];
  const bodyKey = `${root}.${reference ? "bodyWithReference" : "body"}`;
  const body = t(bodyKey, { reference });
  return {
    title,
    message: body === bodyKey ? t(`${root}.body`) : body,
  };
};
