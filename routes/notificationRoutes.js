const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { allowRoles } = require("../middleware/roleMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { sendNotification } = require("../controllers/notificationController");

const sendRules = [
  body("title").trim().isLength({ min: 1, max: 80 }).withMessage("is required (max 80 characters)"),
  body("body").trim().isLength({ min: 1, max: 240 }).withMessage("is required (max 240 characters)"),
  body("topic")
    .optional()
    .matches(/^[a-zA-Z0-9-_.~%]+$/)
    .withMessage("has invalid characters"),
  body("token").optional().isLength({ min: 20 }),
];

router.post("/send", allowRoles("manager"), sendRules, validateRequest, sendNotification);

module.exports = router;
