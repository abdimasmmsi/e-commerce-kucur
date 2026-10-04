import { useEffect, useState } from "react";
import { getPrimaryProductImage, getProductImage } from "../services/productImageStorage";

function ProductImage({ product, image: suppliedImage, alt = "", className = "" }) {
  const image = suppliedImage ?? getPrimaryProductImage(product);
  const [source, setSource] = useState(image?.url ?? "");

  useEffect(() => {
    let objectUrl = "";
    let active = true;
    if (image?.storageKey) {
      getProductImage(image.storageKey).then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      }).catch(() => setSource(""));
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image?.storageKey, image?.url]);

  if (!source) return <span
    className={`${className} product-image-fallback relative isolate grid h-full w-full place-items-center overflow-hidden p-5 text-center`}
    style={{ background: "linear-gradient(145deg, var(--kucur-sand), color-mix(in srgb, var(--kucur-green) 13%, var(--kucur-surface)))" }}
    role="img"
    aria-label={alt || product?.name || "Produk Kucur"}
  >
    <span className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full border-[18px] border-white/30" aria-hidden="true" />
    <span className="relative grid justify-items-center gap-3">
      <span className="grid size-14 place-items-center rounded-2xl bg-[var(--kucur-surface)]/80 text-kucur-forest shadow-sm" aria-hidden="true">
        <svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M6 8.5h12l-1 10.5H7L6 8.5ZM9 9V7a3 3 0 0 1 6 0v2M9.5 13h5" /></svg>
      </span>
      <strong className="line-clamp-2 max-w-44 text-sm font-extrabold leading-5 text-kucur-forest">{product?.category || "Produk Lokal Kucur"}</strong>
    </span>
  </span>;
  return <img className={className} src={source} alt={alt} onError={() => setSource("")} />;
}

export default ProductImage;
