# E-Commerce Feature Audit

Audit date: 2026-08-27. Active product scope is E-Commerce plus shared Auth, Store, Payment, Transaction, Delivery, Review, Notification, Chat, Finance, and Audit modules. Tourism and Live In routes remain for compatibility but are no longer promoted in active Customer navigation.

Classification: WORKING = canonical flow and automated evidence exist; PARTIAL = canonical core exists but UX/manual coverage is incomplete; BROKEN = active path does not perform its promised action; LEGACY/MOCK = local prototype path; UNUSED = retained but not linked from the active experience.

| Area | Feature | Status | Evidence / gap |
| --- | --- | --- | --- |
| Auth | Register, login, logout, session persistence | WORKING | MySQL integration coverage and authenticated routes |
| Auth | Multi-role switching and unauthorized access | WORKING | role snapshot unit coverage and ProtectedRoute |
| Customer | Home and product discovery | WORKING | canonical `/api/products`; non-Commerce promotions removed |
| Customer | Search, category, Store, price, sort filters | WORKING | client filtering over canonical catalog response |
| Customer | Product detail, variants, stock, cart | WORKING | canonical Product/Cart services; transactional tests |
| Customer | Checkout, COD, order creation | WORKING | server-owned totals, stock reservation, idempotency integration coverage |
| Customer | Midtrans fallback | PARTIAL | controlled unavailable state is tested; no live provider E2E |
| Customer | Order history/detail/cancel | WORKING | canonical Order API and integration coverage |
| Customer | Delivery tracking and proof display | PARTIAL | canonical Delivery data is exposed; browser journey not completed in this pass |
| Customer | Review, notification, chat | WORKING | canonical APIs and MySQL integration coverage |
| Merchant | Store list/create/update/status | WORKING | canonical Store API and ownership tests |
| Merchant | Product CRUD, variants, images | WORKING | canonical Product API and integration tests |
| Merchant | Stock management | WORKING | replaced mock state with canonical Product update API in this pass |
| Merchant | Order lifecycle and pickup readiness | WORKING | canonical Order/Delivery APIs |
| Merchant | Review reply, chat, notification, finance | WORKING | canonical APIs and integration coverage |
| Merchant | Dashboard metrics/activity | MOCK | still derives part of dashboard from legacy local data; not transaction-authoritative |
| Merchant | Operational settings | MOCK | session-only preference copy remains |
| Courier | Availability, batches, pickup, delivery, failure, proof | WORKING | canonical Delivery API and MySQL integration coverage |
| Courier | History, notification, support chat | PARTIAL | canonical data paths exist; full browser journey not completed |
| Admin | Delivery, reviews, finance, notifications | WORKING | canonical APIs; Delivery corrective endpoints included |
| Admin | Merchant approval/monitoring | MOCK | legacy local application screens remain linked |
| Admin | Transaction monitoring | PARTIAL | canonical read path exists; manual cross-role verification incomplete |
| Admin | Product monitoring | BROKEN | no dedicated canonical admin product-monitoring experience |
| Admin | Reports / bug reports | LEGACY | localStorage prototype; outside transactional Commerce core |
| Admin | Settings | WORKING | canonical Settings API; approved layout unchanged |
| Shared | Audit records | WORKING | append-only writes covered by integration tests |
| Shared | Consistent i18n across every role | PARTIAL | shared/customer core translated; many Merchant/Courier/Admin strings remain hardcoded |
| Shared | Light/dark theme across every page | PARTIAL | persisted semantic theme foundation exists; full visual matrix not completed |
| Shared | Production route splitting | BROKEN | production bundle is 858.80 kB; route modules are still eagerly imported |

## Priority findings

- P1 fixed: Merchant stock screen previously updated only mock component state and logged to the console. It now reads and writes canonical products through the authenticated API.
- P2 fixed: Customer Home and primary navigation promoted Tourism/Live In despite the active E-Commerce direction. They now prioritize products, orders, cart, notifications, and account without deleting compatibility routes.
- P2 remaining: Merchant dashboard metrics and Admin merchant approval still use local prototype data.
- P2 remaining: a complete ID/EN and Light/Dark visual pass has not been performed for all active role pages.
- P3 remaining: route-level lazy loading is needed to address the production bundle warning.

## Automated validation

- Backend unit: 78 passed, 0 failed.
- MySQL integration: 15 passed, 0 failed.
- Frontend lint: passed.
- Frontend production build: passed with one large-bundle warning.
- Runtime: backend liveness 200, database readiness 200, Socket.IO polling handshake 200, Vite frontend 200 on `localhost:5173`.

This matrix does not treat lint/build as visual acceptance. Browser-based role journeys and the requested viewport/theme/language screenshot matrix remain separate manual QA work.
