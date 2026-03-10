const express = require("express");
const { mailerController } = require("../controllers/mailerController");

const router = express.Router();

router.post("/send", mailerController.send);

module.exports = { mailerRoutes: router };
