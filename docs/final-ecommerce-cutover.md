# Final E-Commerce Development Cutover

Active E-Commerce development uses the approved final 20-table repository:

```env
FINAL_REPOSITORY_READ_MODE=final
FINAL_REPOSITORY_WRITE_MODE=final
FINAL_REPOSITORY_SHADOW_SYNC_WRITES=false
FINAL_REPOSITORY_LEGACY_MIRROR_WRITES=false
```

The legacy E-Commerce schema is a frozen backup and migration source. Do not add new active E-Commerce behavior to the legacy repository. Tourism and Live In remain outside the final E-Commerce scope and continue using their retained persistence.

Production final mode is intentionally opt-in. Besides explicitly setting both repository modes to `final`, production requires `FINAL_REPOSITORY_ALLOW_FINAL_IN_PRODUCTION=true`. Invalid or unapproved configurations fail during application startup.

## Emergency rollback

Changing the environment variables directly is unsafe after final-only writes exist.

1. Stop all E-Commerce writes and keep the application in maintenance/read-only mode.
2. Snapshot both final and legacy persistence.
3. Run controlled final-to-legacy reconciliation for every final-only entity created or updated since cutover.
4. Validate IDs, monetary totals, stock lifecycle, payments, delivery state, reviews, messages, notifications, foreign keys, and row-level logical equivalence.
5. Repair every mismatch and repeat reconciliation until divergence is zero.
6. Only after equivalence is proven, set read and write modes to `legacy` and restart the backend.
7. Run authentication, checkout idempotency, payment, delivery, and cross-role smoke tests before reopening writes.

Do not drop final or legacy tables as part of emergency rollback.

## Validation evidence

Main-database before/after snapshots are generated in `backend/prisma/reports/phase-4e-main-before.json` and `phase-4e-main-after.json`. The final-mode QA fixture preparation is guarded to the `kucur` development database and updates only named final-table fixtures.
