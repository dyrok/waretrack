const Transaction = require("../models/Transaction");
const { receiveStock, shipStock, transferStock } = require("../services/stockService");

const receive = async (req, res, next) => {
  try {
    const { itemId, bin, quantity, expiresAt, reference } = req.valid.body;
    const result = await receiveStock({
      itemId,
      binCode: bin,
      quantity,
      expiresAt,
      reference,
      userId: req.user.userId,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const ship = async (req, res, next) => {
  try {
    const { itemId, quantity, bin, reference } = req.valid.body;
    const result = await shipStock({ itemId, quantity, binCode: bin, reference, userId: req.user.userId });
    res.status(201).json(result);
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const transfer = async (req, res, next) => {
  try {
    const { itemId, fromBin, toBin, quantity } = req.valid.body;
    const result = await transferStock({
      itemId,
      fromBinCode: fromBin,
      toBinCode: toBin,
      quantity,
      userId: req.user.userId,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const { page, limit, type, itemId, from, to } = req.valid.query;
    const filter = {};
    if (type) filter.type = type;
    if (itemId) filter.item = itemId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = to;
    }
    const data = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("item", "sku name")
      .populate("fromBin toBin", "code")
      .populate("user", "name role");
    const total = await Transaction.countDocuments(filter);
    res.json({ data, page, limit, total });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

module.exports = { receive, ship, transfer, getTransactions };
