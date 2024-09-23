const mysql = require('mysql2');
const colors = require('colors');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.MY_SQL_HOST,
  user: process.env.MY_SQL_USER,
  password: process.env.MY_SQL_PASSWORD,
  database: process.env.MY_SQL_DB,
  port: process.env.MY_SQL_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error(`Error connecting to MySQL: ${err}`.bgRed);
    return;
  }

  console.log('Connected to MySQL server'.bgGreen);
});

module.exports = pool;