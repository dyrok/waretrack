const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, teardown, twoUsers } = require("./helpers");
const { fefoOrder } = require("../services/stockService");

let api, M, S, milk, bolts;
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

before(async () => {
  ({ api } = await setup("stock"));
  ({ M, S } = await twoUsers(api));
  for (const code of ["A1", "B2"]) {
    await api.post("/api/bins").set("Authorization", M).send({ code, capacity: 300 });
  }
  const milkRes = await api
    .post("/api/items")
    .set("Authorization", S)
    .send({ sku: "MILK", name: "Milk", barcode: "1001", perishable: true, reorderLevel: 5, unitCost: 1 });
  milk = milkRes.body._id;
  const boltRes = await api
    .post("/api/items")
    .set("Authorization", S)
    .send({ sku: "BOLT", name: "M8 Bolt", barcode: "2002", reorderLevel: 5, unitCost: 0.1 });
  bolts = boltRes.body._id;
});
after(teardown);

describe("fefoOrder (no database needed)", () => {
  test("soonest expiry first, no-expiry last, expired and empty lots dropped", () => {
    const now = new Date("2026-01-10");
    const lots = [
      { id: "none", quantity: 5, expiresAt: null },
      { id: "late", quantity: 5, expiresAt: new Date("2026-03-01") },
      { id: "expired", quantity: 5, expiresAt: new Date("2026-01-01") },
      { id: "soon", quantity: 5, expiresAt: new Date("2026-01-20") },
      { id: "empty", quantity: 0, expiresAt: new Date("2026-01-15") },
    ];
    assert.deepEqual(
      fefoOrder(lots, now).map((lot) => lot.id),
      ["soon", "late", "none"],
    );
  });
});

describe("receive", () => {
  test("perishable items need an expiry date", async () => {
    const res = await api
      .post("/api/transactions/receive")
      .set("Authorization", S)
      .send({ itemId: milk, bin: "A1", quantity: 10 });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "EXPIRY_REQUIRED");
  });

  test("different expiry dates become different lots", async () => {
    const a = await api
      .post("/api/transactions/receive")
      .set("Authorization", S)
      .send({ itemId: milk, bin: "A1", quantity: 40, expiresAt: daysFromNow(20) });
    const b = await api
      .post("/api/transactions/receive")
      .set("Authorization", S)
      .send({ itemId: milk, bin: "A1", quantity: 60, expiresAt: daysFromNow(5) });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    const item = await api.get(`/api/items/${milk}`).set("Authorization", S);
    assert.equal(item.body.onHand, 100);
    assert.equal(item.body.lots.length, 2);
  });

  test("a bin cannot be overfilled", async () => {
    const res = await api
      .post("/api/transactions/receive")
      .set("Authorization", S)
      .send({ itemId: bolts, bin: "A1", quantity: 250 });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body.details, { capacity: 300, used: 100, incoming: 250 });
  });
});

describe("ship", () => {
  test("the lot that expires first is picked first (FEFO)", async () => {
    const res = await api
      .post("/api/transactions/ship")
      .set("Authorization", S)
      .send({ itemId: milk, quantity: 70, reference: "SO-1" });
    assert.equal(res.status, 201);
    assert.deepEqual(
      res.body.picks.map((p) => p.quantity),
      [60, 10],
    );
    assert.ok(new Date(res.body.picks[0].expiresAt) < new Date(res.body.picks[1].expiresAt));
  });

  test("cannot ship more than we have", async () => {
    const res = await api
      .post("/api/transactions/ship")
      .set("Authorization", S)
      .send({ itemId: milk, quantity: 31 });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body.details, { available: 30, requested: 31 });
  });

  test("two shipments racing for the last units never oversell", async () => {
    await api
      .post("/api/transactions/receive")
      .set("Authorization", S)
      .send({ itemId: bolts, bin: "B2", quantity: 10 });
    const [r1, r2] = await Promise.all([
      api.post("/api/transactions/ship").set("Authorization", S).send({ itemId: bolts, quantity: 8 }),
      api.post("/api/transactions/ship").set("Authorization", S).send({ itemId: bolts, quantity: 8 }),
    ]);
    assert.deepEqual([r1.status, r2.status].sort(), [201, 409]);
    const item = await api.get(`/api/items/${bolts}`).set("Authorization", S);
    assert.equal(item.body.onHand, 2);
  });
});

describe("transfer", () => {
  test("only managers can transfer", async () => {
    const res = await api
      .post("/api/transactions/transfer")
      .set("Authorization", S)
      .send({ itemId: milk, fromBin: "A1", toBin: "B2", quantity: 5 });
    assert.equal(res.status, 403);
  });

  test("stock moves to the new bin with the same expiry date", async () => {
    const res = await api
      .post("/api/transactions/transfer")
      .set("Authorization", M)
      .send({ itemId: milk, fromBin: "A1", toBin: "B2", quantity: 10 });
    assert.equal(res.status, 201);
    const b2 = await api.get("/api/inventory?bin=B2").set("Authorization", S);
    const milkLot = b2.body.data.find((lot) => lot.item.sku === "MILK");
    assert.equal(milkLot.quantity, 10);
    assert.notEqual(milkLot.expiresAt, null);
  });
});

describe("adjust and the ledger", () => {
  test("a stock count saves the difference as an ADJUST", async () => {
    const lots = await api.get(`/api/inventory?itemId=${milk}&bin=B2`).set("Authorization", S);
    const res = await api
      .put(`/api/inventory/${lots.body.data[0]._id}`)
      .set("Authorization", M)
      .send({ quantity: 7, reason: "damaged" });
    assert.equal(res.status, 200);
    assert.equal(res.body.transaction.type, "ADJUST");
    assert.equal(res.body.transaction.quantity, -3);
    assert.equal(res.body.transaction.reason, "damaged");
  });

  test("every kind of movement is in the ledger", async () => {
    const res = await api.get("/api/transactions?limit=100").set("Authorization", S);
    const types = new Set(res.body.data.map((t) => t.type));
    for (const type of ["RECEIVE", "SHIP", "TRANSFER", "ADJUST"]) assert.ok(types.has(type));
  });
});
