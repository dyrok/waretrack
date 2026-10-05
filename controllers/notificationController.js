const { getPush } = require("../services/pushService");

const sendNotification = async (req, res, next) => {
  try {
    const { title, body, topic, token } = req.valid.body;
    if (topic && token) {
      return res.status(400).json({ message: "Send topic OR token, not both" });
    }
    const result = await getPush().send({
      title,
      body,
      topic: token ? undefined : topic || "all-staff",
      token,
    });
    res.status(202).json(result);
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

module.exports = { sendNotification };
