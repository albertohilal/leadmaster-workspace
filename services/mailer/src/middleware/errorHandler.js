function createHttpError({ status, code, message, details }) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (details !== undefined) err.details = details;
  return err;
}

function toErrorResponse(err) {
  const status = typeof err.status === "number" ? err.status : 500;
  const code = typeof err.code === "string" ? err.code : "INTERNAL_ERROR";
  const message = typeof err.message === "string" && err.message ? err.message : "Unexpected internal error";

  const body = { error: true, code, message };
  if (err.details !== undefined) body.details = err.details;

  return { status, body };
}

function errorHandler(err, req, res, _next) {
  if (err && err.type === "entity.parse.failed") {
    const { status, body } = toErrorResponse(
      createHttpError({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid JSON"
      })
    );
    return res.status(status).json(body);
  }

  const { status, body } = toErrorResponse(err || {});
  return res.status(status).json(body);
}

module.exports = { errorHandler, createHttpError };
