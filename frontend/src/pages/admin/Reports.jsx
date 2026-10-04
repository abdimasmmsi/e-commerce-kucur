import { Navigate } from "react-router-dom";

// Compatibility alias until the legacy route is removed from App.jsx.
export default function Reports() {
  return <Navigate to="/admin" replace />;
}
