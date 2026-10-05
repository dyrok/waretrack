const express = require("express");
const router = express.Router();
const { body, query, param } = require("express-validator");
const { allowRoles } = require("../middleware/roleMiddleware");
const validateRequest = require("../middleware/validateRequest");
const {
  getItems,
  getItemById,
  addItem,
  updateItem,
  deleteItem,
  searchItems,
} = require("../controllers/itemController");

const idRule = [param("id").isMongoId().withMessage("must be a valid id")];

// Rules for a new item: required fields, and defaults for the rest.
const createRules = [
  body("sku").trim().isLength({ min: 2, max: 40 }).withMessage("must be 2 to 40 characters"),
  body("name").trim().isLength({ min: 2, max: 120 }).withMessage("must be 2 to 120 characters"),
  body("barcode")
    .trim()
    .matches(/^\d{4,14}$/)
    .withMessage("must be 4 to 14 digits"),
  body("unit").default("unit").trim().isLength({ max: 20 }),
  body("reorderLevel").default(10).isInt({ min: 0 }).toInt(),
  body("unitCost").default(0).isFloat({ min: 0 }).toFloat(),
  body("perishable").default(false).isBoolean().toBoolean(),
];

// Rules for an update: every field is optional and there are no defaults,
// otherwise sending only reorderLevel would reset unit back to "unit".
const updateRules = [
  body("sku").optional().trim().isLength({ min: 2, max: 40 }),
  body("name").optional().trim().isLength({ min: 2, max: 120 }),
  body("barcode")
    .optional()
    .trim()
    .matches(/^\d{4,14}$/)
    .withMessage("must be 4 to 14 digits"),
  body("unit").optional().trim().isLength({ max: 20 }),
  body("reorderLevel").optional().isInt({ min: 0 }).toInt(),
  body("unitCost").optional().isFloat({ min: 0 }).toFloat(),
  body("perishable").optional().isBoolean().toBoolean(),
];

const listRules = [
  query("page").default(1).isInt({ min: 1 }).toInt(),
  query("limit").default(20).isInt({ min: 1, max: 100 }).toInt(),
];
const searchRules = [
  query("barcode").optional().trim().notEmpty(),
  query("q").optional().trim().isLength({ min: 2, max: 60 }).withMessage("must be 2 to 60 characters"),
];

// ORDER MATTERS: "/search" must come before "/:id",
// otherwise Express thinks "search" is an id.
router.get("/search", searchRules, validateRequest, searchItems);
router.get("/", listRules, validateRequest, getItems);
router.get("/:id", idRule, validateRequest, getItemById);
router.post("/", createRules, validateRequest, addItem);
router.put("/:id", allowRoles("manager"), idRule, updateRules, validateRequest, updateItem);
router.delete("/:id", allowRoles("manager"), idRule, validateRequest, deleteItem);

module.exports = router;
