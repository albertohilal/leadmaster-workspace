// db.js - Conexión MySQL para control de IA por lead
const mysql = require('mysql2/promise');
const env = require('../../../config/environment');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  timezone: '-03:00', // Argentina (UTC-3)
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
