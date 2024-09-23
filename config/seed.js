/**
 * Populate DB with sample data on server start
 * to disable, edit config/environment/index.js, and set `seedDB: false`
 */

'use strict';
const sqlConnection = require("./sqlConnection");


// Check if the admin user already exists
const userSeed = `IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin1234' OR email = 'admin@metamart.com') THEN
  -- Insert the admin user
  INSERT INTO users (name, role, emailVerified, password, username, email)
  VALUES ('Admin', 'admin', true, 'Alpha1234.', 'admin1234', 'admin@metamart.com');
END IF`;

sqlConnection.execute(userSeed, function (err, result) {
  if (result) console.log("Admin created")
})


