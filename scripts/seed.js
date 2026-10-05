// Fills the database with a realistic warehouse and six months of history,
// so every report has something to show.
// WARNING: it deletes everything in the database first.
const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Item = require("../models/Item");
const Bin = require("../models/Bin");
const Stock = require("../models/Stock");
const Transaction = require("../models/Transaction");
const Alert = require("../models/Alert");
const { checkAllItems } = require("../services/alertService");
const { configurePush } = require("../services/pushService");

// Faker makes the random numbers. faker.seed(42) means the SAME numbers
// on every run, so your screen matches the screenshots in the book.
faker.seed(42);
const randomInt = (min, max) => faker.number.int({ min, max });
const randomFloat = (min, max) => faker.number.float({ min, max });

const DAY = 24 * 60 * 60 * 1000;

// [sku, name, barcode, reorderLevel, unitCost, perishable, home bin, units sold per month]
const catalogue = [
  ["MILK-1L", "Whole Milk 1L", "12345", 60, 0.9, true, "C1", 180],
  ["YOG-500", "Greek Yogurt 500g", "12346", 40, 1.6, true, "C2", 90],
  ["RICE-5K", "Basmati Rice 5kg", "22001", 25, 6.5, false, "A1", 60],
  ["OIL-1L", "Sunflower Oil 1L", "22002", 30, 2.2, false, "A2", 70],
  ["TEA-250", "Assam Tea 250g", "22003", 20, 3.1, false, "B1", 35],
  ["SOAP-HW", "Hand Wash 250ml", "33001", 25, 1.4, false, "B2", 45],
  ["TAPE-48", "Packing Tape 48mm", "44001", 40, 0.7, false, "B2", 50],
  ["GLOVE-L", "Nitrile Gloves L (100)", "44002", 15, 5.9, false, "B1", 12],
];
// These two suppliers missed this month's delivery, so something is always low.
const LATE = ["TAPE-48", "YOG-500"];

const run = async () => {
  if (process.env.NODE_ENV === "production") {
    console.log("Refusing to seed a production database");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/WareTrackDB");
  await mongoose.connection.dropDatabase();
  for (const model of [User, Item, Bin, Stock, Transaction, Alert]) await model.syncIndexes();
  configurePush("log", true);

  const password = await bcrypt.hash("password123", 12);
  const [manager, staff] = await User.create([
    { name: "Maya Manager", email: "maya@waretrack.dev", password, role: "manager" },
    { name: "Sam Staff", email: "sam@waretrack.dev", password, role: "staff" },
  ]);

  const bins = await Bin.create([
    { code: "A1", zone: "DRY", capacity: 800 },
    { code: "A2", zone: "DRY", capacity: 800 },
    { code: "B1", zone: "DRY", capacity: 600 },
    { code: "B2", zone: "DRY", capacity: 600 },
    { code: "C1", zone: "COLD", capacity: 400 },
    { code: "C2", zone: "COLD", capacity: 400 },
  ]);
  const binByCode = {};
  for (const bin of bins) binByCode[bin.code] = bin;

  const now = Date.now();
  const ledger = [];
  const lots = [];

  for (const [sku, name, barcode, reorderLevel, unitCost, perishable, home, demand] of catalogue) {
    const item = await Item.create({ sku, name, barcode, reorderLevel, unitCost, perishable });
    const binId = binByCode[home]._id;
    let onHand = 0;

    for (let m = 5; m >= 0; m--) {
      const monthStart = now - (m + 1) * 30 * DAY;
      const isLate = m === 0 && LATE.includes(sku);
      const received = isLate ? 0 : Math.round(demand * (m === 5 ? 1.6 : 1));
      ledger.push({
        type: "RECEIVE",
        item: item._id,
        toBin: binId,
        quantity: received,
        unitCost,
        user: staff._id,
        createdAt: new Date(monthStart + DAY),
      });
      onHand += received;

      const share = m === 0 ? 0.5 : 1; // this month is only half over
      let left = Math.round(demand * share * randomFloat(0.8, 1.2));
      while (left > 0 && onHand > 0) {
        const q = Math.min(left, onHand, randomInt(5, 25));
        ledger.push({
          type: "SHIP",
          item: item._id,
          fromBin: binId,
          quantity: q,
          unitCost,
          user: staff._id,
          createdAt: new Date(monthStart + randomInt(2, 29) * DAY),
        });
        onHand -= q;
        left -= q;
      }
    }

    if (perishable) {
      // Never write off more than we have. The Stock schema's min: 0
      // caught exactly this bug in the first version of this script.
      const wasted = Math.min(randomInt(3, 8), onHand);
      ledger.push({
        type: "ADJUST",
        reason: "expired",
        item: item._id,
        fromBin: binId,
        quantity: -wasted,
        unitCost,
        user: manager._id,
        createdAt: new Date(now - randomInt(5, 40) * DAY),
      });
      onHand -= wasted;
      const soon = Math.floor(onHand / 2);
      lots.push({ item: item._id, bin: binId, quantity: soon, expiresAt: new Date(now + 3 * DAY) });
      lots.push({ item: item._id, bin: binId, quantity: onHand - soon, expiresAt: new Date(now + 18 * DAY) });
    } else {
      lots.push({ item: item._id, bin: binId, quantity: onHand, expiresAt: null });
    }
  }

  // History needs old dates, which the API would never accept,
  // so the seed writes it straight into the collections.
  await Transaction.collection.insertMany(
    ledger.map((t) => ({
      fromBin: null,
      toBin: null,
      reason: null,
      reference: "seed",
      expiresAt: null,
      ...t,
    })),
  );
  for (const lot of lots) {
    if (lot.expiresAt) lot.expiresAt.setUTCHours(0, 0, 0, 0);
  }
  await Stock.insertMany(lots);

  // We wrote Stock directly, so no service raised alerts. Do it now.
  const { open } = await checkAllItems();
  console.log(
    `Seeded ${catalogue.length} items, ${bins.length} bins, ${ledger.length} ledger entries, ${open.length} open alerts.`,
  );
  console.log(
    "Log in as maya@waretrack.dev / password123 (manager) or sam@waretrack.dev / password123 (staff).",
  );
  await mongoose.disconnect();
};

run();
