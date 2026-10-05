const http = require("http");
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { io: connect } = require("socket.io-client");
const { setup, teardown, twoUsers } = require("./helpers");
const { attachSocket } = require("../socket/socket");

let api, M, S, staffToken, server, ioServer, url, itemId;

before(async () => {
  let app, users;
  ({ api, app } = await setup("realtime"));
  users = await twoUsers(api);
  ({ M, S } = users);
  staffToken = users.staff.token;
  server = http.createServer(app);
  ioServer = attachSocket(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = "http://127.0.0.1:" + server.address().port;
  await api.post("/api/bins").set("Authorization", M).send({ code: "A1" });
  const res = await api
    .post("/api/items")
    .set("Authorization", S)
    .send({ sku: "TAPE", name: "Tape", barcode: "4004", reorderLevel: 50 });
  itemId = res.body._id;
});

after(async () => {
  ioServer.detachBus();
  ioServer.close();
  await teardown();
});

const waitFor = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

describe("socket.io", () => {
  test("a socket without a valid token is rejected", async () => {
    const socket = connect(url, { auth: { token: "nope" }, reconnection: false });
    const error = await waitFor(socket, "connect_error");
    assert.equal(error.message, "unauthorized");
    socket.close();
  });

  test("stock changes and low-stock alerts are broadcast live", async () => {
    const socket = connect(url, { auth: { token: staffToken }, reconnection: false });
    const hello = await waitFor(socket, "hello");
    assert.ok(hello.rooms.includes("warehouse"));

    const changed = waitFor(socket, "stock:changed");
    const low = waitFor(socket, "alert:low-stock");
    await api
      .post("/api/transactions/receive")
      .set("Authorization", S)
      .send({ itemId, bin: "A1", quantity: 12 });

    const change = await changed;
    assert.deepEqual([change.sku, change.bin, change.delta], ["TAPE", "A1", 12]);
    const alert = await low;
    assert.deepEqual([alert.sku, alert.onHand, alert.threshold], ["TAPE", 12, 50]);
    socket.close();
  });
});
