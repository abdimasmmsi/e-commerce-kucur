const variants = {
  primary: "border-[var(--kucur-green)] bg-[var(--kucur-green)] text-[var(--kucur-navy)] hover:border-[var(--kucur-green-hover)] hover:bg-[var(--kucur-green-hover)]",
  secondary: "border-[var(--kucur-border-strong)] bg-kucur-paper text-kucur-ink hover:border-kucur-forest hover:text-kucur-forest",
  outline: "border-[var(--kucur-green)] bg-transparent text-kucur-forest hover:bg-[var(--kucur-green-soft)]",
  danger: "border-kucur-danger bg-kucur-danger text-white hover:brightness-90",
  ghost: "border-transparent bg-transparent text-kucur-ink hover:bg-kucur-sand",
};

export default function Button({ as: Component = "button", variant = "primary", className = "", type, ...props }) {
  return <Component type={Component === "button" ? type ?? "button" : undefined} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-kucur-control border px-4 py-2.5 text-sm font-semibold transition duration-150 disabled:pointer-events-none disabled:opacity-50 ${variants[variant] ?? variants.primary} ${className}`} {...props} />;
}
