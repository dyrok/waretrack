const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, teardown, twoUsers } = require("./helpers");

let api, M, S, itemId;
before(async () => {
  ({ api } = await setup("items"));
  ({ M, S } = await twoUsers(api));
});
after(teardown);

describe("items", () => {
  test("add an item", async () => {
    const res = await api.post("/api/items").set("Authorization", S).send({
      sku: "milk-1l",
      name: "Whole Milk 1L",
      barcode: "12345",
      reorderLevel: 30,
      unitCost: 0.9,
      perishable: true,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.sku, "MILK-1L");
    itemId = res.body._id;
  });

  test("a duplicate barcode gives 409", async () => {
    const res = await api
      .post("/api/items")
      .set("Authorization", S)
      .send({ sku: "OTHER", name: "Other", barcode: "12345" });
    assert.equal(res.status, 409);
  });

  test("search by barcode works (and /search is not treated as an id)", async () => {
    const res = await api.get("/api/items/search?barcode=12345").set("Authorization", S);
    assert.equal(res.status, 200);
    assert.equal(res.body.data[0].sku, "MILK-1L");
    assert.equal(res.body.data[0].onHand, 0);
  });

  test("search by name escapes RegExp characters", async () => {
    assert.equal((await api.get("/api/items/search?q=milk").set("Authorization", S)).body.data.length, 1);
    assert.equal((await api.get("/api/items/search?q=.*").set("Authorization", S)).body.data.length, 0);
  });

  test("only managers can edit", async () => {
    const staffTry = await api.put(`/api/items/${itemId}`).set("Authorization", S).send({ reorderLevel: 5 });
    assert.equal(staffTry.status, 403);
    const ok = await api.put(`/api/items/${itemId}`).set("Authorization", M).send({ reorderLevel: 25 });
    assert.equal(ok.body.reorderLevel, 25);
  });

  test("bad id gives 400, missing id gives 404", async () => {
    assert.equal((await api.get("/api/items/not-an-id").set("Authorization", S)).status, 400);
    assert.equal((await api.get("/api/items/64b000000000000000000000").set("Authorization", S)).status, 404);
  });
});

describe("bins", () => {
  test("only managers add bins", async () => {
    assert.equal((await api.post("/api/bins").set("Authorization", S).send({ code: "A1" })).status, 403);
    const res = await api
      .post("/api/bins")
      .set("Authorization", M)
      .send({ code: "a1", zone: "cold", capacity: 500 });
    assert.equal(res.status, 201);
    assert.equal(res.body.code, "A1");
    assert.equal(res.body.zone, "COLD");
  });

  test("the bin list shows used and free space", async () => {
    const res = await api.get("/api/bins").set("Authorization", S);
    const bin = res.body.data[0];
    assert.equal(bin.code, "A1");
    assert.equal(bin.used, 0);
    assert.equal(bin.free, 500);
  });
});
