// src/config/db.js - MySQL pool for mailer service
const mysql = require("mysql2/promise");
const { createHttpError } = require("../middleware/errorHandler");

function getEnv(name, { required = false } = {}) {
  const value = process.env[name];
  if (required && (!value || String(value).trim() === "")) {
    throw createHttpError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: `${name} is not configured`
    });
  }
  return value;
}

let pool;

function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: getEnv("DB_HOST", { required: true }),
    user: getEnv("DB_USER", { required: true }),
    password: getEnv("DB_PASSWORD", { required: true }),
    database: getEnv("DB_NAME", { required: true }),
    port: Number(getEnv("DB_PORT") || 3306),
    charset: "utf8mb4",
    timezone: "-03:00",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  return pool;
}

module.exports = { getPool };
