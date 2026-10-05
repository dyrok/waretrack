// allowRoles("manager") lets only managers through.
// Use it AFTER authMiddleware, because it reads req.user.
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to do this",
      });
    }
    next();
  };
};

module.exports = { allowRoles };
