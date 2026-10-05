const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { config } = require("../config/config");
const { bus, EVENTS } = require("./bus");

// Clients connect with the same JWT they use for the REST API:
//   io("http://localhost:8000", { auth: { token } })
const attachSocket = (httpServer) => {
  const io = new Server(httpServer, { cors: { origin: "*" } });

  // Socket.io middleware: runs once per connection, before "connection".
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      socket.data.user = jwt.verify(token, config.JWT_SECRET);
      next();
    } catch (error) {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("warehouse"); // everybody
    if (socket.data.user.role === "manager") socket.join("managers");
    socket.emit("hello", { user: socket.data.user, rooms: [...socket.rooms] });
  });

  // Which event goes to which room
  const routes = {
    [EVENTS.STOCK_CHANGED]: "warehouse",
    [EVENTS.TX_CREATED]: "warehouse",
    [EVENTS.LOW_STOCK]: "warehouse",
    [EVENTS.ALERT_RESOLVED]: "managers",
  };
  const listeners = [];
  for (const event of Object.keys(routes)) {
    const listener = (payload) => io.to(routes[event]).emit(event, payload);
    bus.on(event, listener);
    listeners.push([event, listener]);
  }

  // Used by the tests to clean up.
  io.detachBus = () => listeners.forEach(([event, listener]) => bus.off(event, listener));
  return io;
};

module.exports = { attachSocket };
