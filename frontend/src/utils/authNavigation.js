export const roleHomePaths = {
  customer: "/",
  merchant: "/merchant",
  courier: "/courier",
  admin: "/admin",
};

export const roleLabels = {
  customer: "Pembeli",
  merchant: "Penjual",
  courier: "Kurir",
  admin: "Admin",
};

export function getAuthenticatedHome(activeRole, roles = []) {
  const fallbackRole = roles.includes("customer") ? "customer" : roles[0];
  return roleHomePaths[roles.includes(activeRole) ? activeRole : fallbackRole] ?? "/";
}

export function getRequiredRoleForPath(pathname = "") {
  const path = typeof pathname === "string" ? pathname : "";
  if (path === "/merchant" || path.startsWith("/merchant/")) return "merchant";
  if (path === "/courier" || path.startsWith("/courier/")) return "courier";
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if (/^\/(cart|checkout|orders|my-reviews|notifications)(\/|$)/.test(path)) return "customer";
  return null;
}
