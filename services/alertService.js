const mongoose = require("mongoose");
const Alert = require("../models/Alert");
const Item = require("../models/Item");
const Stock = require("../models/Stock");
const { bus, EVENTS } = require("../socket/bus");
const { getPush } = require("./pushService");

// Total quantity on hand for each item (all bins, all lots).
// Returns a Map: itemId -> total
const onHandByItem = async (itemIds) => {
  const match = {};
  if (itemIds) {
    match.item = { $in: itemIds.map((id) => new mongoose.Types.ObjectId(id)) };
  }
  const rows = await Stock.aggregate([
    { $match: match },
    { $group: { _id: "$item", onHand: { $sum: "$quantity" } } },
  ]);
  const totals = new Map();
  for (const row of rows) totals.set(String(row._id), row.onHand);
  return totals;
};

// Check ONE item: open an alert if it is below its reorder level,
// or close the open alert if the stock came back.
const checkItem = async (itemId) => {
  const item = await Item.findById(itemId);
  if (!item) return { alert: null, created: false };
  const totals = await onHandByItem([itemId]);
  const onHand = totals.get(String(itemId)) || 0;

  if (onHand < item.reorderLevel) {
    // "Update the open alert, or create it if there is none" in ONE step.
    // lastErrorObject.updatedExisting tells us which one happened.
    const result = await Alert.findOneAndUpdate(
      { item: item._id, type: "LOW_STOCK", status: "open" },
      { $set: { onHand, threshold: item.reorderLevel } },
      { upsert: true, returnDocument: "after", includeResultMetadata: true },
    );
    const created = !result.lastErrorObject.updatedExisting;
    const alert = result.value;

    // Only a NEW alert is announced. Dropping further just updates the numbers.
    if (created) {
      const payload = {
        alertId: String(alert._id),
        itemId: String(item._id),
        sku: item.sku,
        name: item.name,
        onHand,
        threshold: item.reorderLevel,
      };
      bus.emit(EVENTS.LOW_STOCK, payload);
      await getPush().send({
        title: "Low stock: " + item.name,
        body: `${onHand} ${item.unit} left (reorder level ${item.reorderLevel})`,
        topic: "low-stock",
        data: payload,
      });
    }
    return { alert, created };
  }

  // Stock is fine again: close any open alert automatically.
  const resolved = await Alert.updateMany(
    { item: item._id, type: "LOW_STOCK", status: "open" },
    { $set: { status: "resolved", resolvedAt: new Date(), note: "auto: stock recovered", onHand } },
  );
  if (resolved.modifiedCount > 0) {
    bus.emit(EVENTS.ALERT_RESOLVED, { itemId: String(item._id), auto: true });
  }
  return { alert: null, created: false };
};

// Check EVERY item. Used by POST /api/alerts/check and GET /api/inventory/low-stock.
const checkAllItems = async () => {
  const items = await Item.find({}, { _id: 1 });
  let created = 0;
  for (const item of items) {
    const result = await checkItem(item._id);
    if (result.created) created++;
  }
  const open = await Alert.find({ status: "open" }).populate("item", "sku name unit").sort({ createdAt: -1 });
  return { scanned: items.length, created, open };
};

module.exports = { onHandByItem, checkItem, checkAllItems };
