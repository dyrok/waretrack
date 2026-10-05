const Item = require("../models/Item");
const Stock = require("../models/Stock");
const { onHandByItem } = require("../services/alertService");

// Makes user text safe to use inside a RegExp (".*" becomes "\.\*")
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getItems = async (req, res, next) => {
  try {
    const { page, limit } = req.valid.query;
    const items = await Item.find()
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await Item.countDocuments();
    const totals = await onHandByItem(items.map((item) => item._id));
    const data = items.map((item) => ({ ...item.toJSON(), onHand: totals.get(String(item._id)) || 0 }));
    res.json({ data, page, limit, total });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const getItemById = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    const lots = await Stock.find({ item: item._id, quantity: { $gt: 0 } })
      .populate("bin", "code zone")
      .sort({ expiresAt: 1 });
    const onHand = lots.reduce((sum, lot) => sum + lot.quantity, 0);
    res.json({ ...item.toJSON(), onHand, lots });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const addItem = async (req, res, next) => {
  try {
    const item = await Item.create(req.valid.body);
    res.status(201).json(item);
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const updateItem = async (req, res, next) => {
  try {
    if (Object.keys(req.valid.body).length === 0) {
      return res.status(400).json({ message: "Send at least one field to update" });
    }
    const item = await Item.findByIdAndUpdate(req.params.id, req.valid.body, {
      returnDocument: "after",
      runValidators: true,
    });
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.json(item);
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const deleteItem = async (req, res, next) => {
  try {
    const hasStock = await Stock.exists({ item: req.params.id, quantity: { $gt: 0 } });
    if (hasStock) {
      return res.status(409).json({ message: "Item still has stock. Ship or adjust it to zero first." });
    }
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.json({ message: "Item deleted" });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

// ?barcode= exact match (scanner), ?q= name or SKU contains the text
const searchItems = async (req, res, next) => {
  try {
    const { barcode, q } = req.valid.query;
    if (barcode) {
      const item = await Item.findOne({ barcode });
      if (!item) {
        return res.status(404).json({ message: `No item with barcode ${barcode}` });
      }
      const totals = await onHandByItem([item._id]);
      return res.json({ data: [{ ...item.toJSON(), onHand: totals.get(String(item._id)) || 0 }] });
    }
    if (!q) {
      return res.status(400).json({ message: "Use ?barcode= or ?q=" });
    }
    const pattern = new RegExp(escapeRegex(q), "i");
    const items = await Item.find({ $or: [{ name: pattern }, { sku: pattern }] }).limit(25);
    res.json({ data: items });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

module.exports = { getItems, getItemById, addItem, updateItem, deleteItem, searchItems };
