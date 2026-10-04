const variants = {
  primary: "border-[var(--kucur-green)] bg-[var(--kucur-green)] text-[var(--kucur-forest-dark)] hover:border-[var(--kucur-green-hover)] hover:bg-[var(--kucur-green-hover)]",
  secondary: "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] text-[var(--kucur-text)] hover:border-[var(--kucur-green)] hover:bg-[var(--kucur-green-soft)]",
  outline: "border-[var(--kucur-green)] bg-transparent text-[var(--kucur-green-ink)] hover:bg-[var(--kucur-green-soft)]",
  danger: "border-kucur-danger bg-kucur-danger text-white hover:brightness-90",
  ghost: "border-transparent bg-transparent text-[var(--kucur-text)] hover:bg-[var(--kucur-green-soft)]",
};

export default function Button({ as: Component = "button", variant = "primary", className = "", type, ...props }) {
  return <Component type={Component === "button" ? type ?? "button" : undefined} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-[15px] font-bold transition sm:min-h-11 duration-150 disabled:pointer-events-none disabled:opacity-50 ${variants[variant] ?? variants.primary} ${className}`} {...props} />;
}
