import { apiData } from "./apiClient";

const query = (values = {}) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== "") params.set(key, value); });
  const text = params.toString();
  return text ? `?${text}` : "";
};

export const tourismApi = {
  listPackages: (filters) => apiData(`/api/tourism/packages${query(filters)}`),
  getPackage: (id) => apiData(`/api/tourism/packages/${encodeURIComponent(id)}`),
  createPackage: (input) => apiData("/api/tourism/packages", { method: "POST", body: input }),
  updatePackage: (id, input) => apiData(`/api/tourism/packages/${encodeURIComponent(id)}`, { method: "PATCH", body: input }),
  createSchedule: (packageId, input) => apiData(`/api/tourism/packages/${encodeURIComponent(packageId)}/schedules`, { method: "POST", body: input }),
  updateSchedule: (id, input) => apiData(`/api/tourism/schedules/${encodeURIComponent(id)}`, { method: "PATCH", body: input }),
  createBooking: (input) => apiData("/api/tourism/bookings", { method: "POST", body: input }),
  listBookings: (filters) => apiData(`/api/tourism/bookings${query(filters)}`),
  getBooking: (id) => apiData(`/api/tourism/bookings/${encodeURIComponent(id)}`),
  transitionBooking: (id, status, reason) => apiData(`/api/tourism/bookings/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status, reason } }),
  createGroupRequest: (input) => apiData("/api/tourism/group-requests", { method: "POST", body: input }),
  listGroupRequests: (filters) => apiData(`/api/tourism/group-requests${query(filters)}`),
  createGroupOffer: (id, input) => apiData(`/api/tourism/group-requests/${encodeURIComponent(id)}/offers`, { method: "POST", body: input }),
  rejectGroupRequest: (id, reason) => apiData(`/api/tourism/group-requests/${encodeURIComponent(id)}/reject`, { method: "POST", body: { reason } }),
  acceptGroupOffer: (id) => apiData(`/api/tourism/group-offers/${encodeURIComponent(id)}/accept`, { method: "POST" }),
};
