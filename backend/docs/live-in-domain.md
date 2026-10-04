# Live In domain

The canonical Live In source is MySQL through Prisma and `/api/live-in`. A Live In Profile belongs one-to-one to a Store of type `live-in`; Store ownership and location are not duplicated. SIG LENTERA remains pending a real API contract, while Leaflet/OSM is presentation-only.

Standard bookings select one or more rooms. Customers do not enter an arbitrary guest count: capacity is the sum of selected room capacities. Pricing is per room per night, with half-open date ranges `[checkIn, checkOut)`. Database-level room-night reservations prevent concurrent overlap.

The development QA meal plan and prices are examples only. Effective meals resolve from a room override, otherwise the Profile default, and are snapshotted per booking room.

Customer cancellation is allowed only while status is `PENDING_APPROVAL` or `CONFIRMED` and at least three calendar days before check-in (H-3). Cancellation releases room-night reservations and cancels the pending Platform Transaction; no refund behavior is fabricated.

Every actionable booking creates a shared `LIVE_IN` Platform Transaction and Payment Attempt with the current global PPN snapshot. Completion calls the shared Admin Fee helper, using transaction subtotal as the percentage fee base.

Legacy browser keys:

- `kucur_livein_services`: COMPATIBILITY_ONLY for unmigrated Review/Chat helpers.
- `kucur_livein_rooms`: COMPATIBILITY_ONLY for unmigrated Review/Chat helpers.
- `kucur_livein_bookings`: COMPATIBILITY_ONLY for unmigrated Review/Chat helpers.

Active Customer, Merchant, and Admin Live In screens do not use these keys as authoritative state.
