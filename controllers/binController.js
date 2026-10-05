const Bin = require("../models/Bin");
const Stock = require("../models/Stock");

// Units stored in each bin. Returns a Map: binId -> used
const usedByBin = async () => {
  const rows = await Stock.aggregate([{ $group: { _id: "$bin", used: { $sum: "$quantity" } } }]);
  const used = new Map();
  for (const row of rows) used.set(String(row._id), row.used);
  return used;
};

const getBins = async (req, res, next) => {
  try {
    const bins = await Bin.find().sort({ code: 1 });
    const used = await usedByBin();
    const data = bins.map((bin) => {
      const inBin = used.get(String(bin._id)) || 0;
      return {
        ...bin.toJSON(),
        used: inBin,
        free: bin.capacity - inBin,
        utilisation: Number((inBin / bin.capacity).toFixed(3)),
      };
    });
    res.json({ data });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const getBinById = async (req, res, next) => {
  try {
    const bin = await Bin.findById(req.params.id);
    if (!bin) {
      return res.status(404).json({ message: "Bin not found" });
    }
    const lots = await Stock.find({ bin: bin._id, quantity: { $gt: 0 } }).populate("item", "sku name unit");
    const used = lots.reduce((sum, lot) => sum + lot.quantity, 0);
    res.json({ ...bin.toJSON(), used, free: bin.capacity - used, lots });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const addBin = async (req, res, next) => {
  try {
    const bin = await Bin.create(req.valid.body);
    res.status(201).json(bin);
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const updateBin = async (req, res, next) => {
  try {
    if (Object.keys(req.valid.body).length === 0) {
      return res.status(400).json({ message: "Send at least one field to update" });
    }
    const bin = await Bin.findById(req.params.id);
    if (!bin) {
      return res.status(404).json({ message: "Bin not found" });
    }
    const { capacity } = req.valid.body;
    if (capacity !== undefined) {
      const used = (await usedByBin()).get(String(bin._id)) || 0;
      if (capacity < used) {
        return res
          .status(409)
          .json({ message: `Capacity ${capacity} is less than the ${used} units inside` });
      }
    }
    Object.assign(bin, req.valid.body);
    await bin.save();
    res.json(bin);
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

module.exports = { getBins, getBinById, addBin, updateBin };
