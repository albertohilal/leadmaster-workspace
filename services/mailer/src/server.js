require("dotenv").config();

const { createApp } = require("./app");
const { logger } = require("./utils/logger");

const port = Number(process.env.MAILER_PORT || 3005);

async function start() {
  const app = createApp();

  app.listen(port, () => {
    logger.info(`listening on port ${port}`);
  });
}

start().catch((err) => {
  logger.error("failed to start server", { message: err && err.message });
  process.exit(1);
});
