const Item = require("../models/Item");
const Bin = require("../models/Bin");
const Stock = require("../models/Stock");
const Transaction = require("../models/Transaction");
const createError = require("http-errors");
const { bus, EVENTS } = require("../socket/bus");
const { checkItem } = require("./alertService");

// ------------------------------------------------------------------
// EVERY change to stock quantity happens in this file. Three rules:
//  1. Taking stock out uses a condition { quantity: { $gte: n } },
//     so two people can never ship the same last box.
//  2. Every change saves a Transaction (the ledger).
//  3. Every change ends with notify(): Socket.io + alert check.
// ------------------------------------------------------------------

const findItem = async (itemId) => {
  const item = await Item.findById(itemId);
  if (!item) throw createError(404, "Item not found");
  return item;
};

const findBin = async (code) => {
  const bin = await Bin.findOne({ code: code.toUpperCase(), active: true });
  if (!bin) throw createError(404, `Bin ${code} not found`);
  return bin;
};

// How many units are in a bin right now
const binLoad = async (binId) => {
  const rows = await Stock.aggregate([
    { $match: { bin: binId } },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]);
  return rows.length > 0 ? rows[0].total : 0;
};

const checkCapacity = async (bin, incoming) => {
  const used = await binLoad(bin._id);
  if (used + incoming > bin.capacity) {
    throw createError(409, `Bin ${bin.code} is full`, {
      code: "BIN_FULL",
      details: { capacity: bin.capacity, used, incoming },
    });
  }
};

// Lots are kept per DAY, so two deliveries with the same
// "best before" date go into the same lot.
const dayOnly = (date) => {
  if (!date) return null;
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// First Expired, First Out: soonest expiry first, no-expiry lots last,
// expired and empty lots are never picked.
const fefoOrder = (lots, now = new Date()) => {
  return lots
    .filter((lot) => lot.quantity > 0 && (!lot.expiresAt || lot.expiresAt >= now))
    .sort((a, b) => {
      if (!a.expiresAt && !b.expiresAt) return 0;
      if (!a.expiresAt) return 1;
      if (!b.expiresAt) return -1;
      return a.expiresAt - b.expiresAt;
    });
};

const notify = async (item, changes, transactions) => {
  for (const change of changes) {
    bus.emit(EVENTS.STOCK_CHANGED, {
      itemId: String(item._id),
      sku: item.sku,
      bin: change.bin,
      delta: change.delta,
    });
  }
  for (const tx of transactions) {
    bus.emit(EVENTS.TX_CREATED, { id: String(tx._id), type: tx.type, sku: item.sku, quantity: tx.quantity });
  }
  await checkItem(item._id);
};

// Take `quantity` out of the lots, in order. If someone else took stock
// at the same moment, put back what we took and ask the client to retry.
const takeFromLots = async (lots, quantity) => {
  const taken = [];
  let remaining = quantity;
  for (const lot of lots) {
    if (remaining === 0) break;
    const take = Math.min(remaining, lot.quantity);
    const result = await Stock.updateOne(
      { _id: lot._id, quantity: { $gte: take } },
      { $inc: { quantity: -take } },
    );
    if (result.modifiedCount === 0) {
      for (const t of taken) {
        await Stock.updateOne({ _id: t.lot._id }, { $inc: { quantity: t.take } });
      }
      throw createError(409, "Stock changed while processing, please retry", { code: "STOCK_CHANGED" });
    }
    taken.push({ lot, take });
    remaining -= take;
  }
  return taken;
};

const notEnoughStock = (available, requested) =>
  createError(409, "Not enough stock", { code: "INSUFFICIENT_STOCK", details: { available, requested } });

const receiveStock = async ({ itemId, binCode, quantity, expiresAt, reference, userId }) => {
  const item = await findItem(itemId);
  const bin = await findBin(binCode);
  const expiry = dayOnly(expiresAt);
  if (item.perishable && !expiry) {
    throw createError(400, `${item.name} is perishable, expiresAt is required`, { code: "EXPIRY_REQUIRED" });
  }
  await checkCapacity(bin, quantity);

  // Add to the lot, or create it if it does not exist yet (upsert).
  const lot = await Stock.findOneAndUpdate(
    { item: item._id, bin: bin._id, expiresAt: expiry },
    { $inc: { quantity } },
    { upsert: true, returnDocument: "after" },
  );
  const transaction = await Transaction.create({
    type: "RECEIVE",
    item: item._id,
    toBin: bin._id,
    quantity,
    expiresAt: expiry,
    reference,
    unitCost: item.unitCost,
    user: userId,
  });
  await notify(item, [{ bin: bin.code, delta: quantity }], [transaction]);
  return { lot, transaction };
};

const shipStock = async ({ itemId, quantity, binCode, reference, userId }) => {
  const item = await findItem(itemId);
  const filter = { item: item._id };
  if (binCode) filter.bin = (await findBin(binCode))._id;

  const lots = fefoOrder(await Stock.find(filter).populate("bin", "code"));
  const available = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  if (available < quantity) throw notEnoughStock(available, quantity);

  const taken = await takeFromLots(lots, quantity);
  const transactions = await Transaction.insertMany(
    taken.map(({ lot, take }) => ({
      type: "SHIP",
      item: item._id,
      fromBin: lot.bin._id,
      quantity: take,
      expiresAt: lot.expiresAt,
      reference,
      unitCost: item.unitCost,
      user: userId,
    })),
  );
  await Stock.deleteMany({ item: item._id, quantity: 0 });
  await notify(
    item,
    taken.map(({ lot, take }) => ({ bin: lot.bin.code, delta: -take })),
    transactions,
  );
  return {
    shipped: quantity,
    picks: taken.map(({ lot, take }) => ({ bin: lot.bin.code, expiresAt: lot.expiresAt, quantity: take })),
    transactions,
  };
};

const transferStock = async ({ itemId, fromBinCode, toBinCode, quantity, userId }) => {
  if (fromBinCode.toUpperCase() === toBinCode.toUpperCase()) {
    throw createError(400, "fromBin and toBin must be different", { code: "SAME_BIN" });
  }
  const item = await findItem(itemId);
  const fromBin = await findBin(fromBinCode);
  const toBin = await findBin(toBinCode);
  await checkCapacity(toBin, quantity);

  const lots = fefoOrder(await Stock.find({ item: item._id, bin: fromBin._id }));
  const available = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  if (available < quantity) throw notEnoughStock(available, quantity);

  const taken = await takeFromLots(lots, quantity);
  // Same expiry date in the new bin: moving milk does not make it fresher.
  for (const { lot, take } of taken) {
    await Stock.findOneAndUpdate(
      { item: item._id, bin: toBin._id, expiresAt: lot.expiresAt },
      { $inc: { quantity: take } },
      { upsert: true },
    );
  }
  const transactions = await Transaction.insertMany(
    taken.map(({ lot, take }) => ({
      type: "TRANSFER",
      item: item._id,
      fromBin: fromBin._id,
      toBin: toBin._id,
      quantity: take,
      expiresAt: lot.expiresAt,
      unitCost: item.unitCost,
      user: userId,
    })),
  );
  await Stock.deleteMany({ item: item._id, quantity: 0 });
  await notify(
    item,
    [
      { bin: fromBin.code, delta: -quantity },
      { bin: toBin.code, delta: quantity },
    ],
    transactions,
  );
  return { moved: quantity, from: fromBin.code, to: toBin.code, transactions };
};

// Stock count / write-off: set a lot to the counted quantity and
// save the difference in the ledger.
const adjustStock = async ({ stockId, quantity, reason, userId }) => {
  const lot = await Stock.findById(stockId).populate("bin", "code");
  if (!lot) throw createError(404, "Stock record not found");
  const item = await findItem(lot.item);
  const difference = quantity - lot.quantity;
  if (difference === 0) return { lot, transaction: null };

  // Only update if nobody changed the lot since we read it.
  const result = await Stock.updateOne({ _id: lot._id, quantity: lot.quantity }, { $set: { quantity } });
  if (result.modifiedCount === 0) {
    throw createError(409, "Stock changed while processing, please retry", { code: "STOCK_CHANGED" });
  }
  const transaction = await Transaction.create({
    type: "ADJUST",
    item: item._id,
    fromBin: difference < 0 ? lot.bin._id : null,
    toBin: difference > 0 ? lot.bin._id : null,
    quantity: difference,
    expiresAt: lot.expiresAt,
    reason,
    unitCost: item.unitCost,
    user: userId,
  });
  await notify(item, [{ bin: lot.bin.code, delta: difference }], [transaction]);
  return { lot: await Stock.findById(lot._id), transaction };
};

module.exports = { fefoOrder, receiveStock, shipStock, transferStock, adjustStock };
