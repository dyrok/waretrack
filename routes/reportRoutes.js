const express = require("express");
const router = express.Router();
const { query } = require("express-validator");
const { allowRoles } = require("../middleware/roleMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { getTurnover, getWaste, getForecast } = require("../controllers/reportController");

const monthsRule = (defaultMonths) => [
  query("months").default(defaultMonths).isInt({ min: 1, max: 24 }).toInt(),
];
const forecastRules = [
  query("days").default(30).isInt({ min: 7, max: 365 }).toInt(), // history to look at
  query("leadTimeDays").default(7).isInt({ min: 1, max: 90 }).toInt(), // supplier delay
  query("coverDays").default(14).isInt({ min: 1, max: 90 }).toInt(), // how long an order should last
];

// Every report is for managers only
router.use(allowRoles("manager"));
router.get("/turnover", monthsRule(6), validateRequest, getTurnover);
router.get("/waste", monthsRule(3), validateRequest, getWaste);
router.get("/forecast", forecastRules, validateRequest, getForecast);

module.exports = router;
