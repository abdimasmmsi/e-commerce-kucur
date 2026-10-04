import { Navigate } from "react-router-dom";

// Compatibility alias until the legacy route is removed from App.jsx.
export default function Analytics() {
  return <Navigate to="/admin/transactions" replace />;
}
