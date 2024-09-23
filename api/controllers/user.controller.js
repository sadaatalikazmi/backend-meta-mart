"use strict";

const _ = require("lodash");
const moment = require("moment");
const stripe = require('stripe')(process?.env?.STRIPE_SECRET_KEY);
const { createJWT } = require("../../auth/helper");
const { sendResponse, errReturned } = require("../../config/dto");
const { emailValidator, colors } = require('../../config/environment/const')
const { countries, citiesUAE, dubaiAreas } = require('../../config/environment/countriesData')
const { SUCCESS, BADREQUEST, NOTFOUND, UNAUTHORIZED } = require("../../config/ResponseCodes");
const { insertQuery, selectQuery, updateQuery, deleteQuery } = require('../../utils/helper');
const bcrypt = require('bcryptjs');
const sqlConnection = require("../../config/sqlConnection");


/**
 * Graphs for New Customers
 */
exports.newCustomersGraph = async (_, res) => {
  try {
    const query = 'SELECT * FROM users';

    sqlConnection.query(query, (error, rows) => {
      if (error) {
        console.error('Error fetching users:', error);
        return sendResponse(res, 500, 'Internal Server Error');
      }

      const graph_hourly = getEarningsDataByTimeline(rows, 'hourly');
      const graph_weekly = getEarningsDataByTimeline(rows, 'weekly');
      const graph_1m = getEarningsDataByTimeline(rows, '1m');

      sendResponse(res, 200, 'Statistics Received Successfully', { graph_hourly, graph_weekly, graph_1m });
    });
  } catch (error) { errReturned(res, error) }
}

/**
 * Signup As A New User
 */
exports.signUp = async (req, res) => {
  try {
    const { username, email, password, name, role, vendor, deviceId, fcmToken } = req.body;

    const requiredFields = ['username', 'email', 'password'];
    for (const field of requiredFields) {
      if (!req.body[field]) return sendResponse(res, BADREQUEST, `Please provide ${field}`, []);
    }

    let valid = emailValidator.test(email)
    if (!valid) return sendResponse(res, BADREQUEST, "Please enter valid Email", valid)
    if (username < 5 || username > 20) return sendResponse(res, BADREQUEST, "Username must be in between 5 to 50 characters")

    const checkUserQuery = `SELECT * FROM users WHERE username = ? OR email = ?`;
    sqlConnection.execute(checkUserQuery, [username, email], async function (err, rows) {
      if (err) return errReturned(res, err);
      else {
        if (rows.length > 0) return sendResponse(res, BADREQUEST, 'Username or email address already exists', []);

        let stripeId;

        if (role === 'advertiser') {
          let stripeCustomer = await stripe.customers.create({ name, email });
          stripeId = stripeCustomer.id;
        }

        // Username and email are unique, proceed with signup
        const newUser = {
          name: name ? name : '',
          username,
          email,
          role: role ? role : 'user',
          stripeId: stripeId ? stripeId : '',
          vendor: vendor ? vendor : '',
        };

        const fieldNames = Object.keys(newUser).join(', ');
        const fieldValues = Object.values(newUser).map(value => typeof value === 'string' ? `"${value}"` : value).join(', ');

        const hashedPassword = bcrypt.hashSync(password, 12);

        const signUpQuery = `INSERT INTO users  (${fieldNames}, hashedPassword) VALUES (${fieldValues}, "${hashedPassword}")`;

        sqlConnection.execute(signUpQuery, function (err, result) {
          if (err) return errReturned(res, err);

          if (result.affectedRows === 1) {
            // User was successfully added, generate token
            const userId = result.insertId;
            const newUserQuery = `SELECT * FROM users WHERE id = ${userId}`;

            sqlConnection.execute(newUserQuery, function (err, rows) {
              if (err) return errReturned(res, err);

              const newUser = rows[0];
              let userId = rows[0].id;

              const addFcmQuery = 'INSERT INTO user_devices (userId, deviceId, fcmToken) VALUES (?, ?, ?)';
              const values = [userId, deviceId, fcmToken];
              sqlConnection.query(addFcmQuery, values, (error, result) => {
                if (error) return errReturned(res, error);
              });

              createJWT(newUser)
                .then(({ token }) => {
                  if (!token) return sendResponse(res, BADREQUEST, 'Something went wrong in generating token', []);
                  return sendResponse(res, SUCCESS, 'User signUp successfully', { token, newUser });
                })
                .catch(err => {
                  errReturned(res, err);
                });
            });
          } else {
            return sendResponse(res, BADREQUEST, "Something went wrong, can't signUp");
          }
        });
      }
    });
  } catch (error) { errReturned(res, error) }
};

/**
 * User Login
 */
exports.login = async (req, res) => {
  try {
    let { email, password, deviceId, fcmToken } = req['body'];
    let data = req['body'];
    let required = ['email', 'password'];
    for (let key of required)
      if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null)
        return sendResponse(res, BADREQUEST, `Please Provide ${key}`, [])

    sqlConnection.execute(`SELECT * FROM users WHERE email = ?`, [email], function (err, rows) {
      if (err) return errReturned(res, err);
      if (rows.length === 0) return sendResponse(res, BADREQUEST, 'No user found', []);

      const user = rows[0]; // Assuming email is unique, so we take the first result

      // Check user status
      if (user.status === 'suspended') {
        return sendResponse(res, BADREQUEST, 'Your account is suspended. Please contact support for assistance.');
      }

      // Compare the provided password with the hashed password from the database
      bcrypt.compare(password, user.hashedPassword, function (err, passwordMatch) {
        if (err) return errReturned(res, err);
        if (!passwordMatch) return sendResponse(res, UNAUTHORIZED, 'Incorrect email or password', []);

        sqlConnection.execute(`SELECT * FROM user_devices WHERE userId = ?`, [user.id], function (err, rows) {
          if (err) return errReturned(res, err);

          rows.map(data => {
            if (data.deviceId === deviceId) {
              const updateFcmQuery = 'UPDATE user_devices SET fcmToken = ? WHERE deviceId = ?';
              const updateValues = [fcmToken, deviceId];
              sqlConnection.query(updateFcmQuery, updateValues, (error, result) => {
                if (error) return errReturned(res, error);
              });
            } else {
              const addFcmQuery = 'INSERT INTO user_devices (userId, deviceId, fcmToken) VALUES (?, ?, ?)';
              const values = [user.id, deviceId, fcmToken];
              sqlConnection.query(addFcmQuery, values, (error, result) => {
                if (error) return errReturned(res, error);
              });
            }
          });
        })

        const userObj = { ...user, hashedPassword: undefined }; // Remove hashedPassword from response

        createJWT(userObj)
          .then(({ token }) => {
            if (!token) {
              return sendResponse(res, BADREQUEST, 'Something went wrong in generating token', []);
            }

            sendResponse(res, SUCCESS, 'Login Successful', { token, username: user.username });
          })
          .catch(err => {
            errReturned(res, err);
          });
      });
    });
  }
  catch (err) { errReturned(res, err) }
}

/**
 * Update Billing Address
 */
exports.billingAddress = async (req, res) => {
  try {
    let { user } = req;
    let { firstName, lastName, address, country, zip, age, city, area } = req['body']
    let data = req['body'];
    let required = ['address', 'country', 'age', 'city', 'area'];
    for (let key of required)
      if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null)
        return sendResponse(res, BADREQUEST, `Please Provide ${key}`, [])

    if (address.length < 5 || address.length > 50) return sendResponse(res, BADREQUEST, "address must be in between 5 to 50 characters")
    if (country.length < 4 || country.length > 20) return sendResponse(res, BADREQUEST, "country must be in between 4 to 20 characters")
    if (!countries.includes(country)) return sendResponse(res, BADREQUEST, "Please provide valid country")
    if (!citiesUAE.includes(city)) return sendResponse(res, BADREQUEST, "Please provide valid city")
    if (!dubaiAreas.includes(area)) return sendResponse(res, BADREQUEST, "Please provide valid area")

    const updateQuery = `
      UPDATE users 
      SET firstName = ?, lastName = ?, address = ?, country = ?, zip = ?, age = ?,city =?, area = ?
      WHERE id = ?
    `;

    const values = [firstName, lastName, address, country, zip, age, city, area, user.id];

    sqlConnection.query(updateQuery, values, (err, result) => {
      if (err) {
        return errReturned(res, err);
      }

      if (result.affectedRows === 0) {
        return sendResponse(res, BADREQUEST, "Failed to update billing address");
      }

      // Assuming you want to fetch the updated user data after the update
      const getUserQuery = `SELECT * FROM users WHERE id = ?`;
      sqlConnection.query(getUserQuery, [user.id], (err, rows) => {
        if (err) {
          return errReturned(res, err);
        }

        const updatedUser = rows[0];
        return sendResponse(res, SUCCESS, "Your billing address saved successfully", updatedUser);
      });
    });
  } catch (error) { errReturned(res, error) }
}


/**
 * Get Vendor information based on the authenticated user's userId
 */
exports.getVendor = (req, res) => {
  try {
    const userId = req.user.id;

    const getVendorQuery = 'SELECT vendor FROM users WHERE id = ?';

    // Execute the query
    sqlConnection.execute(getVendorQuery, [userId], (error, rows) => {
      if (error) {
        return errReturned(res, error);
      }

      if (rows.length === 0) {
        return sendResponse(res, BADREQUEST, 'User not found', []);
      }

      const vendor = rows[0].vendor;

      return sendResponse(res, SUCCESS, 'Vendor information retrieved successfully', { vendor });
    });
  } catch (error) {
    errReturned(res, error);
  }
};


// Update Vendor //
exports.updateVendor = async (req, res) => {
  try {
    let id = req.user.id;
    let { vendor } = req.body;

    if (!vendor || vendor == '' || vendor == undefined || vendor == null) return sendResponse(res, BADREQUEST, `Please provide vendor`, []);

    let updateVendorQuery = updateQuery('users', ['vendor'], 'id');
    let updateVendorValues = [vendor, id];
    sqlConnection.query(updateVendorQuery, updateVendorValues, (updateVendorError, updateVendorResult) => {
      if (updateVendorError) return errReturned(res, updateVendorError);
      if (updateVendorResult.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to save account name', []);

      sqlConnection.query(selectQuery('*', 'users', 'id'), [id], (userError, userResult) => {
        if (userError) return errReturned(res, userError);
        if (!userResult || userResult.length === 0) return sendResponse(res, NOTFOUND, 'User not found');

        return sendResponse(res, SUCCESS, 'Account name saved successfully', userResult[0]);
      });
    });
  } catch (error) { errReturned(res, error) }
}


/**
 * Cancel Account
 */
exports.cancelAccount = (req, res) => {
  try {
    const userId = req.user.id; // Assuming the user ID is available in the request object

    const cancelAccountQuery = `
      UPDATE banners
      JOIN banner_campaigns ON banners.userId = banner_campaigns.userId
      JOIN users ON banners.userId = users.id
      SET
          banners.status = 'suspended',
          banner_campaigns.status = 'suspended',
          users.status = 'suspended'
      WHERE banners.userId = ?;
    `;

    sqlConnection.execute(cancelAccountQuery, [userId], (error, result) => {
      if (error) {
        return errReturned(res, error);
      }

      if (result.affectedRows > 0) {
        // Return the user record after canceling the account
        const userRecordQuery = selectQuery('*', 'users', 'id');
        sqlConnection.query(userRecordQuery, [userId], (userRecordError, userRecordResult) => {
          if (userRecordError) return errReturned(res, userRecordError);

          return sendResponse(res, SUCCESS, 'Account canceled successfully', userRecordResult);
        });
      } else {
        return sendResponse(res, BADREQUEST, 'No account found to cancel');
      }
    });
  } catch (error) {
    errReturned(res, error);
  }
};

/**
    * COUNTRIES DATA       
 */
exports.countriesList = async (req, res) => {
  try {

    let response = [{ countries }, { citiesUAE }, { dubaiAreas }];
    return sendResponse(res, SUCCESS, "Countries Data", response);

  } catch (error) {
    errReturned(res, error);
  }
};

/**
 * Login With Google
 */
exports.loginWithGoogle = async (req, res) => {
  try {
    const { userId, username } = req.body;
    const data = req.body;
    const required = ['userId', 'username'];

    for (const key of required) {
      if (!data[key] || data[key] === '' || data[key] === undefined || data[key] === null) {
        return sendResponse(res, BADREQUEST, `Please Provide ${key}`, []);
      }
    }

    const fetchUserQuery = `
      SELECT * FROM users
      WHERE userId = ?;
    `;

    sqlConnection.query(fetchUserQuery, [userId], async (error, results) => {
      if (error) return errReturned(res, error);

      if (results.length === 0) {
        const insertUserQuery = `
          INSERT INTO users (userId, username)
          VALUES (?, ?);
        `;

        sqlConnection.query(insertUserQuery, [userId, username], async (insertError, insertResults) => {
          if (insertError) return errReturned(res, insertError);

          const newUser = {
            userId: userId,
            username: username,
          };

          const { token } = await createJWT(newUser);
          if (!token) return sendResponse(res, BADREQUEST, "Something went wrong in generating token");

          return sendResponse(res, SUCCESS, "Login Successful", { token, username });
        });
      } else {
        const existingUser = results[0];

        const { token } = await createJWT(existingUser);
        if (!token) return sendResponse(res, BADREQUEST, "Something went wrong in generating token");

        return sendResponse(res, SUCCESS, "Login Successful", { token, existingUser });
      }
    });
  } catch (error) {
    errReturned(res, error);
  }
};


/**
 * Get All Customers
 */
exports.getAllUsers = async (req, res) => {
  try {
    const fetchUsersQuery = `
      SELECT u.id, u.username, u.firstName, u.lastName, u.email, u.location,
            u.role, u.phone, u.zip, u.avatar, u.createdAt, u.gender,
            u.city, u.country, u.billingAddress, u.address,
            COUNT(o.id) AS totalOrders,
            SUM(CAST(o.totalAmount AS DECIMAL(10, 2))) AS totalSpending
      FROM users u
      LEFT JOIN orders o ON u.id = o.userId
      GROUP BY u.id
    `;

    sqlConnection.query(fetchUsersQuery, (error, results) => {
      if (error) return errReturned(res, error);

      const usersWithOrderTotals = results.map(row => {
        return {
          id: row.id,
          username: row.username,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          location: row.location,
          role: row.role,
          phone: row.phone,
          zip: row.zip,
          avatar: row.avatar,
          createdAt: row.createdAt,
          gender: row.gender,
          city: row.city,
          country: row.country,
          billingAddress: row.billingAddress,
          address: row.address,
          totalOrders: row.totalOrders,
          totalSpending: row.totalSpending || 0
        };
      });

      return sendResponse(res, SUCCESS, "All Users Found", usersWithOrderTotals);
    });

  } catch (error) { return errReturned(res, error) }
}


/** 
* Update Customer Details
*/
exports.updateMe = async (req, res) => {
  try {
    let { user } = req;
    if (!user) return sendResponse(res, BADREQUEST, "Login first to update details");

    const allowedKeys = ['username', 'password', 'address', 'billingAddress', 'country', 'city', 'phone', 'zip', 'avatar', 'firstName', 'lastName'];
    const updatedValues = {};

    allowedKeys.forEach(key => {
      if (req.body[key]) {
        updatedValues[key] = req.body[key];
      }
    });

    if (req.body.password) {
      const hashedPassword = bcrypt.hashSync(req.body.password, 12);
      updatedValues.hashedPassword = hashedPassword;
    }

    sqlConnection.query('SELECT * FROM users WHERE id = ?', [user.id], (error, userResult) => {
      if (error) return errReturned(res, error);
      if (userResult.length === 0) return sendResponse(res, BADREQUEST, "User not found");

      const userDetails = userResult[0];

      const updateQuery = `
        UPDATE users 
        SET 
          username = ?, 
          address = ?, 
          billingAddress = ?, 
          country = ?, 
          city = ?, 
          phone = ?, 
          zip = ?, 
          avatar = ?, 
          firstName = ?, 
          lastName = ?,
          hashedPassword = ?
        WHERE id = ?
      `;
      const values = [
        updatedValues.username || userDetails.username,
        updatedValues.address || userDetails.address,
        updatedValues.billingAddress || userDetails.billingAddress,
        updatedValues.country || userDetails.country,
        updatedValues.city || userDetails.city,
        updatedValues.phone || userDetails.phone,
        updatedValues.zip || userDetails.zip,
        updatedValues.avatar || userDetails.avatar,
        updatedValues.firstName || userDetails.firstName,
        updatedValues.lastName || userDetails.lastName,
        updatedValues.hashedPassword || userDetails.hashedPassword,
        user.id
      ];
      sqlConnection.query(updateQuery, values, (err, result) => {
        if (err) return errReturned(res, err);
        if (result.affectedRows === 0) return sendResponse(res, BADREQUEST, "Failed to update user details");

        const getUserQuery = `SELECT * FROM users WHERE id = ?`;
        sqlConnection.query(getUserQuery, [user.id], (err, rows) => {
          if (err) return errReturned(res, err);

          const updatedUser = rows[0];
          return sendResponse(res, SUCCESS, "Details updated successfully", updatedUser);
        });
      });
    });
  } catch (error) { errReturned(res, error) }
};


/** 
* Update Username
*/
exports.updateUsername = async (req, res) => {
  try {
    let userId = req.user.id;
    let { username } = req.body;

    if (!userId) return sendResponse(res, BADREQUEST, "Login first to update details");
    if (!username) return sendResponse(res, BADREQUEST, "Please provide username");

    sqlConnection.query('SELECT * FROM users WHERE username = ?', [username], (usernameCheckError, usernameCheckResult) => {
      if (usernameCheckError) return errReturned(res, usernameCheckError);
      if (usernameCheckResult.length > 0) return sendResponse(res, BADREQUEST, 'Username already exists. Please provide a different username');

      sqlConnection.query('SELECT * FROM users WHERE id = ?', [userId], (userError, userResult) => {
        if (userError) return errReturned(res, userError);
        if (userResult.length === 0) return sendResponse(res, BADREQUEST, "User not found");

        const updateQuery = 'UPDATE users SET username = ? WHERE id = ?';
        const values = [username, userId];
        sqlConnection.query(updateQuery, values, (err, result) => {
          if (err) return errReturned(res, err);
          if (result.affectedRows === 0) return sendResponse(res, BADREQUEST, "Failed to update username");

          const getUserQuery = `SELECT * FROM users WHERE id = ?`;
          sqlConnection.query(getUserQuery, [userId], (err, rows) => {
            if (err) return errReturned(res, err);

            const updatedUser = rows[0];
            return sendResponse(res, SUCCESS, "Username updated successfully", updatedUser);
          });
        });
      });
    });

  } catch (error) { errReturned(res, error) }
};


exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const updateFields = req.body;

    const updateQuery = 'UPDATE users SET ? WHERE id = ?';

    sqlConnection.query(updateQuery, [updateFields, userId], (error, results) => {
      if (error) {
        console.error('Error updating user:', error);
        return sendResponse(res, 500, 'Internal Server Error');
      }

      if (results.affectedRows === 0) {
        return sendResponse(res, 404, 'User does not exist');
      }

      const newUserQuery = `SELECT * FROM users WHERE id = ${userId}`;

      sqlConnection.execute(newUserQuery, function (err, rows) {
        if (err) {
          return errReturned(res, err);
        }

        const newUser = rows[0];
        if (!newUser) return sendResponse(res, NOTFOUND, "User not FOUND");
        return sendResponse(res, SUCCESS, "Details updated successfully'", newUser);
      });
    });
  } catch (error) { errReturned(res, error) }
}

/**
 * My Profile
 **/
exports.myProfle = async (req, res) => {
  try {
    const { user } = req;
    const newUserQuery = `SELECT * FROM users WHERE id = ${user.id}`;

    sqlConnection.execute(newUserQuery, function (err, rows) {
      if (err) {
        return errReturned(res, err);
      }

      const userDetails = rows[0];
      if (!userDetails) return sendResponse(res, NOTFOUND, "User not FOUND");
      return sendResponse(res, SUCCESS, "Your details found", userDetails);
    });
  } catch (e) { errReturned(res, e) }
};


const getEarningsDataByTimeline = (allUsers, customerTimeline) => {

  let startDate, labelFormat;

  if (customerTimeline === '7d') {
    startDate = moment().subtract(6, 'days').startOf('day');
    labelFormat = 'MMM DD';
  } else if (customerTimeline === '1m') {
    startDate = moment().subtract(1, 'month').startOf('day');
    labelFormat = 'MMM DD';
  } else if (customerTimeline === 'max') {
    startDate = moment().year(year).subtract(4, 'year').startOf('year');
    labelFormat = 'MMM YYYY';
  } else if (customerTimeline === 'hourly') {
    startDate = moment().startOf('day').hour(0);
    labelFormat = 'HH:mm';
  } else if (customerTimeline === 'weekly') {
    startDate = moment().startOf('month');
    labelFormat = 'MMM DD';
  }

  const currentDate = moment().endOf('day');
  let labels = [];
  let data = [];

  if (customerTimeline === 'weekly') {
    const weeksData = Array(4).fill([]);

    const thisdate = new Date()
    for (const order of allUsers) {
      const orderDate = moment(order.createdAt);
      const monthStart = moment(orderDate).startOf('month');
      const daysIntoMonth = orderDate.date();
      // const daysIntoMonth = orderDate.diff(monthStart, 'days');

      if (orderDate.month() === (thisdate.getMonth()) && orderDate.year() === thisdate.getFullYear()) { // Make sure it's within the current month
        const weekIndex = Math.floor(daysIntoMonth / 7);
        weeksData[weekIndex] = weeksData[weekIndex] ? [...weeksData[weekIndex], order] : [order];
      }
    }

    labels = weeksData.map((_, index) => `Week ${index + 1}`);
    data = weeksData;
  }
  else {
    for (
      let date = startDate;
      date <= currentDate;
      date =
      customerTimeline === 'hourly'
        ? date.clone().add(1, 'hour')
        : date.clone().add(1, 'day')
    ) {
      const formattedDate = date.format(labelFormat);
      const ordersOnDate = allUsers.filter(order => {
        const orderDate = moment(order.createdAt);
        return (
          customerTimeline === 'hourly'
            ? orderDate.isSame(date, 'hour')
            : orderDate.isSame(date, 'day')
        );
      });
      const totalOrders = ordersOnDate;

      labels.push(formattedDate);
      data.push(totalOrders);
    }
  }

  let allData = data.map(el => el.length);
  let maleData = data.map(el => el.filter(lt => lt.gender === 'male').length);
  let femaleData = data.map(el => el.filter(lt => lt.gender === 'female').length);

  return {
    labels: labels,
    series: [
      {
        name: 'All',
        data: allData,
        id: 1,
        color: colors[0],
      },
      {
        name: 'Males',
        data: maleData,
        id: 2,
        color: colors[1],
      },
      {
        name: 'Females',
        data: femaleData,
        id: 3,
        color: colors[2],
      },
    ],

  };

}