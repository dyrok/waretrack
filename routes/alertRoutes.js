const express = require("express");
const router = express.Router();
const { body, query, param } = require("express-validator");
const { allowRoles } = require("../middleware/roleMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { getAlerts, runCheck, resolveAlert } = require("../controllers/alertController");

const listRules = [query("status").default("open").isIn(["open", "resolved", "all"])];
const resolveRules = [
  param("id").isMongoId().withMessage("must be a valid id"),
  body("note").optional().trim().isLength({ max: 200 }),
];

router.get("/", listRules, validateRequest, getAlerts);
router.post("/check", runCheck);
router.put("/:id/resolve", allowRoles("manager"), resolveRules, validateRequest, resolveAlert);

module.exports = router;
