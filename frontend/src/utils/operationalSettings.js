export const defaultOperationalSettings = {
  deliveryBaseFee: 6000,
  deliveryRatePerKm: 1500,
  maximumActiveDeliveries: 3,
  pickupTimeoutHours: 2,
  assignmentResponseMinutes: 15,
  assignmentCycleCooldownMinutes: 60,
  deliveryOrderCutoffTime: "16:00",
  deliveryDispatchTime: "17:00",
  maxDailyDeliveries: 30,
};

let canonicalSettingsCache = { ...defaultOperationalSettings };

export function acceptOperationalSettings(settings) {
  canonicalSettingsCache = { ...defaultOperationalSettings, ...settings };
  return canonicalSettingsCache;
}

export function getOperationalSettings() {
  return { ...canonicalSettingsCache };
}
