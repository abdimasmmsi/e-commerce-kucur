# Incremental frontend migration

1. Keep pages consuming their existing domain service modules.
2. Add an API-backed implementation behind one service at a time; do not access the database or raw `fetch` from page components.
3. During a domain cutover, read legacy local data once, validate it against the backend contract, upload through authenticated APIs, and record a versioned migration marker for that domain only.
4. Compare record counts and key totals before switching reads to the API.
5. Keep a rollback window in which the local data remains untouched. Never call `localStorage.clear()`.
6. Remove a domain key only after server persistence, authorization tests, reconciliation, and user acceptance are complete.

Shared auth, Store, and settings endpoints are foundation APIs. Existing frontend authentication and business modules have deliberately not been switched to them in this change.

## Commerce transactional cutover registry

MySQL is authoritative for Product and SKU stock. Frontend compatibility code must never decrement or restore inventory in `kucur_merchant_products`.

| Browser key | Classification after commerce cutover | Remaining consumer / removal condition |
| --- | --- | --- |
| `kucur_customer_carts` | REMOVED from authoritative flow | Retain existing browser value untouched during the rollback window; remove the legacy module after all cart consumers use `/api/cart`. |
| `kucur_merchant_orders` | COMPATIBILITY ONLY | Courier delivery, delivery batches, reviews, notifications, and legacy metrics may still read historical prototype orders. It must not receive canonical checkout/order writes. |
| `kucur_merchant_products` | COMPATIBILITY ONLY | Historical prototype lookup only. No checkout, cancellation, or payment helper may write stock to this key. Remove after Review/Delivery compatibility no longer imports `mockProducts`. |
| `kucur_delivery_batches` | DEPRECATED / READ-FREE | Daily DeliveryBatch and DeliveryBatchOrder are canonical in MySQL. Production Delivery UI does not read this key. |
| `kucur_courier_assignment_state` | DEPRECATED / READ-FREE | Round-robin assignment runtime was replaced by explicit daily batches. Only the development-only legacy lab retains fixture code. |
| `kucur_reviews` | DEPRECATED / READ-FREE | Review persistence is canonical in MySQL. Active Review UI and writes must use the Review API; this key is not a source of truth. |
| `kucur_notifications` | DEPRECATED / READ-FREE | Notification persistence, unread state, and active UI are canonical in MySQL. Legacy prototype producers no longer write this key. |
| `kucur_chat_conversations` | DEPRECATED / READ-FREE | Conversation, participants, explicit context, messages, and per-user reads are canonical in MySQL. Active Chat UI uses authenticated APIs. |
| `kucur_operational_settings` | REMOVED from authoritative checkout calculation | Checkout must use MySQL Platform Settings through the backend. Legacy delivery-only consumers remain compatibility debt. |

No current frontend payment registry key exists: the previous Midtrans module stored payment fields inside `kucur_merchant_orders`. Canonical Payment and PaymentAttempt state now belongs in MySQL. Checkout selections and idempotency keys must remain request/UI state, not authoritative browser persistence.

Never clear these keys automatically. Their removal is a separate, versioned cleanup after the named compatibility consumers migrate and reconciliation is accepted.
