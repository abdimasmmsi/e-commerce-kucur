export const OPERATIONAL_SETTINGS_STORAGE_KEY = "kucur_operational_settings";
export const OPERATIONAL_SETTINGS_UPDATED_EVENT = "kucur-operational-settings-updated";

export const defaultOperationalSettings = {
  deliveryRatePerKm: 3500,
  maximumActiveDeliveries: 3,
  pickupTimeoutHours: 2,
  assignmentResponseMinutes: 15,
  assignmentCycleCooldownMinutes: 60,
  tourismApprovalTimeoutHours: 6,
  deliveryOrderCutoffTime: "16:00",
  deliveryDispatchTime: "17:00",
  maxDailyDeliveries: 30,
};

const normalizePositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeNonNegativeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

let canonicalSettingsCache = { ...defaultOperationalSettings };

export function getOperationalSettings() {
    const storedSettings = canonicalSettingsCache;
    return {
      deliveryRatePerKm: normalizeNonNegativeNumber(
        storedSettings.deliveryRatePerKm,
        defaultOperationalSettings.deliveryRatePerKm,
      ),
      maximumActiveDeliveries: normalizePositiveNumber(
        storedSettings.maximumActiveDeliveries,
        defaultOperationalSettings.maximumActiveDeliveries,
      ),
      pickupTimeoutHours: normalizePositiveNumber(
        storedSettings.pickupTimeoutHours,
        defaultOperationalSettings.pickupTimeoutHours,
      ),
      assignmentResponseMinutes: normalizePositiveNumber(
        storedSettings.assignmentResponseMinutes,
        defaultOperationalSettings.assignmentResponseMinutes,
      ),
      assignmentCycleCooldownMinutes: normalizePositiveNumber(
        storedSettings.assignmentCycleCooldownMinutes,
        defaultOperationalSettings.assignmentCycleCooldownMinutes,
      ),
      tourismApprovalTimeoutHours: normalizePositiveNumber(storedSettings.tourismApprovalTimeoutHours, defaultOperationalSettings.tourismApprovalTimeoutHours),
      deliveryOrderCutoffTime: /^\d{2}:\d{2}$/.test(storedSettings.deliveryOrderCutoffTime) ? storedSettings.deliveryOrderCutoffTime : defaultOperationalSettings.deliveryOrderCutoffTime,
      deliveryDispatchTime: /^\d{2}:\d{2}$/.test(storedSettings.deliveryDispatchTime) ? storedSettings.deliveryDispatchTime : defaultOperationalSettings.deliveryDispatchTime,
      maxDailyDeliveries: normalizePositiveNumber(storedSettings.maxDailyDeliveries, defaultOperationalSettings.maxDailyDeliveries),
    };
}

export function acceptOperationalSettings(settings) {
  const normalizedSettings = {
    deliveryRatePerKm: Math.max(0, Number(settings.deliveryRatePerKm)),
    maximumActiveDeliveries: Number(settings.maximumActiveDeliveries),
    pickupTimeoutHours: Number(settings.pickupTimeoutHours),
    assignmentResponseMinutes: Number(settings.assignmentResponseMinutes),
    assignmentCycleCooldownMinutes: Number(settings.assignmentCycleCooldownMinutes),
    tourismApprovalTimeoutHours: Number(settings.tourismApprovalTimeoutHours),
    deliveryOrderCutoffTime: settings.deliveryOrderCutoffTime,
    deliveryDispatchTime: settings.deliveryDispatchTime,
    maxDailyDeliveries: Math.floor(Number(settings.maxDailyDeliveries)),
  };
  canonicalSettingsCache = normalizedSettings;
  window.dispatchEvent(new CustomEvent(OPERATIONAL_SETTINGS_UPDATED_EVENT, {
    detail: normalizedSettings,
  }));
  return normalizedSettings;
}

export const saveOperationalSettings = acceptOperationalSettings;
