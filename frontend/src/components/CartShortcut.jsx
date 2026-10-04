import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CART_CHANGED_EVENT, cartService } from "../services/commerceService";

function CartShortcut({ className = "", label = "Keranjang", showLabel = false, onClick }) {
  const { activeRole, user } = useAuth();
  const [totalQuantity, setTotalQuantity] = useState(0);
  useEffect(() => {
    let active = true;
    const applyCart = (cart) => { if (active) setTotalQuantity((cart?.items ?? []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)); };
    const refresh = (event) => event.detail?.cart ? applyCart(event.detail.cart) : cartService.get().then(applyCart).catch(() => applyCart(null));
    if (user?.id && activeRole === "customer") {
      refresh({ detail: null });
      window.addEventListener(CART_CHANGED_EVENT, refresh);
    } else applyCart(null);
    return () => { active = false; window.removeEventListener(CART_CHANGED_EVENT, refresh); };
  }, [activeRole, user?.id]);

  return (
    <Link
      className={`relative inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] px-2.5 text-[var(--kucur-text)] transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 ${className}`}
      to="/cart"
      onClick={onClick}
      aria-label={`${label}${totalQuantity ? `, ${totalQuantity} item` : ", kosong"}`}
    >
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 4.5h2l1.8 9.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4l1.5-5.3H6.3M9.5 19.2h.01M17.5 19.2h.01" />
      </svg>
      {showLabel && <span className="hidden text-sm font-semibold min-[390px]:inline">{label}</span>}
      {totalQuantity > 0 && (
        <strong className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-white">
          {totalQuantity > 99 ? "99+" : totalQuantity}
        </strong>
      )}
    </Link>
  );
}

export default CartShortcut;
