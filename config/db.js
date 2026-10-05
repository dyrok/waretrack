const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/WareTrackDB");
    console.log("MongoDB Connected");
  } catch (error) {
    console.log("Database connection failed " + error.message);
    process.exit(1);
  }
};

module.exports = { connectDB };
