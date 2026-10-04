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
    return <span className={`${className} product-image-fallback grid h-full w-full place-items-center ${style.tint}`} role="img" aria-label={alt || product?.name || "Produk Kucur"}>
      <svg className="size-[30%] max-h-16 max-w-16 text-[var(--kucur-text)] opacity-55" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={style.path} /></svg>
    </span>;
  }
  return <img className={className} src={source} alt={alt} onError={() => setSource("")} />;
}

export default ProductImage;
