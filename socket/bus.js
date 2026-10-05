const { EventEmitter } = require("events");

// Services announce what happened on this bus.
// socket.js listens and sends it to the browsers.
// Services never need to know that Socket.io exists.
const bus = new EventEmitter();

const EVENTS = {
  STOCK_CHANGED: "stock:changed",
  TX_CREATED: "transaction:created",
  LOW_STOCK: "alert:low-stock",
  ALERT_RESOLVED: "alert:resolved",
};

module.exports = { bus, EVENTS };
