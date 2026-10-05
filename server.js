const http = require("http");
const { connectDB } = require("./config/db");
const { config, checkConfig } = require("./config/config");
const { createApp } = require("./app");
const { attachSocket } = require("./socket/socket");
const { configurePush } = require("./services/pushService");

checkConfig();

const start = async () => {
  await connectDB();
  configurePush(config.PUSH_DRIVER);

  const app = createApp();
  // Socket.io needs the plain http server, so we create it ourselves
  // instead of calling app.listen().
  const server = http.createServer(app);
  attachSocket(server);

  server.listen(config.PORT, () => {
    console.log(`server is running on port ${config.PORT}`);
  });
};

start();
