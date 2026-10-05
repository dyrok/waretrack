// Push notifications with two "drivers":
//   log - for development and tests. Keeps sent messages in an outbox array.
//   fcm - Firebase Cloud Messaging, using firebase-admin.
let driver = null;

const createLogDriver = (quiet = false) => {
  const outbox = [];
  return {
    name: "log",
    outbox,
    send: async (message) => {
      const record = { ...message, id: "log-" + (outbox.length + 1) };
      outbox.push(record);
      if (!quiet) console.log("PUSH:", record.title, "-", record.body);
      return { id: record.id, driver: "log" };
    },
  };
};

const createFcmDriver = () => {
  // Loaded only when needed, so development never touches Firebase.
  const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
  const { getMessaging } = require("firebase-admin/messaging");
  if (getApps().length === 0) initializeApp({ credential: applicationDefault() });
  const messaging = getMessaging();
  return {
    name: "fcm",
    send: async ({ title, body, topic, token, data = {} }) => {
      // FCM only accepts string values in data
      const stringData = {};
      for (const key of Object.keys(data)) stringData[key] = String(data[key]);
      const message = { notification: { title, body }, data: stringData };
      if (token) message.token = token;
      else message.topic = topic || "low-stock";
      const id = await messaging.send(message);
      return { id, driver: "fcm" };
    },
  };
};

const configurePush = (name, quiet = false) => {
  driver = name === "fcm" ? createFcmDriver() : createLogDriver(quiet);
  return driver;
};

const getPush = () => {
  if (!driver) driver = createLogDriver();
  return driver;
};

module.exports = { configurePush, getPush };
