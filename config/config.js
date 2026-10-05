// All settings in one place. Values come from the .env file.
const config = {
  PORT: process.env.PORT || 8000,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",
  PUSH_DRIVER: process.env.PUSH_DRIVER || "log",
};

// Called once from server.js. Stop right away if the secret is missing,
// instead of failing later on the first login.
const checkConfig = () => {
  if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
    console.log("JWT_SECRET is missing or shorter than 32 characters. Check your .env file.");
    process.exit(1);
  }
  if (!["log", "fcm"].includes(config.PUSH_DRIVER)) {
    console.log("PUSH_DRIVER must be log or fcm");
    process.exit(1);
  }
};

module.exports = { config, checkConfig };
