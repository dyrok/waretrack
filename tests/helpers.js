// Settings for tests. They must be set BEFORE app.js is loaded.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123";
process.env.JWT_EXPIRES_IN = "1h";

const mongoose = require("mongoose");
const request = require("supertest");
const { createApp } = require("../app");
const { configurePush } = require("../services/pushService");

const BASE_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017";

// Every test file gets its own empty database.
const setup = async (name, options = {}) => {
  await mongoose.connect(`${BASE_URI}/waretrack_test_${name}`);
  await mongoose.connection.dropDatabase();
  for (const model of Object.values(mongoose.models)) await model.syncIndexes();
  const push = configurePush("log", true);
  const app = createApp(options);
  return { app, push, api: request(app) };
};

const teardown = () => mongoose.disconnect();

const register = async (api, name, email, role) => {
  const res = await api.post("/api/auth/register").send({ name, email, password: "password123", role });
  return { token: res.body.token, user: res.body.user, res };
};

// A manager (the first user) and a staff user
const twoUsers = async (api) => {
  const manager = await register(api, "Maya Manager", "maya@wt.test");
  const staff = await register(api, "Sam Staff", "sam@wt.test");
  return { manager, staff, M: "Bearer " + manager.token, S: "Bearer " + staff.token };
};

module.exports = { setup, teardown, register, twoUsers };
