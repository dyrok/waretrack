const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const authMiddleware = require("./middleware/authMiddleware");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const authRoutes = require("./routes/authRoutes");
const itemRoutes = require("./routes/itemRoutes");
const binRoutes = require("./routes/binRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const alertRoutes = require("./routes/alertRoutes");
const reportRoutes = require("./routes/reportRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// Checks a Firebase ID token with firebase-admin.
// Loaded only when someone actually uses Firebase login.
const verifyWithFirebase = async (idToken) => {
  const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  if (getApps().length === 0) initializeApp({ credential: applicationDefault() });
  return getAuth().verifyIdToken(idToken);
};

// createApp builds the Express app but does NOT start it.
// server.js starts it; the tests use it without opening a port.
const createApp = (options = {}) => {
  const app = express();
  app.locals.verifyFirebaseToken = options.verifyFirebaseToken || verifyWithFirebase;

  // helmet sets safe HTTP headers. The console is a built React app that only
  // loads external scripts, so the default policy (script-src 'self') fits.
  app.use(helmet());
  // morgan goes first so it also logs requests that fail in express.json()
  if (process.env.NODE_ENV !== "test") app.use(morgan("dev")); // one log line per request
  app.use(cors());
  app.use(express.json());
  // The React console: "npm run build" writes it to client/dist.
  // In development the Vite dev server serves the console instead and proxies here.
  const clientDist = path.join(__dirname, "client", "dist");
  app.use(express.static(clientDist));

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  // Public routes first...
  app.use("/api/auth", authRoutes);
  // ...then every other /api route needs a token.
  app.use("/api", authMiddleware);
  app.use("/api/items", itemRoutes);
  app.use("/api/bins", binRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/alerts", alertRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/notifications", notificationRoutes);

  // The console is a single-page app: any other GET gets its index.html.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = { createApp };
