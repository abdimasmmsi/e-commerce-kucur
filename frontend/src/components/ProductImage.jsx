import { useEffect, useState } from "react";
import { getPrimaryProductImage, getProductImage } from "../services/productImageStorage";
import { categoryStyle } from "../utils/productCategory";

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

  if (!source) {
    const style = categoryStyle(product?.category);
    // Tanpa foto: pola garis tipis + ikon kategori kecil (bukan blok warna pastel besar).
    // Ukuran dari pemanggil (mis. thumbnail w-12) dipakai apa adanya; kalau tidak ada, isi penuh wadahnya.
    const sized = /(^|\s)(w|size|h)-/.test(className);
    return <span className={`${className} product-image-fallback kucur-placeholder grid shrink-0 place-items-center overflow-hidden ${sized ? "" : "h-full w-full"}`} role="img" aria-label={alt || product?.name || "Produk Kucur"}>
      <svg className="size-[22%] min-h-5 min-w-5 max-h-11 max-w-11 text-[var(--kucur-text-muted)] opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={style.path} /></svg>
    </span>;
  }
  return <img className={className} src={source} alt={alt} onError={() => setSource("")} />;
}

export default ProductImage;
