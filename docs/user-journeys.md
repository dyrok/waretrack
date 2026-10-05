# WareTrack console — user journeys

The UI is built around these journeys and nothing else: what a role cannot do, it never sees.
Roles come from the backend rules: the **first user who registers becomes manager**, after that
only a manager can create another manager; everyone else is staff.

Legend: **S** = staff, **M** = manager only. Endpoint is the API call the journey uses.

## 1. Account (everyone)

| # | Journey | Steps | Endpoint |
|---|---------|-------|----------|
| J1 | **Sign up** (first run) | Create account (name, email, password) → signed in straight away. First account ever = manager. | `POST /api/auth/register` |
| J2 | **Sign in** | Email + password → console opens on Dashboard. | `POST /api/auth/login` |
| J3 | **Sign out** | Header → *Sign out* → token dropped, socket closed, back to sign-in. | — |
| J4 | **Create teammate** **M** | Team → name, email, password, role (staff or manager) → account created, current session stays. | `POST /api/auth/register` (manager token) |

## 2. Staff day (S = also available to managers)

| # | Journey | Steps | Endpoint |
|---|---------|-------|----------|
| J5 | **Glance at the floor** | Dashboard → KPIs (items, units, open alerts, bin utilisation), stock & forecast, bins, live feed. | `GET /api/items`, `GET /api/bins`, `GET /api/alerts`, `GET /api/reports/forecast` |
| J6 | **Receive stock** | Stock → pick item, bin, quantity, best-before (required for perishables), optional reference → stock lands in the bin (bin cannot be overfilled). | `POST /api/transactions/receive` |
| J7 | **Ship stock** | Stock → pick item, quantity (oldest expiry picked first, FEFO), optional bin + reference → stock leaves. | `POST /api/transactions/ship` |
| J8 | **Find an item** | Items → search by barcode (exact) or name/SKU text. | `GET /api/items/search` |
| J9 | **Add catalogue item** | Items → SKU, name, barcode, unit, reorder level, unit cost, perishable → item created. | `POST /api/items` |
| J10 | **Watch alerts** | Alerts → open/low-stock list, *Run check* to refresh thresholds now. | `GET /api/alerts`, `POST /api/alerts/check` |

## 3. Manager (M) — every staff journey, plus

| # | Journey | Steps | Endpoint |
|---|---------|-------|----------|
| J11 | **Edit / delete item** | Items → *Edit* (change any field) or *Delete* (only allowed when the item has no stock). | `PUT /api/items/:id`, `DELETE /api/items/:id` |
| J12 | **Add / edit bin** | Bins → add (code, zone, capacity) or edit (zone, capacity, active). Capacity cannot drop below what is inside. | `POST /api/bins`, `PUT /api/bins/:id` |
| J13 | **Transfer between bins** | Stock → item, from bin, to bin, quantity → stock moves, expiry date unchanged. | `POST /api/transactions/transfer` |
| J14 | **Stock count / adjustment** | Inventory → *Adjust* on a lot → enter the counted quantity (not the difference) + reason (count, expired, damaged, lost, found). | `PUT /api/inventory/:id` |
| J15 | **Resolve alert** | Alerts → *Resolve* on an open alert → optional note, alert closed. | `PUT /api/alerts/:id/resolve` |
| J16 | **Reports** | Reports → turnover (by month, by item), waste (written off + expired on hand), forecast (cover days, reorder suggestions). | `GET /api/reports/turnover`, `GET /api/reports/waste`, `GET /api/reports/forecast` |
| J17 | **Send notification** | Notify → title, body, and a topic or device token → push sent (202). | `POST /api/notifications/send` |

## Screen → journeys map

| Screen | Journeys | Visible to |
|--------|----------|------------|
| Sign in / Sign up | J1, J2 | signed out |
| Dashboard | J5 | everyone |
| Stock | J6, J7 (J13 **M**) | everyone |
| Items | J8, J9 (J11 **M**) | everyone |
| Inventory | J14 **M** (lot list for everyone) | everyone |
| Alerts | J10 (J15 **M**) | everyone |
| Bins | J12 **M** (bin list for everyone) | everyone |
| Reports | J16 **M** | manager |
| Notify | J17 **M** | manager |
| Team | J4 **M** | manager |

Cross-cutting: every screen refreshes when a live event (stock change, transaction, alert)
arrives over Socket.io; the header always shows who is signed in, the live status and *Sign out*.
