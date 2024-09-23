
const mysql = require('../../config/db-connection')

try {
  // Define the SQL query to create the User table
  const createTableQuery = `
      CREATE TABLE User (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        firstName VARCHAR(255),
        lastName VARCHAR(255),
        email VARCHAR(255),
        role ENUM('user', 'admin', 'super-admin') DEFAULT 'user',
        gender ENUM('male', 'female') DEFAULT 'male',
        phone VARCHAR(255),
        location VARCHAR(255),
        zip VARCHAR(255),
        avatar VARCHAR(255),
        city VARCHAR(255),
        country VARCHAR(255),
        billingAddress VARCHAR(255),
        address VARCHAR(255),
        hashedPassword VARCHAR(255) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

  // Execute the create table query
  await mysql.query(createTableQuery);
  console.log('User table created successfully!');
} catch (error) {
  console.error('Error creating User table:', error);
} finally {
  // Close the connection
  connection.end();
}

