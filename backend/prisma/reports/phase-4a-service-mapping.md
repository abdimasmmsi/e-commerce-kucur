# Phase 4A service mapping

Canonical application persistence remains `prismaRepository` (legacy). `finalPrismaRepository` is isolated, and `dualReadRepository` returns the legacy result.

| Service | Classification | Final target mapping |
|---|---|---|
| authService | ADAPTER REQUIRED | User.isActive, direct UserRole enum, Session |
| userService | ADAPTER REQUIRED | User preferences and password fields |
| storeService | ADAPTER REQUIRED | Store status combines legacy approval and operational status; StoreStatusHistory stays archived |
| productService | ADAPTER REQUIRED | Product images/options JSON and ProductVariant selectedOptions |
| cartService | UNCHANGED contract | Cart and CartItem |
| commerceService | INTERNAL REWRITE | CheckoutTransaction collapses into CommerceOrder checkoutGroupId/idempotency; reservation lifecycle moves into CommerceOrderItem |
| settingsService | ADAPTER REQUIRED | E-Commerce-only PlatformSettings and TIME aliases |
| financeService | INTERNAL REWRITE | PlatformTransaction, installments, penalties, obligations, contributions consolidate into MerchantFee; settlements become MerchantFee payment attempts and grouped service results |
| deliveryService | INTERNAL REWRITE | Availability/history and pickup/proof/activity consolidate into CourierProfile and DeliveryBatchOrder JSON/scalars |
| reviewService | ADAPTER REQUIRED | Product Review only; photos/reply/moderation inline |
| chatService | ADAPTER REQUIRED | Direct requester/counterpart/context and Message.readAt |
| notificationService | UNCHANGED contract | Notification; AdminFee entity navigation maps to MerchantFee |
| tourismService | RETIRED OUTSIDE FINAL SCOPE | No final 20-table target |
| liveInService | RETIRED OUTSIDE FINAL SCOPE | No final 20-table target |

## Temporary validation architecture

- `FINAL_REPOSITORY_DUAL_READ=true` enables shadow reads only outside production.
- Legacy reads execute first and remain the response.
- Final reads are normalized and compared.
- Shadow writes are never invoked by the wrapper.
- Dedicated final writes run only in rollback-only integration tests.

## Expected normalizations

- Six CommerceOrder checkout idempotency collision mappings.
- One Store approval/status consolidation for the rejected E2E fixture.
- Three Notification AdminFee entity-type mappings to MerchantFee.
- Migration-only activity entries and archived Tourism/Live In rows are excluded.

## Deferred cutover work

- Replace legacy finance service primitives that expose PlatformTransaction/Settlement physical shapes with MerchantFee-native internal operations.
- Complete service-level target write tests for initial-fee setup, admin-fee settlement, and contribution confirmation.
- Run authenticated browser E2E against a disposable database containing both seeded legacy and freshly backfilled target datasets.
- Do not switch canonical reads or writes until these gates pass.
