const mysql = require('mysql2');
const colors = require('colors');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: `./.env.${process['env']['NODE_ENV']}` });
require('dotenv').config();

const inventorySeed = async () => {
    const connection = await mysql.createConnection({
        host: process.env.MY_SQL_HOST,
        user: process.env.MY_SQL_USER,
        password: process.env.MY_SQL_PASSWORD,
        database: process.env.MY_SQL_DB
    });
    
    await connection.connect((err) => {
        if (err) {
            console.error(`Error connecting to MySQL: ${err}`.bgRed);
            return;
        }

        console.log('Connected to MySQL server'.bgGreen);
    });

    const inventorySeedQuery = `
        INSERT INTO inventory (productId, quantityAvailable)
        SELECT id, quantity FROM products;
    `;

    await connection.execute(inventorySeedQuery, (error, result) => {
        if (result) console.log("inventory table updated")
    });
  
    connection.end();
};

inventorySeed();