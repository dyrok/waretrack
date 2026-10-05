const express = require("express");
const router = express.Router();
const { body, param } = require("express-validator");
const { allowRoles } = require("../middleware/roleMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { getBins, getBinById, addBin, updateBin } = require("../controllers/binController");

const idRule = [param("id").isMongoId().withMessage("must be a valid id")];
const createRules = [
  body("code").trim().isLength({ min: 1, max: 20 }).withMessage("is required"),
  body("zone").default("GENERAL").trim().isLength({ max: 20 }),
  body("capacity").default(1000).isInt({ min: 1 }).toInt(),
];
const updateRules = [
  body("zone").optional().trim().isLength({ max: 20 }),
  body("capacity").optional().isInt({ min: 1 }).toInt(),
  body("active").optional().isBoolean().toBoolean(),
];

router.get("/", getBins);
router.get("/:id", idRule, validateRequest, getBinById);
router.post("/", allowRoles("manager"), createRules, validateRequest, addBin);
router.put("/:id", allowRoles("manager"), idRule, updateRules, validateRequest, updateBin);

module.exports = router;
