const express = require("express");

const { healthRoutes } = require("./routes/healthRoutes");
const { mailerRoutes } = require("./routes/mailerRoutes");
const { errorHandler, createHttpError } = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.use(healthRoutes);
  app.use(mailerRoutes);

  app.use((req, res, next) => {
    next(
      createHttpError({
        status: 404,
        code: "NOT_FOUND",
        message: "Not found"
      })
    );
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
