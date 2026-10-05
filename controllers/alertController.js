const Alert = require("../models/Alert");
const { checkAllItems } = require("../services/alertService");
const { bus, EVENTS } = require("../socket/bus");

const getAlerts = async (req, res, next) => {
  try {
    const { status } = req.valid.query;
    const filter = status === "all" ? {} : { status };
    const data = await Alert.find(filter).populate("item", "sku name unit").sort({ createdAt: -1 });
    res.json({ data });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const runCheck = async (req, res, next) => {
  try {
    const { scanned, created, open } = await checkAllItems();
    res.json({ scanned, created, open: open.length });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const resolveAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }
    if (alert.status === "resolved") {
      return res.status(409).json({ message: "Alert already resolved" });
    }
    alert.status = "resolved";
    alert.resolvedBy = req.user.userId;
    alert.resolvedAt = new Date();
    alert.note = req.valid.body.note || null;
    await alert.save();
    bus.emit(EVENTS.ALERT_RESOLVED, { alertId: String(alert._id), itemId: String(alert.item), auto: false });
    res.json(alert);
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

module.exports = { getAlerts, runCheck, resolveAlert };
