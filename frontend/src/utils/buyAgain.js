import { cartService } from "../services/commerceService";

// "Beli lagi": masukkan lagi isi pesanan lama ke keranjang. Barang yang sudah tidak dijual/stok habis dilewati.
// Jumlah dibatasi stok yang tersedia oleh backend; kalau ditolak, coba 1 buah dulu sebelum dilewati.
export async function buyAgain(order) {
  let added = 0;
  let skipped = 0;
  for (const item of order?.items ?? []) {
    const input = { productId: item.productId, productVariantId: item.productVariantId ?? item.variantId ?? undefined };
    try { await cartService.add({ ...input, quantity: Math.max(1, Number(item.quantity) || 1) }); added += 1; }
    catch {
      try { await cartService.add({ ...input, quantity: 1 }); added += 1; }
      catch { skipped += 1; }
    }
  }
  return { added, skipped };
}
