# Wisata / Tourism domain

`tourism` is the canonical Store type. `educational-tourism` is accepted only at the Store API migration boundary and is persisted as `tourism`; education is represented by the `EDUCATIONAL` package category. `NON_EDUCATIONAL` covers other tourism packages.

The authoritative records are stored in MySQL through Prisma. Customer and Merchant Tourism routes use `/api/tourism`; browser `localStorage` is not an authoritative source for packages, schedules, capacity, bookings, group requests, or offers.

Apply the schema and development fixtures with:

```powershell
cd backend
npm run db:migrate
npm run db:seed
```

The connection host and port must always come from `DATABASE_URL` (or the matching Docker environment configuration). Application code must not assume a fixed MySQL host port.

Standard booking reserves capacity atomically and creates a `TOURISM` Platform Transaction with the active PPN snapshot. A group request creates no financial transaction. Accepting a Merchant offer creates exactly one custom booking and transaction. Completing the booking uses the shared finance completion helper to create one Admin Fee obligation; cancellation, rejection, and expiry release reserved capacity.
