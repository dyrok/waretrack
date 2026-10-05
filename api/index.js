// Vercel entry point.
//
// server.js is still the entry point for `npm start` (local, Render, anywhere
// with a long-running process). Vercel needs a module that EXPORTS an
// http.Server instead of calling listen() itself: that is the documented way
// to serve WebSockets from a Vercel Function, so Socket.io keeps working.
//
// The other difference from server.js is the database. A function can be
// frozen and thawed between requests, so we cache one connection promise in
// module scope and await it per request instead of connecting once at boot.
const http = require("http");
const mongoose = require("mongoose");
const { config, checkConfig } = require("../config/config");
const { createApp } = require("../app");
const { attachSocket } = require("../socket/socket");
const { configurePush } = require("../services/pushService");

checkConfig();
configurePush(config.PUSH_DRIVER);

// Mongoose keeps its own pool. Reusing it across invocations on the same
// instance is what stops us opening a new Atlas connection per request.
let connection = null;
const connectOnce = () => {
  if (!connection) {
    connection = mongoose
      .connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
      })
      .catch((error) => {
        connection = null; // let the next request try again
        throw error;
      });
  }
  return connection;
};

const app = createApp();

// Wait for the database before handing the request to Express, so a cold start
// answers 503 instead of hanging if Atlas is unreachable.
const server = http.createServer((req, res) => {
  connectOnce().then(
    () => app(req, res),
    (error) => {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "database unavailable", detail: error.message }));
    },
  );
});

attachSocket(server);

module.exports = server;
