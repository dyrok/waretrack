const mongoose = require("mongoose");

// An Item is WHAT a product is. How many we have, and where,
// is stored in Stock (see Stock.js).
const itemSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    barcode: { type: String, required: true, unique: true, trim: true },
    unit: { type: String, default: "unit" },
    reorderLevel: { type: Number, default: 10, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    perishable: { type: Boolean, default: false },
  },
  { timestamps: true },
);

itemSchema.index({ name: 1 });

module.exports = mongoose.model("Item", itemSchema);
