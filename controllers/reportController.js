const Transaction = require("../models/Transaction");
const Stock = require("../models/Stock");
const Item = require("../models/Item");
const { onHandByItem } = require("../services/alertService");

const DAY = 24 * 60 * 60 * 1000;

// First day of the month, `n` months ago (0 = this month)
const monthsAgo = (n) => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
const round = (num, places = 2) => Math.round(num * 10 ** places) / 10 ** places;

// ------------------------------------------------------------------
// TURNOVER = units shipped / average units on hand.
// We know the stock NOW (closing) and every movement (the ledger),
// so: opening = closing - net movement.
// ------------------------------------------------------------------
const getTurnover = async (req, res, next) => {
  try {
    const { months } = req.valid.query;
    const since = monthsAgo(months - 1);

    const monthly = await Transaction.aggregate([
      { $match: { type: "SHIP", createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          unitsShipped: { $sum: "$quantity" },
          costOfGoods: { $sum: { $multiply: ["$quantity", "$unitCost"] } },
          shipments: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: "$_id", unitsShipped: 1, costOfGoods: 1, shipments: 1 } },
    ]);

    const perItem = await Transaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$item",
          shipped: { $sum: { $cond: [{ $eq: ["$type", "SHIP"] }, "$quantity", 0] } },
          net: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $eq: ["$type", "RECEIVE"] }, then: "$quantity" },
                  { case: { $eq: ["$type", "SHIP"] }, then: { $multiply: ["$quantity", -1] } },
                  { case: { $eq: ["$type", "ADJUST"] }, then: "$quantity" },
                ],
                default: 0, // TRANSFER only moves stock, the total stays the same
              },
            },
          },
        },
      },
      { $lookup: { from: "items", localField: "_id", foreignField: "_id", as: "item" } },
      { $unwind: "$item" },
    ]);

    const closing = await onHandByItem(perItem.map((row) => row._id));
    const items = perItem.map((row) => {
      const closingUnits = closing.get(String(row._id)) || 0;
      const openingUnits = closingUnits - row.net;
      const average = (openingUnits + closingUnits) / 2;
      return {
        sku: row.item.sku,
        name: row.item.name,
        unitsShipped: row.shipped,
        openingUnits,
        closingUnits,
        averageUnits: round(average),
        turnover: average > 0 ? round(row.shipped / average) : null,
      };
    });
    items.sort((a, b) => (b.turnover ?? -1) - (a.turnover ?? -1));

    res.json({ since, months, monthly, items });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

// ------------------------------------------------------------------
// WASTE = stock written off (ADJUST with a loss reason)
//       + expired stock that is still sitting in a bin.
// ------------------------------------------------------------------
const getWaste = async (req, res, next) => {
  try {
    const { months } = req.valid.query;
    const since = monthsAgo(months - 1);

    const writtenOff = await Transaction.aggregate([
      {
        $match: {
          type: "ADJUST",
          quantity: { $lt: 0 },
          reason: { $in: ["expired", "damaged", "lost"] },
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: "$reason",
          units: { $sum: { $abs: "$quantity" } },
          cost: { $sum: { $multiply: [{ $abs: "$quantity" }, "$unitCost"] } },
          events: { $sum: 1 },
        },
      },
      { $sort: { cost: -1 } },
      { $project: { _id: 0, reason: "$_id", units: 1, cost: 1, events: 1 } },
    ]);

    const expiredOnHand = await Stock.aggregate([
      { $match: { quantity: { $gt: 0 }, expiresAt: { $ne: null, $lt: new Date() } } },
      { $lookup: { from: "items", localField: "item", foreignField: "_id", as: "item" } },
      { $unwind: "$item" },
      { $lookup: { from: "bins", localField: "bin", foreignField: "_id", as: "bin" } },
      { $unwind: "$bin" },
      {
        $project: {
          _id: 0,
          stockId: "$_id",
          sku: "$item.sku",
          name: "$item.name",
          bin: "$bin.code",
          expiresAt: 1,
          units: "$quantity",
          cost: { $multiply: ["$quantity", "$item.unitCost"] },
        },
      },
      { $sort: { expiresAt: 1 } },
    ]);

    const totalCost = (rows) => round(rows.reduce((sum, row) => sum + row.cost, 0));
    res.json({
      since,
      writtenOff,
      expiredOnHand,
      totals: { writtenOffCost: totalCost(writtenOff), expiredOnHandCost: totalCost(expiredOnHand) },
    });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

// ------------------------------------------------------------------
// FORECAST: simple moving average of daily demand.
// Easy to explain, and the baseline any clever model must beat.
// ------------------------------------------------------------------
const getForecast = async (req, res, next) => {
  try {
    const { days, leadTimeDays, coverDays } = req.valid.query;
    const since = new Date(Date.now() - days * DAY);

    const demand = await Transaction.aggregate([
      { $match: { type: "SHIP", createdAt: { $gte: since } } },
      { $group: { _id: "$item", shipped: { $sum: "$quantity" } } },
    ]);
    const shippedByItem = new Map();
    for (const row of demand) shippedByItem.set(String(row._id), row.shipped);

    const items = await Item.find();
    const onHand = await onHandByItem(items.map((item) => item._id));

    const rows = items.map((item) => {
      const avgDaily = (shippedByItem.get(String(item._id)) || 0) / days;
      const stock = onHand.get(String(item._id)) || 0;
      const daysOfCover = avgDaily > 0 ? stock / avgDaily : null;
      const reorderPoint = Math.ceil(avgDaily * leadTimeDays);
      const suggestedOrder = Math.max(0, Math.ceil(avgDaily * (leadTimeDays + coverDays)) - stock);
      let status = "ok";
      if (avgDaily === 0) status = "no-demand";
      else if (stock <= reorderPoint) status = "reorder-now";
      else if (daysOfCover < leadTimeDays + coverDays) status = "reorder-soon";
      return {
        sku: item.sku,
        name: item.name,
        onHand: stock,
        avgDailyDemand: round(avgDaily, 3),
        daysOfCover: daysOfCover === null ? null : round(daysOfCover, 1),
        reorderPoint,
        suggestedOrder,
        status,
      };
    });
    rows.sort((a, b) => (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity));

    res.json({ method: "simple-moving-average", days, leadTimeDays, coverDays, items: rows });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

module.exports = { getTurnover, getWaste, getForecast };
