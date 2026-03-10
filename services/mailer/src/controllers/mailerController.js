const { validateSendPayload } = require("../validators/sendValidator");
const { mailerService } = require("../services/mailerService");

async function send(req, res, next) {
  try {
    const payload = validateSendPayload(req.body);
    const result = await mailerService.sendEmail(payload);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { mailerController: { send } };
