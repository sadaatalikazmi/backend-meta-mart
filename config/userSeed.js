const mysql = require('mysql2');
require('dotenv').config({ path: `./.env.${process['env']['NODE_ENV']}` });
require('dotenv').config();
const bcrypt = require('bcryptjs');

const createUser = async () => {

  const pool = await mysql.createConnection({
    host: process.env.MY_SQL_HOST,
    user: process.env.MY_SQL_USER,
    password: process.env.MY_SQL_PASSWORD,
    database: process.env.MY_SQL_DB,
    //waitForConnections: true,
    //connectionLimit: 10,
    //queueLimit: 0
  });

  await pool.connect((err) => {
    if (err) {
      console.error('Error connecting to MySQL:', err);
      return;
    }
    console.log('Connected to MySQL server');
  });

  const password = 'pass1234';

  const userData = {
    //username: null,
    firstName: 'John',
    lastName: '',
    //name: 'John',
    email: 'john@gmail.com',
    //role: null,
    //gender: null,
    //phone: null,
    //location: null,
    //zip: null,
    //avatar: null,
    //city: null,
    //country: null,
    //billingAddress: null,
    //address: null,
  };

  const { firstName, lastName, ...rest } = userData;
  const name = `${firstName} ${lastName}`;
  
  const hashedPassword = bcrypt.hashSync(password, 12);

  const fieldNames = Object.keys(rest).concat(['name', 'hashedPassword']).join(', ');
  //const fieldNames = Object.keys(userData).join(', ');
  //const fieldValues = Object.values(userData).map(value => value !== null ? `"${value}"` : null).join(', ');
  const fieldValues = Object.values(rest).map(value => value !== null ? `"${value}"` : null).concat(`"${name}"`, `"${hashedPassword}"`).join(', ');

  const sql = `INSERT INTO users (${fieldNames}) VALUES (${fieldValues})`;

  await pool.execute(sql);

  pool.end();
};

createUser();