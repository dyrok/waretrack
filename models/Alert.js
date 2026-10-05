const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["LOW_STOCK"], default: "LOW_STOCK" },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    onHand: { type: Number, required: true },
    threshold: { type: Number, required: true },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    note: { type: String, default: null },
  },
  { timestamps: true },
);

alertSchema.index({ item: 1, type: 1, status: 1 });

module.exports = mongoose.model("Alert", alertSchema);
