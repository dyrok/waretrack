const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { rateLimit } = require("express-rate-limit");
const authMiddleware = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { register, login, firebaseLogin, getMe } = require("../controllers/authController");

// At most 20 tries per 15 minutes from one IP address, so nobody can
// guess passwords all day. Switched off in tests, which log in a lot.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { message: "Too many attempts, try again later" },
  skip: () => process.env.NODE_ENV === "test",
});

const registerRules = [
  body("name").trim().isLength({ min: 2, max: 80 }).withMessage("must be 2 to 80 characters"),
  body("email").trim().isEmail().withMessage("must be a valid email").toLowerCase(),
  body("password").isLength({ min: 8, max: 72 }).withMessage("must be 8 to 72 characters"),
  body("role").optional().isIn(["staff", "manager"]).withMessage("must be staff or manager"),
];
const loginRules = [
  body("email").trim().isEmail().withMessage("must be a valid email").toLowerCase(),
  body("password").notEmpty().withMessage("is required"),
];
const firebaseRules = [body("idToken").isLength({ min: 20 }).withMessage("is required")];

router.post("/register", authLimiter, registerRules, validateRequest, register);
router.post("/login", authLimiter, loginRules, validateRequest, login);
router.post("/firebase", authLimiter, firebaseRules, validateRequest, firebaseLogin);
router.get("/me", authMiddleware, getMe);

module.exports = router;
