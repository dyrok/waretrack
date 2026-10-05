# WareTrack Backend

Inventory Warehouse System backend (Case Study 12): Node.js, Express, MongoDB with Mongoose,
JWT + Firebase Auth, Socket.io and Firebase push notifications. Plain JavaScript.
Reference project for the eBook _WareTrack_ by Prabir Singh.

## Requirements

- Node.js 22 or newer
- MongoDB 8 (local, or a free Atlas cluster)

## Setup

```bash
npm install
npm run build            # build the React console into client/dist
cp .env.example .env     # then put a long random JWT_SECRET in .env
npm run seed             # demo data: 8 items, 6 bins, 6 months of history
npm run dev              # http://localhost:8000
npm run dev:client
```

While developing the console, run `npm run dev:client` as well: Vite serves it at
http://localhost:5173 and proxies the API and Socket.io to the server on port 8000.

| URL      | What                                  |
| -------- | ------------------------------------- |
| `/`      | React console (sign in as a demo user) |
| `/health` | Health check                          |

The console screens follow the journeys in [docs/user-journeys.md](docs/user-journeys.md):
sign up / sign in / sign out, receive and ship stock, find and add items and watch alerts for
everyone; plus transfer, stock count, item and bin management, alert resolution, reports,
notifications and team management for managers.

Demo users, password `password123`: `maya@waretrack.dev` (manager) and `sam@waretrack.dev` (staff).

## Scripts

| Command        | What it does                                                      |
| -------------- | ----------------------------------------------------------------- |
| `npm run dev`  | Start and restart on file changes                                 |
| `npm run dev:client` | Run the React console with the Vite dev server              |
| `npm run build` | Install client dependencies and build the console to client/dist  |
| `npm test`     | Run the tests (needs MongoDB running)                             |
| `npm run lint` | Check the code with ESLint                                        |
| `npm run seed` | Delete everything and load demo data                              |
| `npm run flow` | Run the case study's example user flow against the running server |

## Folders

```
config/       settings and database connection
middleware/   authMiddleware, roleMiddleware, validateRequest, errorMiddleware
models/       Mongoose models: User, Item, Bin, Stock, Transaction, Alert
routes/       URL -> controller, one file per resource
controllers/  handle the request and send the response
services/     warehouse rules: stockService, alertService, pushService
socket/       Socket.io server and the event bus
client/       the React console (Vite), built into client/dist
docs/         user journeys (the UI follows these)
scripts/      seed and flow
tests/        node:test + supertest
```

## Roles

| Action                                                     | staff | manager |
| ---------------------------------------------------------- | :---: | :-----: |
| Receive, ship, search, see inventory and alerts, add items |  yes  |   yes   |
| Edit or delete items, add or edit bins                     |       |   yes   |
| Transfer between bins, adjust counted stock                |       |   yes   |
| Resolve alerts, reports, send notifications                |       |   yes   |

The first user who registers becomes a manager. After that only a manager can create managers.

## Real-time events

Connect with `io("http://localhost:8000", { auth: { token } })`. Events: `stock:changed`,
`transaction:created`, `alert:low-stock` (everyone) and `alert:resolved` (managers).

## Push notifications

`PUSH_DRIVER=log` prints notifications in the terminal. `PUSH_DRIVER=fcm` sends them with
Firebase Cloud Messaging; set `GOOGLE_APPLICATION_CREDENTIALS` to your service-account JSON file
(see [docs/firebase-setup.md](docs/firebase-setup.md) for where to get it).

## Deploy

Set the variables from `.env.example` on the host, with an Atlas connection string for
`MONGO_URI` and a long random `JWT_SECRET`. Never commit the real values: `.env` is gitignored.

### Vercel

`vercel.json` and `api/index.js` are already in the repo, so importing this repo on Vercel is
enough. Vercel runs `npm run build`, serves `client/dist` from the CDN and sends `/api/*`,
`/health` and `/socket.io/*` to the function in `api/index.js`.

Two things make the same Express app work as a function instead of a long-running process:

- `api/index.js` **exports** an `http.Server` rather than calling `listen()`. That is what lets a
  Vercel Function accept the WebSocket upgrade, so Socket.io still works.
- The Mongoose connection is cached in module scope and awaited per request, because a function
  is frozen and thawed between requests instead of booting once.

The browser pins Socket.io to `transports: ["websocket"]`. Its default is HTTP long-polling, and
polling needs every request of a session to land on the same process, which is not guaranteed.

In Atlas, Network Access must allow `0.0.0.0/0` — function IPs are not fixed.

### A long-running host (Render, Railway, a VM)

Build command `npm ci && npm run build`, start command `npm start`. That uses `server.js`, which
still calls `listen()` itself; nothing in `api/` is involved.
