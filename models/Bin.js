const mongoose = require("mongoose");

const binSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    zone: { type: String, default: "GENERAL", uppercase: true, trim: true },
    capacity: { type: Number, default: 1000, min: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Bin", binSchema);
