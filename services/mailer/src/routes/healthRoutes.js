const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    service: "mailer",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

module.exports = { healthRoutes: router };
