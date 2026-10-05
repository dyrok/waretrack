const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, teardown, twoUsers } = require("./helpers");

let api, push, M, S, soap;

before(async () => {
  ({ api, push } = await setup("alerts"));
  ({ M, S } = await twoUsers(api));
  await api.post("/api/bins").set("Authorization", M).send({ code: "C3", capacity: 1000 });
  const res = await api
    .post("/api/items")
    .set("Authorization", S)
    .send({ sku: "SOAP", name: "Hand Soap", barcode: "3003", reorderLevel: 20, unitCost: 2 });
  soap = res.body._id;
  await api
    .post("/api/transactions/receive")
    .set("Authorization", S)
    .send({ itemId: soap, bin: "C3", quantity: 100 });
});
after(teardown);

const ship = (quantity) =>
  api.post("/api/transactions/ship").set("Authorization", S).send({ itemId: soap, quantity });

describe("low-stock alerts", () => {
  test("ONE alert and ONE push when stock drops below the reorder level", async () => {
    await ship(85); // 15 left
    await ship(5); // 10 left
    const open = await api.get("/api/alerts").set("Authorization", S);
    assert.equal(open.body.data.length, 1);
    assert.equal(open.body.data[0].onHand, 10);
    assert.equal(open.body.data[0].threshold, 20);
    const lowStockPushes = push.outbox.filter((m) => m.topic === "low-stock");
    assert.equal(lowStockPushes.length, 1);
    assert.equal(lowStockPushes[0].title, "Low stock: Hand Soap");
  });

  test("GET /api/inventory/low-stock shows how short we are", async () => {
    const res = await api.get("/api/inventory/low-stock").set("Authorization", S);
    assert.equal(res.body.data[0].onHand, 10);
    assert.equal(res.body.data[0].shortBy, 10);
    assert.equal(res.body.newlyAlerted, 0);
  });

  test("the alert closes by itself when stock comes back", async () => {
    await api
      .post("/api/transactions/receive")
      .set("Authorization", S)
      .send({ itemId: soap, bin: "C3", quantity: 50 });
    assert.equal((await api.get("/api/alerts").set("Authorization", S)).body.data.length, 0);
    const resolved = await api.get("/api/alerts?status=resolved").set("Authorization", S);
    assert.equal(resolved.body.data[0].note, "auto: stock recovered");
  });

  test("a manager can resolve an alert by hand", async () => {
    await ship(45); // 15 left
    const [alert] = (await api.get("/api/alerts").set("Authorization", S)).body.data;
    const staffTry = await api.put(`/api/alerts/${alert._id}/resolve`).set("Authorization", S).send({});
    assert.equal(staffTry.status, 403);
    const res = await api
      .put(`/api/alerts/${alert._id}/resolve`)
      .set("Authorization", M)
      .send({ note: "PO-77 raised" });
    assert.equal(res.body.status, "resolved");
    assert.equal(res.body.note, "PO-77 raised");
    const again = await api.put(`/api/alerts/${alert._id}/resolve`).set("Authorization", M).send({});
    assert.equal(again.status, 409);
  });
});

describe("reports (managers only)", () => {
  test("staff cannot see reports", async () => {
    assert.equal((await api.get("/api/reports/turnover").set("Authorization", S)).status, 403);
  });

  test("turnover rebuilds opening stock from the ledger", async () => {
    // SOAP ledger: +100, -85, -5, +50, -45
    // shipped 135, net +15, closing 15, so opening 0, average 7.5, turnover 18
    const res = await api.get("/api/reports/turnover").set("Authorization", M);
    assert.equal(res.status, 200);
    const row = res.body.items.find((i) => i.sku === "SOAP");
    assert.deepEqual(
      [row.unitsShipped, row.openingUnits, row.closingUnits, row.averageUnits, row.turnover],
      [135, 0, 15, 7.5, 18],
    );
    assert.equal(res.body.monthly[0].unitsShipped, 135);
    assert.equal(res.body.monthly[0].costOfGoods, 270);
    assert.equal(res.body.monthly[0].shipments, 3);
  });

  test("waste groups write-offs by reason", async () => {
    const lot = (await api.get(`/api/inventory?itemId=${soap}`).set("Authorization", S)).body.data[0];
    await api
      .put(`/api/inventory/${lot._id}`)
      .set("Authorization", M)
      .send({ quantity: 12, reason: "damaged" });
    const res = await api.get("/api/reports/waste").set("Authorization", M);
    assert.equal(res.body.writtenOff.length, 1);
    const row = res.body.writtenOff[0];
    assert.deepEqual([row.reason, row.units, row.cost, row.events], ["damaged", 3, 6, 1]);
    assert.equal(res.body.totals.writtenOffCost, 6);
  });

  test("forecast: demand, days of cover and suggested order", async () => {
    const res = await api
      .get("/api/reports/forecast?days=30&leadTimeDays=7&coverDays=14")
      .set("Authorization", M);
    const row = res.body.items.find((i) => i.sku === "SOAP");
    // 135 shipped / 30 days = 4.5 a day. 12 on hand = 2.7 days of cover.
    // reorder point = ceil(4.5 * 7) = 32. suggested = ceil(4.5 * 21) - 12 = 83
    assert.deepEqual(
      [row.onHand, row.avgDailyDemand, row.daysOfCover, row.reorderPoint, row.suggestedOrder, row.status],
      [12, 4.5, 2.7, 32, 83, "reorder-now"],
    );
  });
});

describe("notifications", () => {
  test("a manager can send a push", async () => {
    const res = await api
      .post("/api/notifications/send")
      .set("Authorization", M)
      .send({ title: "Stocktake", body: "Cycle count at 4pm, zone C" });
    assert.equal(res.status, 202);
    const last = push.outbox[push.outbox.length - 1];
    assert.equal(last.title, "Stocktake");
    assert.equal(last.topic, "all-staff");
  });
});
