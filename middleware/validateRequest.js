const { validationResult, matchedData } = require("express-validator");

// Put this after the express-validator checks in a route:
//   router.post("/receive", receiveRules, validateRequest, receive);
// If any check failed, answer 400 with every problem at once.
// Otherwise put the checked, converted values on req.valid.
const validateRequest = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      code: "VALIDATION",
      details: result.array().map((error) => `${error.path}: ${error.msg}`),
    });
  }
  req.valid = {
    body: matchedData(req, { locations: ["body"] }),
    query: matchedData(req, { locations: ["query"] }),
  };
  next();
};

module.exports = validateRequest;
