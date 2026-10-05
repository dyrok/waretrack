const Stock = require("../models/Stock");
const Bin = require("../models/Bin");
const { checkAllItems } = require("../services/alertService");
const { adjustStock } = require("../services/stockService");

const getInventory = async (req, res, next) => {
  try {
    const { itemId, bin, expiringWithinDays } = req.valid.query;
    const filter = { quantity: { $gt: 0 } };
    if (itemId) filter.item = itemId;
    if (bin) {
      const found = await Bin.findOne({ code: bin.toUpperCase() });
      if (!found) {
        return res.status(404).json({ message: `Bin ${bin} not found` });
      }
      filter.bin = found._id;
    }
    if (expiringWithinDays !== undefined) {
      const limitDate = new Date(Date.now() + expiringWithinDays * 24 * 60 * 60 * 1000);
      filter.expiresAt = { $ne: null, $lte: limitDate };
    }
    const lots = await Stock.find(filter)
      .populate("item", "sku name unit")
      .populate("bin", "code zone")
      .sort({ expiresAt: 1 });
    res.json({ data: lots, total: lots.length });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

// Step 3 of the case study flow: reading low stock also RUNS the check,
// so a push notification goes out for any item that just became low.
const getLowStock = async (req, res, next) => {
  try {
    const { open, created } = await checkAllItems();
    const data = open.map((alert) => ({
      alertId: alert._id,
      item: alert.item,
      onHand: alert.onHand,
      reorderLevel: alert.threshold,
      shortBy: alert.threshold - alert.onHand,
    }));
    res.json({ data, newlyAlerted: created });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

// Stock count: send the quantity you COUNTED, not the difference.
const adjustInventory = async (req, res, next) => {
  try {
    const { quantity, reason } = req.valid.body;
    const result = await adjustStock({ stockId: req.params.id, quantity, reason, userId: req.user.userId });
    res.json(result);
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

module.exports = { getInventory, getLowStock, adjustInventory };
