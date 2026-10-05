const mongoose = require("mongoose");

// The ledger: every stock movement is saved here and NEVER edited.
// A mistake is fixed with a new ADJUST transaction.
const TX_TYPES = ["RECEIVE", "SHIP", "TRANSFER", "ADJUST"];
const ADJUST_REASONS = ["count", "expired", "damaged", "lost", "found"];

const transactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TX_TYPES, required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    fromBin: { type: mongoose.Schema.Types.ObjectId, ref: "Bin", default: null },
    toBin: { type: mongoose.Schema.Types.ObjectId, ref: "Bin", default: null },
    // Positive for RECEIVE, SHIP and TRANSFER. Can be negative for ADJUST.
    quantity: { type: Number, required: true },
    expiresAt: { type: Date, default: null },
    reason: { type: String, enum: [...ADJUST_REASONS, null], default: null },
    reference: { type: String, default: null },
    unitCost: { type: Number, default: 0 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

transactionSchema.index({ type: 1, createdAt: -1 });
transactionSchema.index({ item: 1, createdAt: -1 });

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
module.exports.TX_TYPES = TX_TYPES;
module.exports.ADJUST_REASONS = ADJUST_REASONS;
