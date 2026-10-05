const mongoose = require("mongoose");

// One Stock document = one "lot": some quantity of ONE item,
// in ONE bin, with ONE expiry date.
const stockSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    bin: { type: mongoose.Schema.Types.ObjectId, ref: "Bin", required: true },
    expiresAt: { type: Date, default: null },
    quantity: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

// Only one lot for each (item, bin, expiry) combination.
stockSchema.index({ item: 1, bin: 1, expiresAt: 1 }, { unique: true });
stockSchema.index({ bin: 1 });

module.exports = mongoose.model("Stock", stockSchema);
