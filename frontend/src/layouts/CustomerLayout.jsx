import { useLayoutEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import CustomerBottomNav from "../components/CustomerBottomNav";
import { useAuth } from "../context/AuthContext";

const authenticationPaths = new Set(["/login", "/register", "/unauthorized"]);

function CustomerLayout() {
  const location = useLocation();
  const { activeRole, isAuthenticated, switchRole, user } = useAuth();

  useLayoutEffect(() => {
    if (
      !authenticationPaths.has(location.pathname)
      && isAuthenticated
      && activeRole !== "customer"
      && user?.roles.includes("customer")
    ) {
      switchRole("customer");
    }
  }, [activeRole, isAuthenticated, location.pathname, switchRole, user]);

  return (
    <div className="min-h-dvh min-w-0 bg-[var(--kucur-bg)] text-[var(--kucur-text)]">
      <a className="sr-only z-[100] rounded-lg bg-kucur-forest px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3" href="#customer-content">Lewati ke konten</a>
      <AppHeader />
      <main className="min-h-[calc(100dvh-64px)] min-w-0 bg-[var(--kucur-bg)] pb-[calc(70px+env(safe-area-inset-bottom))] md:pb-0" id="customer-content"><Outlet /></main>
      <CustomerBottomNav />
    </div>
  );
}

export default CustomerLayout;
