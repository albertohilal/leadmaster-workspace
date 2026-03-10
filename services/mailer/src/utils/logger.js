function formatMeta(meta) {
  if (!meta) return "";
  try {
    return " " + JSON.stringify(meta);
  } catch (_err) {
    return "";
  }
}

const logger = {
  info(message, meta) {
    console.log(`[mailer] ${message}${formatMeta(meta)}`);
  },
  warn(message, meta) {
    console.warn(`[mailer] ${message}${formatMeta(meta)}`);
  },
  error(message, meta) {
    console.error(`[mailer] ${message}${formatMeta(meta)}`);
  }
};

module.exports = { logger };
