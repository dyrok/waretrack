const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, teardown, register } = require("./helpers");

const fakeFirebase = async (idToken) => {
  if (idToken !== "valid-firebase-token-xxxxxxxx") throw new Error("bad token");
  return { uid: "fb_123", email: "field@wt.test", name: "Field Worker" };
};

let api;
before(async () => {
  ({ api } = await setup("auth", { verifyFirebaseToken: fakeFirebase }));
});
after(teardown);

describe("auth", () => {
  test("the first user becomes manager and the password is never returned", async () => {
    const { res } = await register(api, "First", "first@wt.test");
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "manager");
    assert.equal(res.body.user.password, undefined);
    assert.match(res.body.token, /^eyJ/);
  });

  test("nobody can make themselves a manager", async () => {
    const res = await api
      .post("/api/auth/register")
      .send({ name: "Sneaky", email: "sneaky@wt.test", password: "password123", role: "manager" });
    assert.equal(res.status, 403);
    const plain = await register(api, "Plain", "plain@wt.test");
    assert.equal(plain.res.body.user.role, "staff");
  });

  test("a manager can create another manager", async () => {
    const login = await api.post("/api/auth/login").send({ email: "first@wt.test", password: "password123" });
    const res = await api
      .post("/api/auth/register")
      .set("Authorization", "Bearer " + login.body.token)
      .send({ name: "Second Boss", email: "boss2@wt.test", password: "password123", role: "manager" });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "manager");
  });

  test("wrong password and unknown email get the same message", async () => {
    const a = await api.post("/api/auth/login").send({ email: "first@wt.test", password: "nope-nope" });
    const b = await api.post("/api/auth/login").send({ email: "ghost@wt.test", password: "nope-nope" });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.message, b.body.message);
  });

  test("bad input is rejected by express-validator", async () => {
    const res = await api
      .post("/api/auth/register")
      .send({ name: "X", email: "not-an-email", password: "short" });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.details, [
      "name: must be 2 to 80 characters",
      "email: must be a valid email",
      "password: must be 8 to 72 characters",
    ]);
  });

  test("a Firebase ID token is exchanged for a WareTrack token", async () => {
    const res = await api.post("/api/auth/firebase").send({ idToken: "valid-firebase-token-xxxxxxxx" });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, "field@wt.test");
    assert.equal(res.body.user.role, "staff");
    assert.equal(res.body.user.firebaseUid, "fb_123");
    const bad = await api.post("/api/auth/firebase").send({ idToken: "forged-firebase-token-xxxxxx" });
    assert.equal(bad.status, 401);
  });

  test("protected routes need a valid token", async () => {
    assert.equal((await api.get("/api/items")).status, 401);
    assert.equal((await api.get("/api/items").set("Authorization", "Bearer garbage")).status, 401);
  });
});
