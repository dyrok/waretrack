// No route matched the request
const notFound = (req, res) => {
  res.status(404).json({ message: `No route for ${req.method} ${req.path}` });
};

// Every error ends up here: from controllers (next(error)) and from Express itself.
// Express knows this is an error handler because it has 4 parameters.
// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Body is not valid JSON" });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ message: "Invalid id", code: "BAD_ID" });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: "This record already exists", code: "DUPLICATE" });
  }
  // Errors made with http-errors (createError(409, ...)) are safe to show the user.
  if (error.expose) {
    return res
      .status(error.status)
      .json({ message: error.message, code: error.code, details: error.details });
  }
  // Anything else is a bug: log it, but never send the details to the user.
  console.log(error);
  res.status(500).json({ message: "Something went wrong" });
};

module.exports = { notFound, errorHandler };
