import { getAuthToken } from "./authStorage";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
export const apiAssetUrl = (value) => value && String(value).startsWith("/") ? `${API_BASE_URL}${value}` : value || "";
export const AUTH_INVALIDATED_EVENT = "kucur-auth-invalidated";
const DEFAULT_TIMEOUT_MS = 10000;

export class ApiError extends Error {
  constructor({ code = "API_ERROR", message = "Permintaan gagal diproses.", details, status }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export async function apiRequest(path, options = {}) {
  const { token, headers, body, timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...requestOptions } = options;
  const authToken = token ?? getAuthToken();
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = setTimeout(() => controller.abort(new Error("Request timeout")), timeoutMs);
  let response;
  try { response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      signal: controller.signal,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  }); } catch (error) {
    const timedOut = controller.signal.aborted && !signal?.aborted;
    throw new ApiError({
      code: timedOut ? "NETWORK_TIMEOUT" : "NETWORK_ERROR",
      message: timedOut ? "Server terlalu lama merespons. Silakan coba lagi." : "Terjadi gangguan saat menghubungi server.",
      details: { cause: error.message },
    });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiError = new ApiError({ code: payload.code, message: payload.message, details: payload.details, status: response.status });
    if (apiError.code === "UNAUTHENTICATED" && authToken) window.dispatchEvent(new CustomEvent(AUTH_INVALIDATED_EVENT));
    throw apiError;
  }
  return payload;
}

export const apiData = async (path, options) => (await apiRequest(path, options))?.data;
