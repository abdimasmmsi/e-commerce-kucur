# Admin Settings and financial configuration foundation

`PlatformSettings` in MySQL is the canonical global configuration source. Updates are Admin-only, atomic, validated by the backend, and append an `AuditRecord`. Future transactional domains must copy the applicable PPN, Admin Fee, and late-interest percentages into immutable obligation/order snapshots; historical amounts must never be recalculated from current settings.

- Iuran Pokok is per Store (Product, Tourism, or Live In). Supported plans are full, 3 months, and 6 months. The first payment is immediate and a Store becomes active only after that payment succeeds.
- Installment late interest uses the configured percentage every 7 days against the remaining outstanding balance.
- Admin Fee is per Store and is either percentage or fixed Rupiah. Each qualifying transaction will create an obligation that must be paid in full. The canonical cutoff is day 1 with grace through 12:00 platform-local time; outstanding obligations can suspend the Store.
- PPN is global. Iuran Sukarela is optional per Merchant User, has a freely chosen amount, no due date, and never suspends a Store.
- Pride ranks Stores, Top 7 by default, Monday–Sunday. Its future engine must normalize transaction value, completed count, rating, and completion rate before applying weights; raw revenue alone is not a valid score.

The seed amounts and percentages (Rp100,000 initial fee, 2% late interest, 5% Admin Fee, and 11% PPN) are development QA defaults only and are not stakeholder-approved production policy. This implementation does not execute billing, interest, suspension, contribution payments, or weekly Pride scoring.
