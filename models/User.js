const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // We store a bcrypt HASH, never the password itself.
    // select: false means it is not loaded unless we ask for it.
    password: { type: String, default: null, select: false },
    role: { type: String, enum: ["staff", "manager"], default: "staff" },
    firebaseUid: { type: String, default: null },
  },
  { timestamps: true },
);

// Never send the password hash back in a response.
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
