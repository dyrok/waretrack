const express = require("express");
const router = express.Router();
const { body, query } = require("express-validator");
const { allowRoles } = require("../middleware/roleMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { TX_TYPES } = require("../models/Transaction");
const { receive, ship, transfer, getTransactions } = require("../controllers/transactionController");

const itemIdRule = body("itemId").isMongoId().withMessage("must be a valid id");
const quantityRule = body("quantity")
  .isInt({ min: 1 })
  .withMessage("must be a whole number, 1 or more")
  .toInt();

const receiveRules = [
  itemIdRule,
  body("bin").trim().isLength({ min: 1, max: 20 }).withMessage("is required"),
  quantityRule,
  body("expiresAt").optional().isISO8601().withMessage("must be a date like 2026-10-12").toDate(),
  body("reference").optional().trim().isLength({ max: 60 }),
];
const shipRules = [
  itemIdRule,
  quantityRule,
  body("bin").optional().trim().isLength({ max: 20 }),
  body("reference").optional().trim().isLength({ max: 60 }),
];
const transferRules = [
  itemIdRule,
  body("fromBin").trim().isLength({ min: 1, max: 20 }).withMessage("is required"),
  body("toBin").trim().isLength({ min: 1, max: 20 }).withMessage("is required"),
  quantityRule,
];
const listRules = [
  query("page").default(1).isInt({ min: 1 }).toInt(),
  query("limit").default(20).isInt({ min: 1, max: 100 }).toInt(),
  query("type").optional().isIn(TX_TYPES),
  query("itemId").optional().isMongoId(),
  query("from").optional().isISO8601().toDate(),
  query("to").optional().isISO8601().toDate(),
];

router.post("/receive", receiveRules, validateRequest, receive);
router.post("/ship", shipRules, validateRequest, ship);
router.post("/transfer", allowRoles("manager"), transferRules, validateRequest, transfer);
router.get("/", listRules, validateRequest, getTransactions);

module.exports = router;
