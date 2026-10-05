const express = require("express");
const router = express.Router();
const { body, query, param } = require("express-validator");
const { allowRoles } = require("../middleware/roleMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { ADJUST_REASONS } = require("../models/Transaction");
const { getInventory, getLowStock, adjustInventory } = require("../controllers/inventoryController");

const listRules = [
  query("itemId").optional().isMongoId(),
  query("bin").optional().trim().isLength({ max: 20 }),
  query("expiringWithinDays").optional().isInt({ min: 0, max: 365 }).toInt(),
];
const adjustRules = [
  param("id").isMongoId().withMessage("must be a valid id"),
  body("quantity").isInt({ min: 0 }).withMessage("must be a whole number, 0 or more").toInt(),
  body("reason")
    .isIn(ADJUST_REASONS)
    .withMessage(`must be one of: ${ADJUST_REASONS.join(", ")}`),
];

router.get("/", listRules, validateRequest, getInventory);
router.get("/low-stock", getLowStock);
router.put("/:id", allowRoles("manager"), adjustRules, validateRequest, adjustInventory);

module.exports = router;
