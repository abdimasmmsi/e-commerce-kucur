import { createNotification } from "../services/notificationService";

const MERCHANT_APPLICATIONS_KEY = "kucur_merchant_applications";

export const merchantBusinessTypes = [
  "Local Product / E-Commerce",
  "Educational Tourism",
  "Live In",
];

export const mockMerchantApplications = [
  {
    id: "MAP-MOCK-002",
    userId: "USR-CUSTOMER-002",
    applicantName: "Customer Dua Kucur",
    phone: "0812-1000-0005",
    businessName: "Kebun Belajar Customer Dua",
    address: "Dusun Kucur Tengah, Desa Kucur, Malang",
    contactPerson: "Customer Dua Kucur",
    businessTypes: ["Educational Tourism", "Local Product / E-Commerce"],
    description: "Wisata belajar kebun dan penjualan hasil kebun lokal untuk pengujian approval atau rejection admin.",
    status: "pending",
    rejectionReason: null,
    createdAt: "2026-08-20T09:00:00+07:00",
    reviewedAt: null,
    reviewedBy: null,
  },
];

const isApplicationList = (value) => Array.isArray(value);

export function getMerchantApplications() {
  try {
    const stored = JSON.parse(localStorage.getItem(MERCHANT_APPLICATIONS_KEY));
    if (isApplicationList(stored)) {
      const storedIds = new Set(stored.map((application) => application.id));
      const missingMockApplications = mockMerchantApplications.filter(
        (application) => !storedIds.has(application.id),
      );
      if (missingMockApplications.length === 0) return stored;
      const mergedApplications = [...missingMockApplications, ...stored];
      localStorage.setItem(MERCHANT_APPLICATIONS_KEY, JSON.stringify(mergedApplications));
      return mergedApplications;
    }
  } catch {
    // Fall back to the mock seed when local data is invalid.
  }

  localStorage.setItem(MERCHANT_APPLICATIONS_KEY, JSON.stringify(mockMerchantApplications));
  return [...mockMerchantApplications];
}

export function saveMerchantApplications(applications) {
  localStorage.setItem(MERCHANT_APPLICATIONS_KEY, JSON.stringify(applications));
  return applications;
}

export function addMerchantApplication(application) {
  const applications = getMerchantApplications();
  const nextApplications = [application, ...applications];
  saveMerchantApplications(nextApplications);
  createNotification({ recipientRole: "admin", type: "system", title: "Pengajuan merchant baru", message: `${application.applicantName} mengajukan ${application.businessName}.`, link: "/admin/merchant-applications" });
  return nextApplications;
}

export function updateMerchantApplication(applicationId, changes) {
  const applications = getMerchantApplications();
  const previous = applications.find((application) => application.id === applicationId);
  const nextApplications = applications.map((application) => (
    application.id === applicationId ? { ...application, ...changes } : application
  ));
  saveMerchantApplications(nextApplications);
  if (previous && changes.status && changes.status !== previous.status) createNotification({
    recipientUserId: previous.userId,
    recipientRole: "customer",
    type: "system",
    title: `Pengajuan merchant ${changes.status === "approved" ? "disetujui" : "diperbarui"}`,
    message: changes.status === "rejected" ? `Pengajuan ${previous.businessName} ditolak. Lihat alasan dan ajukan kembali bila diperlukan.` : `Status pengajuan ${previous.businessName}: ${changes.status}.`,
    link: "/merchant/apply",
  });
  return nextApplications;
}
