# Kucur E-Commerce Platform — Final Technical Figures

Dokumen ini adalah paket figure-ready untuk jurnal "Pengembangan Platform E-Commerce Terintegrasi untuk Produk Lokal di Desa Wisata Kucur". Seluruh artefak mengikuti implementasi yang telah dibekukan setelah final acceptance testing.

## A. Implementation verification

Sumber yang direkonsiliasi:

- `backend/prisma/schema.prisma`, khusus model fisik final `Target*` yang dipetakan dengan `@@map`;
- migration `20260831100000_final_ecommerce_20_table_target_additive` dan schema MySQL aktif;
- final repository, service, REST routes, Socket.IO transport, frontend routes/navigation, dan Playwright E2E;
- hasil freeze: backend 78/78, final repository 22/22, router 9/9 dan 12/12, serta authenticated Playwright 21/21.

Runtime E-Commerce memakai React/Vite, Node.js/Express, final repository, Prisma ORM, MySQL 8.4, dan Socket.IO. Midtrans tersedia secara configuration-dependent; COD tetap tersedia. OpenRouteService dan OpenStreetMap digunakan oleh fitur jarak/rute dan peta yang aktif. Tourism, Live In, dan legacy persistence tidak ditampilkan sebagai bagian arsitektur E-Commerce aktif.

## B. Fig. 1 — Agile process

Caption: **Fig. 1. Agile development process of the Kucur E-Commerce Platform.**

Purpose: memperlihatkan siklus requirements, design, implementation, testing, review, dan backlog refinement yang berulang sampai release candidate diterima.

Included: Requirements/Backlog, Design, Development, Testing, Review/Feedback, Release Candidate, dan feedback loop.

Source: [fig-1-agile.mmd](./fig-1-agile.mmd)

Validation: alur dibuat ringkas agar tetap terbaca pada satu kolom atau lebar setengah halaman jurnal.

## C. Fig. 2 — Use case diagram

Caption: **Fig. 2. Use case diagram of the Kucur E-Commerce Platform.**

Purpose: merangkum kewenangan lima aktor pada scope E-Commerce final.

Included: Visitor, Customer, Merchant, Courier, Admin; product discovery, authentication, profile, cart, checkout, payment, order/delivery, store/product/stock management, finance, review, chat, notification, delivery operation, approval, monitoring, moderation, dan settings.

Source: [fig-2-use-case.mmd](./fig-2-use-case.mmd)

Validation: tidak memuat Tourism, Live In, GIS companion system, ticketing, Pride, atau use case legacy-only.

## D. Fig. 3 — Activity diagram

Caption: **Fig. 3. Activity diagram of the E-Commerce transaction process.**

Purpose: menunjukkan happy path CommerceOrder lintas Customer, System, Merchant, Admin, dan Courier beserta alternatif utama.

Included: product/variant selection, Cart, stock/total validation, payment, CommerceOrder, Merchant processing, DeliveryBatch, pickup, proof, completion, Review, Merchant reply, insufficient stock, payment failure/expiry/cancellation, eligible cancellation, dan delivery failure/rebatch.

Source: [fig-3-activity.mmd](./fig-3-activity.mmd)

Validation: happy path menggunakan garis solid utama; kondisi gagal tetap terlihat tetapi tidak mendominasi.

## E. Fig. 4 — System architecture

Caption: **Fig. 4. System architecture of the Kucur E-Commerce Platform.**

Purpose: memperlihatkan hubungan client, REST/realtime server, business layer, persistence, dan integrasi aktif.

Included: responsive React 19/Vite 8 application, Node.js/Express 5 API, Socket.IO client/server, business services, final repository, Prisma ORM 6, MySQL 8.4, Midtrans yang configuration-dependent, OpenRouteService, dan OpenStreetMap.

Source: [fig-4-architecture.mmd](./fig-4-architecture.mmd)

Validation: PostgreSQL, Redis, Tourism, Live In, future integrations, dan legacy database tidak ditampilkan sebagai normal runtime.

## F. Fig. 5 — Delivery and fulfillment

Caption: **Fig. 5. Local courier delivery and order fulfillment process.**

Purpose: menjelaskan fulfillment lokal menggunakan struktur delivery final.

Included: CommerceOrder, Merchant Processing, Ready for Pickup, DeliveryBatch, DeliveryBatchOrder, Courier Pickup, Out for Delivery, Delivery Proof, Delivered, failure history, dan controlled rebatch.

Source: [fig-5-fulfillment.mmd](./fig-5-fulfillment.mmd)

Validation: tidak menggunakan istilah legacy per-order `CourierAssignment`.

## G. Fig. 6 — Final ERD

Caption: **Fig. 6. Entity relationship diagram of the final E-Commerce database.**

Purpose: mendokumentasikan struktur persistence canonical final dengan physical table names.

Included: tepat 20 tabel, PK, FK, unique-key penting, field fisik, dan 40 relationship lines.

Source: [fig-6-final-erd.mmd](./fig-6-final-erd.mmd)

Validation notes:

- model Prisma `Target*` ditampilkan dengan nama fisik dari `@@map`;
- MySQL live integrity: 20 tabel, 40 FK, 0 orphan, dan 0 pelanggaran PaymentAttempt XOR;
- source SQL awal memuat 37 FK; migration/live frozen juga memiliki `Store.reviewedByUserId`, `Review.moderatedByUserId`, dan `PaymentAttempt.merchantFeeId`, sehingga ERD mengikuti implementasi canonical 40 FK;
- semua relasi optional/required disajikan menurut nullability dan unique constraint fisik;
- tidak ada tabel legacy, Tourism, atau Live In.

Untuk layout jurnal dua kolom, render Fig. 6 sebagai figure selebar dua kolom. Lima figure lain dapat dirender satu kolom. Sumber Mermaid sengaja disimpan terpisah agar ekspor SVG/PDF tidak menurunkan ketajaman teks.

## H. Testing result summary

| Area | Evidence | Result |
|---|---|---|
| Customer functional flow | Authenticated catalog, Cart, checkout, payment/order, delivery, Review E2E | PASS |
| Merchant functional flow | Store/product/stock/order/pickup/finance/reply traversal and cross-role E2E | PASS |
| Admin functional flow | Approval, transaction/delivery/finance monitoring, moderation, settings | PASS |
| Courier functional flow | Availability, batch, pickup, out-for-delivery, proof, history | PASS |
| Cross-role transaction | Same CommerceOrder from Customer through Merchant/Admin/Courier to Review reply | PASS |
| Payment and Finance | PaymentAttempt targets/XOR, retry states, MerchantFee, installment, penalty, settlement | PASS |
| Stock and concurrency | Authoritative totals, idempotency, consume/release, variant stock, oversell prevention | PASS |
| Delivery | DeliveryBatch and DeliveryBatchOrder transitions, failure, rebatch, isolation | PASS |
| Review | Eligibility, rating, uniqueness, reply, visibility moderation | PASS |
| Chat | Authorization, context, openKey, realtime/reconnect, readAt, close protection | PASS |
| Notification | Dedupe, metadata/context, unread/read, mark-all, expiration | PASS |
| Authorization and security | Wrong-role/store/courier and invalid transition negative tests | PASS |
| Responsive | 360, 390, 430, 768, 1024, 1366, and 1440 px | PASS |
| Language | Representative authenticated ID/EN matrix | PASS |
| Theme | Customer, Merchant, Courier, and Admin Light/Dark matrix | PASS |
| Database integrity | 20 tables, 40 FK, 0 orphan, PaymentAttempt XOR valid | PASS |

Verified suite totals: backend compatibility 78/78; final repository 22/22; read router 9/9; write router 12/12; authenticated Playwright 21/21. Frontend lint/build and Prisma validate/generate passed. Counts are not aggregated because the suites overlap in scope.

## I. Journal screenshot plan

| Screen/page | Role | Demonstrates | Recommended caption |
|---|---|---|---|
| Product catalog and detail | Customer | Search, stock visibility, variant selection, responsive product discovery | **Customer product discovery and variant selection interface.** |
| Checkout or completed order detail | Customer | Authoritative totals, payment state, status timeline, delivery proof | **Checkout and CommerceOrder tracking with authoritative transaction totals.** |
| Order management/detail | Merchant | Store-scoped processing and Ready for Pickup transition | **Merchant order processing and fulfillment preparation interface.** |
| Delivery batch/detail | Courier | Batch assignment, pickup, Out for Delivery, and proof submission | **Local courier batch execution and delivery proof workflow.** |
| Transactions or delivery batches | Admin | Cross-store transaction and fulfillment monitoring | **Administrative monitoring of E-Commerce transactions and local delivery.** |

Recommended journal selection: use three UI screenshots in the main paper—Customer transaction, Merchant processing, and Courier/Admin fulfillment—and move additional screens to an appendix. Avoid screenshots that communicate the same state twice.

## J. Terminology standard

Use consistently: **Customer**, **Merchant**, **Courier**, **Admin**, **Store**, **Product**, **ProductVariant**, **Cart**, **CommerceOrder**, **PaymentAttempt**, **MerchantFee**, **DeliveryBatch**, **DeliveryBatchOrder**, **Review**, **Conversation**, and **Notification**.

Use “order” only as general prose; use `CommerceOrder` when naming the persisted technical entity. Do not substitute Buyer/Seller for Customer/Merchant in figures. “Payment” is the functional process; `PaymentAttempt` is its persisted attempt record.

## K. Rendering guidance

The repository does not include a pinned Mermaid rendering CLI, so no generated raster file is committed. Render the `.mmd` sources with a trusted Mermaid-compatible editor and export SVG or vector PDF. Use a white or transparent background, minimum 8–9 pt final text, consistent forest-green outlines, and no screenshots of the Mermaid editor chrome.

## L. Freeze statement

These files are documentation-only. They do not change application behavior, Prisma models, migrations, repository routing, or database contents.

## M. Documentation readiness

- Final figure count: 6.
- Final ERD table count: 20 physical tables.
- Final ERD foreign-key count: 40.
- Tourism/Live In entities in final figures: 0.
- Legacy entities in final ERD: 0.
- Mermaid source is available for every figure; rendered images are intentionally deferred because no pinned Mermaid renderer is installed in the repository.
- Testing summary and representative journal screenshot plan are ready.
- Application behavior, Prisma schema, database migrations, and final repository behavior remain unchanged by this documentation pass.
