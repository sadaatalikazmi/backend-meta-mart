'use strict';

const axios = require('axios');
const moment = require("moment");
const { sendResponse, errReturned } = require('../../config/dto');
const { SUCCESS, BADREQUEST, NOTFOUND } = require('../../config/ResponseCodes');
const { orderStatuses, productTypes, VAT, currency, colors } = require('../../config/environment/const');
const sqlConnection = require("../../config/sqlConnection");
const { getOrdersBetweenDatesQuery } = require('../../utils/order.helper');


/**
 * Stats of Order
 */
exports.getOrderStats = async (req, res) => {
  const { fetchOrdersQuery, fromDate, toDate } = getOrdersBetweenDatesQuery(req.body);

  sqlConnection.query(fetchOrdersQuery, [fromDate, toDate], (error, results) => {
    if (error) return errReturned(res, error);

    const allOrders = results.reduce((orders, row) => {
      const existingOrder = orders.find(order => order.orderId === row.orderId);

      if (existingOrder) {
        existingOrder.items.push({
          id: row.itemId,
          productId: {
            currency: row.productCurrency,
            id: row.productId,
            name: row.productName,
            description: row.productDescription,
            productQuantity: row.productQuantity,
            file: row.productFile,
            price: row.productPrice,
            size: row.productSize,
            type: row.productType,
            imageUrl: row.productImageUrl,
            createdAt: row.productCreatedAt,
            updatedAt: row.productUpdatedAt
          },
          quantity: row.itemQuantity
        });
      } else {
        orders.push({
          orderNumber: row.orderNumber,
          status: row.status,
          orderId: row.orderId,
          items: [
            {
              id: row.itemId,
              productId: {
                currency: row.productCurrency,
                id: row.productId,
                name: row.productName,
                description: row.productDescription,
                quantity: row.productQuantity,
                file: row.productFile,
                price: row.productPrice,
                size: row.productSize,
                type: row.productType,
                imageUrl: row.productImageUrl,
                createdAt: row.productCreatedAt,
                updatedAt: row.productUpdatedAt
              },
              quantity: row.itemQuantity
            }
          ],
          userId: {
            id: row.userId,
            name: row.userName,
            gender: row.userGender
          },
          totalAmount: row.totalAmount,
          currency: row.currency,
          reciptUrl: row.reciptUrl,
          transactionId: row.transactionId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        });
      }

      return orders;
    }, []);

    sqlConnection.query(`SELECT * FROM users`, (err, usersResult) => {
      if (err) return errReturned(res, err);
      if (usersResult.length == 0) return sendResponse(res, BADREQUEST, "No User Found");

      const order_7d = filterData(allOrders, '7d')
      const order_1m = filterData(allOrders, '1m')
      const user_7d = filterData(usersResult, '7d')
      const user_1m = filterData(usersResult, '1m')

      const total_orders_stats = {
        stats_7d: order_7d.length,
        stats_1m: order_1m.length,
        stats_max: allOrders.length,
      }

      const completed_order_stats = {
        stats_7d: order_7d.filter(el => el.status === 'COMPLETED').length,
        stats_1m: order_1m.filter(el => el.status === 'COMPLETED').length,
        stats_max: allOrders.filter(el => el.status === 'COMPLETED').length,
      }

      const pending_order_stats = {
        stats_7d: order_7d.filter(el => !['COMPLETED', 'CANCELLED'].includes(el.status)).length,
        stats_1m: order_1m.filter(el => !['COMPLETED', 'CANCELLED'].includes(el.status)).length,
        stats_max: allOrders.filter(el => !['COMPLETED', 'CANCELLED'].includes(el.status)).length,
      }

      const cancelled_order_stats = {
        stats_7d: order_7d.filter(el => el.status === 'CANCELLED').length,
        stats_1m: order_1m.filter(el => el.status === 'CANCELLED').length,
        stats_max: allOrders.filter(el => el.status === 'CANCELLED').length,
      }

      const order_7d_sales = order_7d.filter(el => el.status === 'COMPLETED').reduce((a, b) => a + +b.totalAmount, 0);
      const order_1m_sales = order_1m.filter(el => el.status === 'COMPLETED').reduce((a, b) => a + +b.totalAmount, 0);
      const allOrders_sales = allOrders.filter(el => el.status === 'COMPLETED').reduce((a, b) => a + +b.totalAmount, 0);

      const gross_sales_stats = {
        stats_7d: order_7d_sales,
        stats_1m: order_1m_sales,
        stats_max: allOrders_sales,
      }

      const pending_sales_stats = {
        stats_7d: order_7d.filter(el => !['COMPLETED', 'CANCELLED'].includes(el.status)).reduce((a, b) => a + +b.totalAmount, 0),
        stats_1m: order_1m.filter(el => !['COMPLETED', 'CANCELLED'].includes(el.status)).reduce((a, b) => a + +b.totalAmount, 0),
        stats_max: allOrders.filter(el => !['COMPLETED', 'CANCELLED'].includes(el.status)).reduce((a, b) => a + +b.totalAmount, 0),
      }

      const total_sales_stats = {
        stats_7d: order_7d_sales - (+(order_7d_sales * VAT) / 100),
        stats_1m: order_1m_sales - (+(order_1m_sales * VAT) / 100),
        stats_max: allOrders_sales - (+(allOrders_sales * VAT) / 100),
      }

      const average_price_stats = {
        stats_7d: order_7d_sales / order_7d.length,
        stats_1m: order_1m_sales / order_1m.length,
        stats_max: allOrders_sales / allOrders.length,
      }

      const total_coustomers_stats = {
        stats_7d: user_7d.length,
        stats_1m: user_1m.length,
        stats_max: usersResult.length,
      }

      return sendResponse(res, SUCCESS, 'Orders Statistics', {
        total_orders_stats, completed_order_stats, pending_order_stats, cancelled_order_stats, total_sales_stats, pending_sales_stats, gross_sales_stats, average_price_stats, total_coustomers_stats
      })
    });

  });
}

/**
 * Create New Order
 */

exports.createOrder = async (req, res) => {
  try {
    let userId = req.user.id;
    let { items, billingAddress, totalAmount, currency, vat, reciptUrl, transactionId } = req.body;
    let data = req.body;
    let required = ['items', 'totalAmount', 'billingAddress', 'vat', 'reciptUrl', 'transactionId'];

    for (let key of required) {
      if (!data[key] || data[key] === '' || data[key] === undefined || data[key] === null) {
        return sendResponse(res, BADREQUEST, `${key} is required`);
      }
    }
    if (vat != VAT) return sendResponse(res, BADREQUEST, "Please provide correct vat value")

    // Update billingAddress in the user table
    const updateUserQuery = `
      UPDATE users
      SET billingAddress = ?
      WHERE id = ?;
    `;

    sqlConnection.query(updateUserQuery, [billingAddress, userId], (userUpdateError, userUpdateResult) => {
      if (userUpdateError) return errReturned(res, userUpdateError);

      sqlConnection.query(`SELECT * FROM users WHERE id = ?`, [userId], (error, users) => {
        if (error) return errReturned(res, error);

        const userDetails = users[0];

        if (!userDetails) return sendResponse(res, BADREQUEST, 'User not found');

        // Validate products and check if quantity is sufficient
        validateProducts(items)
          .then(() => {
            const insertOrderQuery = `
              INSERT INTO orders (userId, billingAddress, totalAmount, currency, reciptUrl, transactionId, vat)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const values = [userId, billingAddress, totalAmount, currency, reciptUrl, transactionId, vat];
            sqlConnection.query(insertOrderQuery, values, (orderInsertError, result) => {
              if (orderInsertError) return errReturned(res, orderInsertError);

              const newOrderId = result.insertId;

              sqlConnection.query(`UPDATE orders SET orderNumber = id WHERE id = ?`, [newOrderId], (updateError, updateResult) => {
                if (updateError) return errReturned(res, updateError);

                const insertTransactionQuery = `
                  INSERT INTO transactions (customerId, transactionId, totalAmount)
                  VALUES (?, ?, ?)
                `;
                const insertTransactionValues = [userId, transactionId, totalAmount];
                sqlConnection.query(insertTransactionQuery, insertTransactionValues, (transactionInsertError, transactionResult) => {
                  if (transactionInsertError) return errReturned(res, transactionInsertError);

                  const newTransactionId = transactionResult.insertId;

                  let productPromises = items.map(el => {
                    sqlConnection.query(`SELECT price FROM products WHERE id = ?`, [el.productId], (priceError, priceResult) => {
                      if (priceError) return errReturned(res, priceError);

                      const productPrice = priceResult[0]?.price;
                      const subtotal = el.quantity * productPrice;

                      const productValues = [el.quantity, el.productId];
                      const itemsValues = [newOrderId, el.productId, el.quantity, productPrice, subtotal];
                      const transactionDetailsValues = [newTransactionId, el.productId, el.quantity, subtotal];
                      return new Promise((resolve, reject) => {
                        sqlConnection.query(`UPDATE products SET quantity = quantity - ? WHERE id = ?`, productValues, (error, result) => {
                          if (error) return reject(error);
                          resolve(result);
                        });

                        sqlConnection.query(`UPDATE inventory SET quantityAvailable = quantityAvailable - ? WHERE productId = ?`, productValues, (updateInventoryError, updateInventoryResult) => {
                          if (updateInventoryError) return reject(updateInventoryError);
                          resolve(updateInventoryResult);
                        });

                        sqlConnection.query(`INSERT INTO order_items (orderId, productId, quantity, unitPrice, subtotal) VALUES (?, ?, ?, ?, ?)`, itemsValues, (err, orderItemResults) => {
                          if (err) return reject(err);
                          resolve(orderItemResults);
                        });

                        sqlConnection.query(`INSERT INTO transaction_details (transactionId, productId, quantitySold, subtotal) VALUES (?, ?, ?, ?)`, transactionDetailsValues, (transactionDetailsError, transactionDetailsResults) => {
                          if (transactionDetailsError) return reject(transactionDetailsError);
                          resolve(transactionDetailsResults);
                        });
                      });
                    });
                  });

                  Promise.all(productPromises)
                    .then(() => {
                      sqlConnection.query(`SELECT * FROM orders WHERE id = ?`, [newOrderId], (err, orderResult) => {
                        if (err) return errReturned(res, err);

                        let newOrder = orderResult[0];

                        newOrder.items = items;

                        return sendResponse(res, SUCCESS, 'Order created successfully', newOrder);
                      });
                    })
                    .catch(error => errReturned(res, error));
                });
              });
            });
          })
          .catch(validationError => sendResponse(res, BADREQUEST, validationError));
      });
    });
  } catch (error) {
    errReturned(res, error);
  }
};

/**
    * SAVE ADD TO CART PRODUCTS  
 */
exports.addToCartProducts = async (req, res) => {
  try {
    let { products } = req['body']
    let userId = req['user']['id']

    const validation = await validateProducts(products);
    if (validation) return sendResponse(res, NOTFOUND, validation);
    sqlConnection.query('DELETE FROM cart WHERE userId = ?', [userId], function (err, results) {
      if (err) { errReturned(res, err) }
      if (products.length < 1) return sendResponse(res, SUCCESS, "Cart updated successfully");
      else {
        const insertQuery = 'INSERT INTO cart (userId, productId, quantity) VALUES (?, ?, ?)';
        products.forEach((product) => {
          sqlConnection.query(insertQuery, [userId, product.productId, product.quantity], function (err, result) {
            if (err) { errReturned(res, err) }
            if (product === products[products.length - 1]) {
              return sendResponse(res, SUCCESS, "Cart updated successfully");
            }
          });
        });
      }
    });
  } catch (error) { errReturned(res, error) }
}
/**
  *GET ADD TO CART PRODUCTS 
 */

exports.getCartProducts = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = 'SELECT c.productId, c.quantity, p.name, p.price, p.imageUrl ' +
      'FROM cart AS c ' +
      'INNER JOIN products AS p ON c.productId = p.id ' +
      'WHERE c.userId = ?';

    sqlConnection.query(query, [userId], (err, results) => {
      if (err) {
        errReturned(res, err);
      } else {
        const cartProducts = results.map((row) => ({
          productId: row.productId,
          quantity: row.quantity,
          product: {
            name: row.name,
            price: Number(row.price),
            imageUrl: row.imageUrl
          }
        }));

        return sendResponse(res, SUCCESS, "Add to cart products", cartProducts);
      }
    });
  } catch (error) { errReturned(res, error) }
}



async function validateProducts(items) {
  for (const item of items) {
    const product = await getProductById(item.productId);
    if (!product) {
      return `Product not found with id:  ${item.productId}`;
    }
    if (product.quantity < item.quantity) {
      return `Insufficient quantity for product: ${product.name}`;
    }
  }
}

async function getProductById(productId) {
  return new Promise((resolve, reject) => {
    sqlConnection.query('SELECT * FROM products WHERE id = ?', [productId], (error, results) => {
      if (error) return reject(error);
      resolve(results[0]);
    });
  });
}

async function validateStripeReceipt(receiptUrl) {
  try {
    const response = await axios.get(receiptUrl);
    const success = response.data.paid === true && response.data.status === 'succeeded';
    return { success, response: response.data };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * GET VAT VALUE
 */

exports.getVat = async (req, res) => {
  try {
    if (!VAT) return sendResponse(res, BADREQUEST, "VAT Value not found")
    return sendResponse(res, SUCCESS, "VAT Value", { vat: VAT, currency })
  } catch (error) { errReturned(res, error) }
}

/**
* Get Orders For Graph Data
*/
exports.getAllOrdersGraphs = async (_, res) => {
  try {
    const fetchOrdersQuery = `
      SELECT o.orderNumber, o.status, o.id AS orderId,
            u.gender AS userGender, u.id AS userId, u.name AS userName,
            o.totalAmount, o.currency, o.reciptUrl, o.transactionId, o.createdAt, o.updatedAt,
            i.id AS itemId, i.quantity AS itemQuantity,
            p.currency AS productCurrency, p.id AS productId, p.name AS productName,
            p.description AS productDescription, p.quantity AS productQuantity, p.createdAt AS productCreatedAt, p.updatedAt AS productUpdatedAt,
            p.file AS productFile, p.price AS productPrice, p.productSize, p.type AS productType,
            p.imageUrl AS productImageUrl, p.currency AS productCurrency
      FROM orders o
      INNER JOIN users u ON o.userId = u.id
      LEFT JOIN order_items oi ON oi.orderId = o.id
      LEFT JOIN products p ON p.id = oi.productId
      LEFT JOIN order_items i ON i.id = oi.id
  `;

    sqlConnection.query(fetchOrdersQuery, (error, results) => {
      if (error) return errReturned(res, error);

      const allOrders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              currency: row.productCurrency,
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: row.productPrice,
              size: row.productSize,
              type: row.productType,
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt
            },
            quantity: row.itemQuantity
          });
        } else {
          orders.push({
            orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  currency: row.productCurrency,
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  file: row.productFile,
                  price: row.productPrice,
                  size: row.productSize,
                  type: row.productType,
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                  updatedAt: row.productUpdatedAt
                },
                quantity: row.itemQuantity
              }
            ],
            userId: {
              id: row.userId,
              name: row.userName,
              gender: row.userGender
            },
            totalAmount: row.totalAmount,
            currency: row.currency,
            reciptUrl: row.reciptUrl,
            transactionId: row.transactionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          });
        }

        return orders;
      }, []);

      const graph_hourly = getOrdersDataByTimeline(allOrders, 'hourly');
      const graph_weekly = getOrdersDataByTimeline(allOrders, 'weekly');
      const graph_1m = getOrdersDataByTimeline(allOrders, '1m');

      return sendResponse(res, SUCCESS, "", { graph_hourly, graph_weekly, graph_1m });
    });
  } catch (error) {
    return errReturned(res, error);
  }
}

/**
 * All Earnings Graphs Data
 */
exports.getAllEarningsGraphs = async (_, res) => {
  try {
    const fetchOrdersQuery = `
      SELECT o.orderNumber, o.status, o.id AS orderId,
            u.gender AS userGender, u.id AS userId, u.name AS userName,
            o.totalAmount, o.currency, o.reciptUrl, o.transactionId, o.createdAt, o.updatedAt,
            i.id AS itemId, i.quantity AS itemQuantity,
            p.currency AS productCurrency, p.id AS productId, p.name AS productName,
            p.description AS productDescription, p.quantity AS productQuantity, p.createdAt AS productCreatedAt, p.updatedAt AS productUpdatedAt,
            p.file AS productFile, p.price AS productPrice, p.productSize, p.type AS productType,
            p.imageUrl AS productImageUrl, p.currency AS productCurrency
      FROM orders o
      INNER JOIN users u ON o.userId = u.id
      LEFT JOIN order_items oi ON oi.orderId = o.id
      LEFT JOIN products p ON p.id = oi.productId
      LEFT JOIN order_items i ON i.id = oi.id
  `;

    sqlConnection.query(fetchOrdersQuery, (error, results) => {
      if (error) return errReturned(res, error);

      const allOrders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              currency: row.productCurrency,
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: row.productPrice,
              size: row.productSize,
              type: row.productType,
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt
            },
            quantity: row.itemQuantity
          });
        } else {
          orders.push({
            orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  currency: row.productCurrency,
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  file: row.productFile,
                  price: row.productPrice,
                  size: row.productSize,
                  type: row.productType,
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                  updatedAt: row.productUpdatedAt
                },
                quantity: row.itemQuantity
              }
            ],
            userId: {
              id: row.userId,
              name: row.userName,
              gender: row.userGender
            },
            totalAmount: row.totalAmount,
            currency: row.currency,
            reciptUrl: row.reciptUrl,
            transactionId: row.transactionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          });
        }

        return orders;
      }, []);

      const graph_hourly = getEarningsDataByTimeline(allOrders, 'hourly');
      const graph_weekly = getEarningsDataByTimeline(allOrders, 'weekly');
      const graph_1m = getEarningsDataByTimeline(allOrders, '1m');

      return sendResponse(res, SUCCESS, "Earning Graph Data", { graph_hourly, graph_weekly, graph_1m, })
    });
  } catch (error) {
    return errReturned(res, error);
  }
}


/**
 * Get Combined Orders Graph
 */
exports.getCombinedOrdersGraphs = async (req, res) => {
  try {
    const filters = req.body;

    const fetchOrdersQuery = `
      SELECT o.orderNumber, o.status, o.id AS orderId,
            u.gender AS userGender, u.id AS userId, u.name AS userName, u.country AS userCountry,
            o.totalAmount, o.currency, o.reciptUrl, o.transactionId, o.createdAt, o.updatedAt,
            i.id AS itemId, i.quantity AS itemQuantity,
            p.currency AS productCurrency, p.id AS productId, p.name AS productName,
            p.description AS productDescription, p.quantity AS productQuantity, p.createdAt AS productCreatedAt, p.updatedAt AS productUpdatedAt,
            p.file AS productFile, p.price AS productPrice, p.productSize, p.type AS productType,
            p.imageUrl AS productImageUrl, p.currency AS productCurrency
      FROM orders o
      INNER JOIN users u ON o.userId = u.id
      LEFT JOIN order_items oi ON oi.orderId = o.id
      LEFT JOIN products p ON p.id = oi.productId
      LEFT JOIN order_items i ON i.id = oi.id
      WHERE o.createdAt BETWEEN ? AND ?
    `;

    let fromDate = new Date();
    let toDate = new Date();

    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.toDate !== null) {
      fromDate = new Date(filters.fromDate);
      toDate = new Date(filters.toDate);
    } else {
      fromDate.setDate(toDate.getDate() - 30);
    }

    sqlConnection.query(fetchOrdersQuery, [fromDate, toDate], (error, results) => {
      if (error) return errReturned(res, error);


      const allOrders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              currency: row.productCurrency,
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: row.productPrice,
              size: row.productSize,
              type: row.productType,
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt
            },
            quantity: row.itemQuantity
          });
        } else {
          orders.push({
            orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  currency: row.productCurrency,
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  file: row.productFile,
                  price: row.productPrice,
                  size: row.productSize,
                  type: row.productType,
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                  updatedAt: row.productUpdatedAt
                },
                quantity: row.itemQuantity
              }
            ],
            userId: {
              id: row.userId,
              name: row.userName,
              gender: row.userGender,
              country: row.userCountry,
            },
            totalAmount: row.totalAmount,
            currency: row.currency,
            reciptUrl: row.reciptUrl,
            transactionId: row.transactionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          });
        }

        return orders;
      }, []);

      // return sendResponse(res, BADREQUEST, "allOrders", allOrders)

      const graph_hourly = getCombinedOrdersDataByTimeline(allOrders, 'hourly', filters);
      const graph_weekly = getCombinedOrdersDataByTimeline(allOrders, 'weekly', filters);
      const graph_1m = getCombinedOrdersDataByTimeline(allOrders, '1m', filters);

      return sendResponse(res, SUCCESS, "", { graph_hourly, graph_weekly, graph_1m });
    });
  } catch (error) {
    return errReturned(res, error);
  }
}


/**
 * Get Value vs Order Graph
 */
exports.getValueVsOrderGraph = async (req, res) => {
  try {
    const { fetchOrdersQuery, fromDate, toDate } = getOrdersBetweenDatesQuery(req.body);

    sqlConnection.query(fetchOrdersQuery, [fromDate, toDate], (error, results) => {
      if (error) return errReturned(res, error);

      const allOrders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              currency: row.productCurrency,
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: row.productPrice,
              size: row.productSize,
              type: row.productType,
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt
            },
            quantity: row.itemQuantity
          });
        } else {
          orders.push({
            orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  currency: row.productCurrency,
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  file: row.productFile,
                  price: row.productPrice,
                  size: row.productSize,
                  type: row.productType,
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                  updatedAt: row.productUpdatedAt
                },
                quantity: row.itemQuantity
              }
            ],
            userId: {
              id: row.userId,
              name: row.userName,
              gender: row.userGender,
              country: row.userCountry,
            },
            totalAmount: row.totalAmount,
            currency: row.currency,
            reciptUrl: row.reciptUrl,
            transactionId: row.transactionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          });
        }

        return orders;
      }, []);

      const startDate = moment(fromDate);
      const endDate = moment(toDate);

      let labels = [];
      let data = [];

      for (let date = startDate.clone(); date <= endDate; date.add(1, 'day')) {
        const formattedDate = date.format('DD MMM YYYY');
        const ordersOnDate = allOrders.filter(order => {
          const orderDate = moment(order.createdAt);
          return orderDate.isSame(date, 'day');
        });

        labels.push(formattedDate);
        data.push(ordersOnDate);
      }

      const graph = {
        labels,
        series: [
          {
            name: 'Orders',
            id: 1,
            color: colors[0],
            data: data.map(el => el !== 0 ? el.length : el)
          },
          {
            name: 'Earnings',
            id: 2,
            color: colors[1],
            data: data.map(el => el !== 0 ? el.map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el)
          },
        ]
      };

      return sendResponse(res, SUCCESS, "", { graph });
    });
  } catch (error) {
    return errReturned(res, error);
  }
}


/**
 * Get Value Sales by Month Graph
 */
exports.getValueSalesByMonthGraph = async (req, res) => {
  try {
    const { fetchOrdersQuery, fromDate, toDate } = getOrdersBetweenDatesQuery(req.body);

    sqlConnection.query(fetchOrdersQuery, [fromDate, toDate], (error, results) => {
      if (error) return errReturned(res, error);

      const allOrders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              currency: row.productCurrency,
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: row.productPrice,
              size: row.productSize,
              type: row.productType,
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt
            },
            quantity: row.itemQuantity
          });
        } else {
          orders.push({
            orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  currency: row.productCurrency,
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  file: row.productFile,
                  price: row.productPrice,
                  size: row.productSize,
                  type: row.productType,
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                  updatedAt: row.productUpdatedAt
                },
                quantity: row.itemQuantity
              }
            ],
            userId: {
              id: row.userId,
              name: row.userName,
              gender: row.userGender,
              country: row.userCountry,
            },
            totalAmount: row.totalAmount,
            currency: row.currency,
            reciptUrl: row.reciptUrl,
            transactionId: row.transactionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          });
        }

        return orders;
      }, []);

      const startDate = moment(fromDate);
      const endDate = moment(toDate);

      let labels = [];
      let data = [];

      const diffInMonths = endDate.diff(startDate, 'months');

      for (let i = 0; i <= diffInMonths; i++) {
        const currentDate = startDate.clone().add(i, 'months');
        const formattedMonth = currentDate.format('MMM YYYY');
        const ordersInMonth = allOrders.filter(order => {
          const orderDate = moment(order.createdAt);
          return (
            orderDate.isSameOrAfter(currentDate.startOf('month')) &&
            orderDate.isSameOrBefore(currentDate.endOf('month'))
          );
        });

        labels.push(formattedMonth);
        data.push(ordersInMonth);
      }

      const graph = {
        labels,
        series: [
          {
            name: 'Orders',
            id: 1,
            color: colors[0],
            data: data.map(el => el !== 0 ? el.length : el)
          },
          {
            name: 'Earnings',
            id: 2,
            color: colors[1],
            data: data.map(el => el !== 0 ? el.map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el)
          },
        ]
      };

      return sendResponse(res, SUCCESS, "", { graph });
    });
  } catch (error) {
    return errReturned(res, error);
  }
}


/**
 * Get Sales Registered by Year Graph
 */
exports.getSalesRegisteredByYearGraph = async (req, res) => {
  try {
    const { fetchOrdersQuery, fromDate, toDate } = getOrdersBetweenDatesQuery(req.body);

    sqlConnection.query(fetchOrdersQuery, [fromDate, toDate], (error, results) => {
      if (error) return errReturned(res, error);

      const allOrders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              currency: row.productCurrency,
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: row.productPrice,
              size: row.productSize,
              type: row.productType,
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt
            },
            quantity: row.itemQuantity
          });
        } else {
          orders.push({
            orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  currency: row.productCurrency,
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  file: row.productFile,
                  price: row.productPrice,
                  size: row.productSize,
                  type: row.productType,
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                  updatedAt: row.productUpdatedAt
                },
                quantity: row.itemQuantity
              }
            ],
            userId: {
              id: row.userId,
              name: row.userName,
              gender: row.userGender,
              country: row.userCountry,
            },
            totalAmount: row.totalAmount,
            currency: row.currency,
            reciptUrl: row.reciptUrl,
            transactionId: row.transactionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          });
        }

        return orders;
      }, []);

      const startDate = moment(fromDate);
      const endDate = moment(toDate);

      let labels = [];
      let data = [];

      const startYear = startDate.year();
      const endYear = endDate.year();

      for (let year = startYear; year <= endYear; year++) {
        const startOfYear = moment({ year, month: 0, day: 1 });
        const endOfYear = moment({ year, month: 11, day: 31 });

        const formattedYear = startOfYear.format('YYYY');
        const ordersInYear = allOrders.filter(order => {
          const orderDate = moment(order.createdAt);
          return (
            orderDate.isSameOrAfter(startOfYear) &&
            orderDate.isSameOrBefore(endOfYear)
          );
        });

        labels.push(formattedYear);
        data.push(ordersInYear);
      }

      const graph = {
        labels,
        series: [
          {
            name: 'Orders',
            id: 1,
            color: colors[0],
            data: data.map(el => el !== 0 ? el.length : el)
          },
          {
            name: 'Earnings',
            id: 2,
            color: colors[1],
            data: data.map(el => el !== 0 ? el.map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el)
          },
        ]
      };

      return sendResponse(res, SUCCESS, "", { graph });
    });
  } catch (error) {
    return errReturned(res, error);
  }
}


/**
 * Get Sales by Hour of the Day Graph
 */
exports.getSalesByHourOfTheDayGraph = async (req, res) => {
  try {
    const { fetchOrdersQuery, fromDate, toDate } = getOrdersBetweenDatesQuery(req.body);

    sqlConnection.query(fetchOrdersQuery, [fromDate, toDate], (error, results) => {
      if (error) return errReturned(res, error);

      const allOrders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              currency: row.productCurrency,
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: row.productPrice,
              size: row.productSize,
              type: row.productType,
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt
            },
            quantity: row.itemQuantity
          });
        } else {
          orders.push({
            orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  currency: row.productCurrency,
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  file: row.productFile,
                  price: row.productPrice,
                  size: row.productSize,
                  type: row.productType,
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                  updatedAt: row.productUpdatedAt
                },
                quantity: row.itemQuantity
              }
            ],
            userId: {
              id: row.userId,
              name: row.userName,
              gender: row.userGender,
              country: row.userCountry,
            },
            totalAmount: row.totalAmount,
            currency: row.currency,
            reciptUrl: row.reciptUrl,
            transactionId: row.transactionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          });
        }

        return orders;
      }, []);

      let labels = [];
      let data = [];

      for (let hour = 0; hour < 24; hour++) {
        const startHour = hour;
        const endHour = hour + 1;

        const formattedHour = moment().hour(hour).minute(0).second(0).format('HH');
        const ordersInHour = allOrders.filter(order => {
          const orderDate = moment(order.createdAt);
          const orderHour = orderDate.hour();
          return orderHour >= startHour && orderHour < endHour;
        });

        labels.push(formattedHour);
        data.push(ordersInHour);
      }

      const graph = {
        labels,
        series: [
          {
            name: 'Orders',
            id: 1,
            color: colors[0],
            data: data.map(el => el !== 0 ? el.length : el)
          },
          // {
          //   name: 'Earnings',
          //   id: 2,
          //   color: colors[1],
          //   data: data.map(el => el !== 0 ? el.map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el)
          // },
        ]
      };

      return sendResponse(res, SUCCESS, "", { graph });
    });
  } catch (error) {
    return errReturned(res, error);
  }
}


/**
 * Get Sales by Day of the Week Graph
 */
exports.getSalesByDayOfTheWeekGraph = async (req, res) => {
  try {
    const { fetchOrdersQuery, fromDate, toDate } = getOrdersBetweenDatesQuery(req.body);

    sqlConnection.query(fetchOrdersQuery, [fromDate, toDate], (error, results) => {
      if (error) return errReturned(res, error);

      const allOrders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              currency: row.productCurrency,
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: row.productPrice,
              size: row.productSize,
              type: row.productType,
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt
            },
            quantity: row.itemQuantity
          });
        } else {
          orders.push({
            orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  currency: row.productCurrency,
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  file: row.productFile,
                  price: row.productPrice,
                  size: row.productSize,
                  type: row.productType,
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                  updatedAt: row.productUpdatedAt
                },
                quantity: row.itemQuantity
              }
            ],
            userId: {
              id: row.userId,
              name: row.userName,
              gender: row.userGender,
              country: row.userCountry,
            },
            totalAmount: row.totalAmount,
            currency: row.currency,
            reciptUrl: row.reciptUrl,
            transactionId: row.transactionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          });
        }

        return orders;
      }, []);

      let labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      let data = [0, 0, 0, 0, 0, 0, 0];

      const ordersByDayOfWeek = {};

      allOrders.forEach(order => {
        const orderDate = moment(order.createdAt);
        const dayOfWeek = orderDate.format('dddd');

        if (!ordersByDayOfWeek[dayOfWeek]) {
          ordersByDayOfWeek[dayOfWeek] = [];
        }

        ordersByDayOfWeek[dayOfWeek].push(order);
      });

      labels.forEach((day, index) => {
        if (ordersByDayOfWeek[day]) {
          data[index] = ordersByDayOfWeek[day];
        }
      });

      const graph = {
        labels,
        series: [
          {
            name: 'Orders',
            id: 1,
            color: colors[0],
            data: data.map(el => el !== 0 ? el.length : el)
          },
          // {
          //   name: 'Earnings',
          //   id: 2,
          //   color: colors[1],
          //   data: data.map(el => el !== 0 ? el.map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el)
          // },
        ]
      };

      return sendResponse(res, SUCCESS, "", { graph });
    });
  } catch (error) {
    return errReturned(res, error);
  }
}


/**
 * Get Combined Graph
 */
exports.getAllCountriesGraphs = async (req, res) => {
  try {
    const filters = req.body;

    const fetchOrdersQuery = `
      SELECT o.orderNumber, o.status, o.id AS orderId,
            u.gender AS userGender, u.id AS userId, u.name AS userName, u.country AS userCountry,
            o.totalAmount, o.currency, o.reciptUrl, o.transactionId, o.createdAt, o.updatedAt,
            i.id AS itemId, i.quantity AS itemQuantity,
            p.currency AS productCurrency, p.id AS productId, p.name AS productName,
            p.description AS productDescription, p.quantity AS productQuantity, p.createdAt AS productCreatedAt, p.updatedAt AS productUpdatedAt,
            p.file AS productFile, p.price AS productPrice, p.productSize, p.type AS productType,
            p.imageUrl AS productImageUrl, p.currency AS productCurrency
      FROM orders o
      INNER JOIN users u ON o.userId = u.id
      LEFT JOIN order_items oi ON oi.orderId = o.id
      LEFT JOIN products p ON p.id = oi.productId
      LEFT JOIN order_items i ON i.id = oi.id
  `;

    sqlConnection.query(fetchOrdersQuery, (error, results) => {
      if (error) return errReturned(res, error);

      const allOrders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              currency: row.productCurrency,
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: row.productPrice,
              size: row.productSize,
              type: row.productType,
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt
            },
            quantity: row.itemQuantity
          });
        } else {
          orders.push({
            orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  currency: row.productCurrency,
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  file: row.productFile,
                  price: row.productPrice,
                  size: row.productSize,
                  type: row.productType,
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                  updatedAt: row.productUpdatedAt
                },
                quantity: row.itemQuantity
              }
            ],
            userId: {
              id: row.userId,
              name: row.userName,
              gender: row.userGender,
              country: row.userCountry,
            },
            totalAmount: row.totalAmount,
            currency: row.currency,
            reciptUrl: row.reciptUrl,
            transactionId: row.transactionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          });
        }

        return orders;
      }, []);
      const graph_hourly = getCountriesDataByTimeline(allOrders, 'hourly', filters);
      const graph_weekly = getCountriesDataByTimeline(allOrders, 'weekly', filters);
      const graph_1m = getCountriesDataByTimeline(allOrders, '1m', filters);

      return sendResponse(res, SUCCESS, "", { graph_hourly, graph_weekly, graph_1m });
    });
  } catch (error) {
    return errReturned(res, error);
  }
}


/**
 * Get Genders Graph
 */
exports.getGendersGraphs = async (req, res) => {
  try {
    const filters = req.body;

    const fetchOrdersQuery = `
      SELECT o.orderNumber, o.status, o.id AS orderId,
            u.gender AS userGender, u.id AS userId, u.name AS userName, u.country AS userCountry,
            o.totalAmount, o.currency, o.reciptUrl, o.transactionId, o.createdAt, o.updatedAt,
            i.id AS itemId, i.quantity AS itemQuantity,
            p.currency AS productCurrency, p.id AS productId, p.name AS productName,
            p.description AS productDescription, p.quantity AS productQuantity, p.createdAt AS productCreatedAt, p.updatedAt AS productUpdatedAt,
            p.file AS productFile, p.price AS productPrice, p.productSize, p.type AS productType,
            p.imageUrl AS productImageUrl, p.currency AS productCurrency
      FROM orders o
      INNER JOIN users u ON o.userId = u.id
      LEFT JOIN order_items oi ON oi.orderId = o.id
      LEFT JOIN products p ON p.id = oi.productId
      LEFT JOIN order_items i ON i.id = oi.id
  `;

    sqlConnection.query(fetchOrdersQuery, (error, results) => {
      if (error) return errReturned(res, error);

      const allOrders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              currency: row.productCurrency,
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: row.productPrice,
              size: row.productSize,
              type: row.productType,
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt
            },
            quantity: row.itemQuantity
          });
        } else {
          orders.push({
            orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  currency: row.productCurrency,
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  file: row.productFile,
                  price: row.productPrice,
                  size: row.productSize,
                  type: row.productType,
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                  updatedAt: row.productUpdatedAt
                },
                quantity: row.itemQuantity
              }
            ],
            userId: {
              id: row.userId,
              name: row.userName,
              gender: row.userGender,
              country: row.userCountry,
            },
            totalAmount: row.totalAmount,
            currency: row.currency,
            reciptUrl: row.reciptUrl,
            transactionId: row.transactionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          });
        }

        return orders;
      }, []);
      const graph_hourly = getGendersDataByTimeline(allOrders, 'hourly', filters);
      const graph_weekly = getGendersDataByTimeline(allOrders, 'weekly', filters);
      const graph_1m = getGendersDataByTimeline(allOrders, '1m', filters);

      return sendResponse(res, SUCCESS, "", { graph_hourly, graph_weekly, graph_1m });
    });
  } catch (error) {
    return errReturned(res, error);
  }
}


/**
 * Combined Earnings Graphs Data
 */
exports.getCombinedEarningsGraphs = async (req, res) => {
  try {
    const filters = req.body;

    const fetchOrdersQuery = `
      SELECT o.orderNumber, o.status, o.id AS orderId,
            u.gender AS userGender, u.id AS userId, u.name AS userName, u.country AS userCountry,
            o.totalAmount, o.currency, o.reciptUrl, o.transactionId, o.createdAt, o.updatedAt,
            i.id AS itemId, i.quantity AS itemQuantity,
            p.currency AS productCurrency, p.id AS productId, p.name AS productName,
            p.description AS productDescription, p.quantity AS productQuantity, p.createdAt AS productCreatedAt, p.updatedAt AS productUpdatedAt,
            p.file AS productFile, p.price AS productPrice, p.productSize, p.type AS productType,
            p.imageUrl AS productImageUrl, p.currency AS productCurrency
      FROM orders o
      INNER JOIN users u ON o.userId = u.id
      LEFT JOIN order_items oi ON oi.orderId = o.id
      LEFT JOIN products p ON p.id = oi.productId
      LEFT JOIN order_items i ON i.id = oi.id
  `;

    sqlConnection.query(fetchOrdersQuery, (error, results) => {
      if (error) return errReturned(res, error);

      const allOrders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              currency: row.productCurrency,
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: row.productPrice,
              size: row.productSize,
              type: row.productType,
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt
            },
            quantity: row.itemQuantity
          });
        } else {
          orders.push({
            orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  currency: row.productCurrency,
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  file: row.productFile,
                  price: row.productPrice,
                  size: row.productSize,
                  type: row.productType,
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                  updatedAt: row.productUpdatedAt
                },
                quantity: row.itemQuantity
              }
            ],
            userId: {
              id: row.userId,
              name: row.userName,
              gender: row.userGender,
              country: row.userCountry,
            },
            totalAmount: row.totalAmount,
            currency: row.currency,
            reciptUrl: row.reciptUrl,
            transactionId: row.transactionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          });
        }

        return orders;
      }, []);



      const graph_hourly = getCombinedEarningsDataByTimeline(allOrders, 'hourly', filters);
      const graph_weekly = getCombinedEarningsDataByTimeline(allOrders, 'weekly', filters);
      const graph_1m = getCombinedEarningsDataByTimeline(allOrders, '1m', filters);

      return sendResponse(res, SUCCESS, "Earning Graph Data", { graph_hourly, graph_weekly, graph_1m, })
    });
  } catch (error) {
    return errReturned(res, error);
  }
}


/**
* Get All Orders
**/
exports.getAllOrders = async (req, res) => {
  try {
    const fetchOrdersQuery = `
      SELECT o.orderNumber, o.status, o.id AS orderId,
            u.gender AS userGender, u.id AS userId, u.username AS userName, u.email AS email,
            o.totalAmount, o.currency, o.reciptUrl, o.transactionId,o.vat, o.createdAt, o.updatedAt,
            i.id AS itemId, i.quantity AS itemQuantity,
            p.currency AS productCurrency, p.id AS productId, p.name AS productName,
            p.description AS productDescription, p.quantity AS productQuantity, p.createdAt AS productCreatedAt, p.updatedAt AS productUpdatedAt,
            p.file AS productFile, p.price AS productPrice, p.productSize, p.type AS productType,
            p.imageUrl AS productImageUrl, p.currency AS productCurrency
      FROM orders o
      INNER JOIN users u ON o.userId = u.id
      LEFT JOIN order_items oi ON oi.orderId = o.id
      LEFT JOIN products p ON p.id = oi.productId
      LEFT JOIN order_items i ON i.id = oi.id
  `;

    sqlConnection.query(fetchOrdersQuery, (error, results) => {
      if (error) return errReturned(res, error);

      const orders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              currency: row.productCurrency,
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: row.productPrice,
              size: row.productSize,
              type: row.productType,
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt
            },
            quantity: row.itemQuantity
          });
        } else {
          orders.push({
            orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  currency: row.productCurrency,
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  file: row.productFile,
                  price: row.productPrice,
                  size: row.productSize,
                  type: row.productType,
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                  updatedAt: row.productUpdatedAt
                },
                quantity: row.itemQuantity,
              }
            ],
            userId: {
              id: row.userId,
              email: row.email,
              username: row.userName,
              gender: row.userGender
            },
            vat: row.vat,
            totalAmount: row.totalAmount,
            currency: row.currency,
            reciptUrl: row.reciptUrl,
            transactionId: row.transactionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          });
        }

        return orders;
      }, []);

      if (!orders) return sendResponse(res, BADREQUEST, "No Order record found");

      return sendResponse(res, SUCCESS, "Order record found successfully", orders);
    });
  } catch (error) {
    return errReturned(res, error);
  }
};

/**
    * USER ORDERS 
 */

exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming you are passing userId as a parameter

    const fetchUserOrdersQuery = `
        SELECT o.orderNumber, o.status, o.id AS orderId,
        u.gender AS userGender, u.id AS userId, u.username, u.avatar,
        o.totalAmount, o.currency, o.reciptUrl, o.transactionId,o.vat, o.createdAt, o.updatedAt,
        i.id AS itemId, i.quantity AS itemQuantity,
        p.id AS productId, p.name AS productName,
        p.description AS productDescription, p.quantity AS productQuantity,
        p.file AS productFile, p.price AS productPrice, p.productSize, p.type AS productType,
        p.imageUrl AS productImageUrl, p.currency AS productCurrency,
        p.createdAt AS productCreatedAt, p.updatedAt AS productUpdatedAt
    FROM orders o
    INNER JOIN users u ON o.userId = u.id
    LEFT JOIN order_items oi ON oi.orderId = o.id
    LEFT JOIN products p ON p.id = oi.productId
    LEFT JOIN order_items i ON i.id = oi.id
    WHERE o.userId = ?
      `;

    sqlConnection.query(fetchUserOrdersQuery, [userId], (error, results) => {

      if (error) return errReturned(res, error);

      const orders = results.reduce((orders, row) => {
        const existingOrder = orders.find(order => order.orderId === row.orderId);

        if (existingOrder) {
          existingOrder.items.push({
            id: row.itemId,
            productId: {
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              productQuantity: row.productQuantity,
              file: row.productFile,
              price: Number(row.productPrice),
              imageUrl: row.productImageUrl,
              createdAt: row.productCreatedAt,
            },
            quantity: row.itemQuantity,
            // vat: row.vat,
            totalAmount: Number(row.productPrice) * row.itemQuantity
          });
        } else {
          orders.push({
            // orderNumber: row.orderNumber,
            status: row.status,
            orderId: row.orderId,
            items: [
              {
                id: row.itemId,
                productId: {
                  id: row.productId,
                  name: row.productName,
                  description: row.productDescription,
                  quantity: row.productQuantity,
                  price: Number(row.productPrice),
                  imageUrl: row.productImageUrl,
                  createdAt: row.productCreatedAt,
                },
                quantity: row.itemQuantity,
                totalAmount: Number(row.productPrice) * row.itemQuantity
              }
            ],
            totalAmount: Number(row.totalAmount),
            // reciptUrl: row.reciptUrl,
            vat: row.vat,
            createdAt: row.createdAt,
          });
        }

        return orders;
      }, []);

      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (!orders || orders.length === 0) {
        return sendResponse(res, BADREQUEST, "No orders found for the user");
      }

      return sendResponse(res, SUCCESS, "User orders found successfully", orders);
    });
  } catch (error) {
    return errReturned(res, error);
  }
};


/**
* Set Order Status
**/
exports.setStatus = async (req, res) => {
  try {
    const { orderId, selectedStatus } = req['body'];

    sqlConnection.query(`SELECT * FROM orders WHERE id = ?`, [orderId], (error, results) => {
      if (error) return errReturned(res, error);
      if (results.length === 0) return sendResponse(res, BADREQUEST, "No Order record found");

      sqlConnection.query(`SELECT * FROM order_items WHERE orderId = ?`, [orderId], (err, orderItemsResult) => {
        if (err) return errReturned(res, err);

        const values = [selectedStatus, orderId];
        sqlConnection.query(`UPDATE orders SET status = ? WHERE id = ?`, values, (error, result) => {
          if (error) return errReturned(res, error);

          if (result.affectedRows === 1) {
            sqlConnection.query(`SELECT * FROM orders WHERE id = ?`, [orderId], (err, results) => {
              if (err) return errReturned(res, err);

              let updatedOrder = results[0];

              updatedOrder.items = orderItemsResult;

              return sendResponse(res, SUCCESS, "Order Status updated successfully", updatedOrder);
            });
          } else return sendResponse(res, BADREQUEST, "Status update failed");
        });
      });
    });
  } catch (error) {
    return errReturned(res, error);
  }
};

/**
 * Get Earnings By Timeline
 */
const getEarningsDataByTimeline = (allOrders, barChartTimeline) => {

  let startDate, labelFormat;

  if (barChartTimeline === '1m') {
    startDate = moment().subtract(1, 'month').startOf('day');
    labelFormat = 'MMM DD';
  } else if (barChartTimeline === 'hourly') {
    startDate = moment().startOf('day').hour(0);
    labelFormat = 'HH:mm';
  } else if (barChartTimeline === 'weekly') {
    startDate = moment().startOf('month');
    labelFormat = 'MMM DD';
  }

  const currentDate = moment().endOf('day');
  let labels = [];
  let data = [];

  if (barChartTimeline === 'weekly') {
    const weeksData = Array(4).fill(0).map(() => []);

    for (const order of allOrders) {
      const orderDate = moment(order.createdAt);
      const isLastFourWeeks = orderDate.isSameOrAfter(moment().subtract(3, 'weeks').startOf('week'));

      if (isLastFourWeeks) {
        const weekIndex = moment(order.createdAt).diff(moment().subtract(3, 'weeks').startOf('week'), 'weeks');
        if (weekIndex >= 0 && weekIndex < 4) {
          weeksData[weekIndex].push(order);
        }
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
      barChartTimeline === 'hourly'
        ? date.clone().add(1, 'hour')
        : date.clone().add(1, 'day')
    ) {
      const formattedDate = date.format(labelFormat);
      const ordersOnDate = allOrders.filter(order => {
        const orderDate = moment(order.createdAt);
        return (
          barChartTimeline === 'hourly'
            ? orderDate.isSame(date, 'hour')
            : orderDate.isSame(date, 'day')
        );
      });
      const totalOrders = ordersOnDate;

      labels.push(formattedDate);
      data.push(totalOrders);
    }
  }

  return {
    labels: labels,
    series:
      [{
        name: 'All Earnings',
        id: 1,
        data: data.map(el => el !== 0 ? el.map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el),
        color: colors[0]
      },
      ...productTypes.map((type, idx) =>
      ({
        name: `${type} Earnings`,
        id: idx + 2,
        data: data.map(el => el !== 0 ? el.filter(el => !!el.items.find(st => st.productId?.type === type)).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el),
        color: colors[idx + 1]
      })
      )
      ],
    options: {
      scales: {
        y: {
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  };
}

/**
 * Get Combined Earnings Data By Timeline
 */
const getCombinedEarningsDataByTimeline = (allOrders, barChartTimeline, filters) => {

  let startDate, labelFormat;

  if (barChartTimeline === '1m') {
    startDate = moment().subtract(1, 'month').startOf('day');
    labelFormat = 'MMM DD';
  } else if (barChartTimeline === 'hourly') {
    startDate = moment().startOf('day').hour(0);
    labelFormat = 'HH:mm';
  } else if (barChartTimeline === 'weekly') {
    startDate = moment().startOf('month');
    labelFormat = 'MMM DD';
  }

  const currentDate = moment().endOf('day');
  let labels = [];
  let data = [];

  if (barChartTimeline === 'weekly') {
    const weeksData = Array(4).fill(0).map(() => []);

    for (const order of allOrders) {
      const orderDate = moment(order.createdAt);
      const isLastFourWeeks = orderDate.isSameOrAfter(moment().subtract(3, 'weeks').startOf('week'));

      if (isLastFourWeeks) {
        const weekIndex = moment(order.createdAt).diff(moment().subtract(3, 'weeks').startOf('week'), 'weeks');
        if (weekIndex >= 0 && weekIndex < 4) {
          weeksData[weekIndex].push(order);
        }
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
      barChartTimeline === 'hourly'
        ? date.clone().add(1, 'hour')
        : date.clone().add(1, 'day')
    ) {
      const formattedDate = date.format(labelFormat);
      const ordersOnDate = allOrders.filter(order => {
        const orderDate = moment(order.createdAt);
        return (
          barChartTimeline === 'hourly'
            ? orderDate.isSame(date, 'hour')
            : orderDate.isSame(date, 'day')
        );
      });
      const totalOrders = ordersOnDate;

      labels.push(formattedDate);
      data.push(totalOrders);
    }
  }

  const genderFilter = filters?.gender?.toLowerCase() || 'all';
  const countryFilter = filters?.countries && !filters?.countries.includes('All') ? filters?.countries : [];

  return {
    labels: labels,
    series:
      [{
        name: 'All Earnings',
        id: 1,
        data: (genderFilter === 'all' && countryFilter.length === 0) ?
          data.map(el => el !== 0 ? el.map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el) :
          (genderFilter === 'all' && countryFilter.length !== 0) ?
            data.map(el => el !== 0 ? el.filter(st => countryFilter.includes(st.userId.country)).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el) :
            (genderFilter !== 'all' && countryFilter.length === 0) ?
              data.map(el => el !== 0 ? el.filter(st => st.userId.gender === genderFilter).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el) :
              data.map(el => el !== 0 ? el.filter(st => (st.userId.gender === genderFilter && countryFilter.includes(st.userId.country))).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el),


        color: colors[0]
      },
      ...productTypes.map((type, idx) =>
      ({
        name: `${type} Earnings`,
        id: idx + 2,
        data: (genderFilter === 'all' && countryFilter.length === 0) ?
          data.map(el => el !== 0 ? el.filter(el => !!el.items.find(st => st.productId?.type === type)).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el) :
          (genderFilter === 'all' && countryFilter.length !== 0) ?
            data.map(el => el !== 0 ? el.filter(el => !!el.items.find(st => st.productId?.type === type) && countryFilter.includes(el.userId.country)).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el) :
            (genderFilter !== 'all' && countryFilter.length === 0) ?
              data.map(el => el !== 0 ? el.filter(el => !!el.items.find(st => st.productId?.type === type) && el.userId.gender === genderFilter).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el) :
              data.map(el => el !== 0 ? el.filter(el => (!!el.items.find(st => st.productId?.type === type) && el.userId.gender === genderFilter && countryFilter.includes(el.userId.country))).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el),
        // data.map(el => el !== 0 ? el.filter(el => !!el.items.find(st => st.productId?.type === type)).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el),

        color: colors[idx + 1]
      })
      )
      ],
    options: {
      scales: {
        y: {
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  };
}

/**
 * Get Countries Data by Timeline
 */
const getCountriesDataByTimeline = (allOrders, chartTimeline, filters) => {
  let startDate, labelFormat;

  if (chartTimeline === '1m') { startDate = moment().subtract(1, 'month').startOf('day'); labelFormat = 'MMM DD'; }
  else if (chartTimeline === 'hourly') { startDate = moment().startOf('day').hour(0); labelFormat = 'HH:mm'; }
  else if (chartTimeline === 'weekly') { startDate = moment().startOf('month'); labelFormat = 'MMM DD'; }

  const currentDate = moment().endOf('day');
  let labels = [];
  let data = [];
  if (chartTimeline === 'weekly') {
    const weeksData = Array(4).fill(0).map(() => []);

    for (const order of allOrders) {
      const orderDate = moment(order.createdAt);
      const isLastFourWeeks = orderDate.isSameOrAfter(moment().subtract(3, 'weeks').startOf('week'));

      if (isLastFourWeeks) {
        const weekIndex = moment(order.createdAt).diff(moment().subtract(3, 'weeks').startOf('week'), 'weeks');
        if (weekIndex >= 0 && weekIndex < 4) {
          weeksData[weekIndex].push(order);
        }
      }
    }

    labels = weeksData.map((_, index) => `Week ${index + 1}`);
    data = weeksData;
  }
  else {
    for (
      let date = startDate;
      date <= currentDate;
      date = chartTimeline === 'hourly' ? date.clone().add(1, 'hour') : date.clone().add(1, 'day')
    ) {
      const formattedDate = date.format(labelFormat);
      const ordersOnDate = allOrders.filter(order => {
        const orderDate = moment(order.createdAt);
        return (chartTimeline === 'hourly' ? orderDate.isSame(date, 'hour') : orderDate.isSame(date, 'day'));
      });
      const totalOrders = ordersOnDate;

      labels.push(formattedDate);
      data.push(totalOrders);
    }
  }

  const genderFilter = filters?.gender?.toLowerCase() || 'all';
  const countryFilter = filters?.countries && !filters?.countries.includes('All') ? filters?.countries : [];

  const countries = [];
  const countriesCount = {};

  data.map(el => el !== 0 && el.map(st => st.userId.country != undefined && countries.push(st.userId.country)));

  countries.forEach(country => {
    if (countriesCount[country]) countriesCount[country] += 1;
    else countriesCount[country] = 1;
  });

  let idCounter = 1;

  if (Object.keys(filters).length === 0) {
    filters = {
      selectedOption: 'Orders',
      ordersFilter: [
        { id: 1, checked: true, name: 'Total Orders' },
        { id: 2, checked: false, name: 'Completed Orders' },
        { id: 3, checked: false, name: 'Cancelled Orders' },
        { id: 4, checked: false, name: 'Pending Orders' }
      ],
      earningsFilter: [
        { id: 1, checked: true, name: 'All Earnings' },
        { id: 2, checked: false, name: 'Snacks Earnings' },
        { id: 3, checked: false, name: 'Dairy Earnings' },
        { id: 4, checked: false, name: 'Grocery Earnings' },
        { id: 5, checked: false, name: 'Fruits Earnings' },
        { id: 6, checked: false, name: 'Softdrinks Earnings' },
        { id: 7, checked: false, name: 'Cheese Earnings' },
        { id: 8, checked: false, name: 'Sweets Earnings' },
        { id: 9, checked: false, name: 'Meat Earnings' }
      ],
      gender: 'All',
      countries: []
    }
  }

  const currentCountries = Object.entries(countriesCount).map(([country, value]) => ({
    name: country,
    id: idCounter++,
    // color: colors[idCounter],
    color: colors[9],
    // data: data.map(el => el !== 0 ? el.filter(st => st.userId.country === country).length : el),

    data: filters?.selectedOption === 'Orders' ?
      (
        filters?.ordersFilter[0]?.checked ?
          (
            genderFilter === 'all' ?
              data.map(el => el !== 0 ? el.filter(st => st.userId.country === country).length : el) :
              data.map(el => el !== 0 ? el.filter(st => st.userId.country === country && st.userId.gender === genderFilter).length : el)

          ) : (
            genderFilter === 'all' ?
              data.map(el => el !== 0 ? (
                filters?.ordersFilter?.map(orderFilter => {
                  if (orderFilter?.checked) {
                    if (orderFilter.name === 'Completed Orders') return el.filter(st => st.userId.country === country && st.status === 'COMPLETED').length;
                    if (orderFilter.name === 'Cancelled Orders') return el.filter(st => st.userId.country === country && st.status === 'CANCELLED').length;
                    if (orderFilter.name === 'Pending Orders') return el.filter(st => st.userId.country === country && (st.status === 'PENDING' || st.status === 'IN PROCESS')).length;
                  } else return 0;
                })
              ).reduce((a, b) => a + b, 0) : el) :
              data.map(el => el !== 0 ? (
                filters?.ordersFilter?.map(orderFilter => {
                  if (orderFilter?.checked) {
                    if (orderFilter.name === 'Completed Orders') return el.filter(st => st.userId.country === country && st.status === 'COMPLETED' && st.userId.gender === genderFilter).length;
                    if (orderFilter.name === 'Cancelled Orders') return el.filter(st => st.userId.country === country && st.status === 'CANCELLED' && st.userId.gender === genderFilter).length;
                    if (orderFilter.name === 'Pending Orders') return el.filter(st => st.userId.country === country && (st.status === 'PENDING' || st.status === 'IN PROCESS') && st.userId.gender === genderFilter).length;
                  } else return 0;
                })
              ).reduce((a, b) => a + b, 0) : el)
          )
      ) : (
        filters?.earningsFilter[0]?.checked ?
          (
            genderFilter === 'all' ?
              data.map(el => el !== 0 ? el.filter(st => st.userId.country === country).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el) :
              data.map(el => el !== 0 ? el.filter(st => st.userId.country === country && st.userId.gender === genderFilter).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el)
          ) : (
            genderFilter === 'all' ?
              data.map(el => el !== 0 ? (
                filters?.earningsFilter?.map(earningFilter => {
                  if (earningFilter?.checked) {
                    const type = earningFilter?.name?.split(' ')[0];
                    return el.filter(el => (!!el.items.find(st => st.productId?.type === type) && el.userId.country === country)).map(st => st.totalAmount).reduce((a, b) => a + +b, 0);
                  } else return 0;
                })
              ).reduce((c, d) => c + d, 0) : el) :
              data.map(el => el !== 0 ? (
                filters?.earningsFilter?.map(earningFilter => {
                  if (earningFilter?.checked) {
                    const type = earningFilter?.name?.split(' ')[0];
                    return el.filter(el => (!!el.items.find(st => st.productId?.type === type) && el.userId.country === country && el.userId.gender === genderFilter)).map(st => st.totalAmount).reduce((a, b) => a + +b, 0);
                  } else return 0;
                })
              ).reduce((c, d) => c + d, 0) : el)
          )
      )
  }));

  // const countriesList = [...new Set(countries)];

  return {
    labels,
    series: currentCountries
  };
}

/**
 * Get Countries Data by Timeline
 */
const getGendersDataByTimeline = (allOrders, chartTimeline, filters) => {
  let startDate, labelFormat;

  if (chartTimeline === '1m') { startDate = moment().subtract(1, 'month').startOf('day'); labelFormat = 'MMM DD'; }
  else if (chartTimeline === 'hourly') { startDate = moment().startOf('day').hour(0); labelFormat = 'HH:mm'; }
  else if (chartTimeline === 'weekly') { startDate = moment().startOf('month'); labelFormat = 'MMM DD'; }

  const currentDate = moment().endOf('day');
  let labels = [];
  let data = [];
  if (chartTimeline === 'weekly') {
    const weeksData = Array(4).fill(0).map(() => []);

    for (const order of allOrders) {
      const orderDate = moment(order.createdAt);
      const isLastFourWeeks = orderDate.isSameOrAfter(moment().subtract(3, 'weeks').startOf('week'));

      if (isLastFourWeeks) {
        const weekIndex = moment(order.createdAt).diff(moment().subtract(3, 'weeks').startOf('week'), 'weeks');
        if (weekIndex >= 0 && weekIndex < 4) {
          weeksData[weekIndex].push(order);
        }
      }
    }

    labels = weeksData.map((_, index) => `Week ${index + 1}`);
    data = weeksData;
  }
  else {
    for (
      let date = startDate;
      date <= currentDate;
      date = chartTimeline === 'hourly' ? date.clone().add(1, 'hour') : date.clone().add(1, 'day')
    ) {
      const formattedDate = date.format(labelFormat);
      const ordersOnDate = allOrders.filter(order => {
        const orderDate = moment(order.createdAt);
        return (chartTimeline === 'hourly' ? orderDate.isSame(date, 'hour') : orderDate.isSame(date, 'day'));
      });
      const totalOrders = ordersOnDate;

      labels.push(formattedDate);
      data.push(totalOrders);
    }
  }

  const genderFilter = filters?.gender?.toLowerCase() || 'all';
  const countryFilter = filters?.countries && !filters?.countries.includes('All') ? filters?.countries : [];

  if (Object.keys(filters).length === 0) {
    filters = {
      selectedOption: 'Orders',
      ordersFilter: [
        { id: 1, checked: true, name: 'Total Orders' },
        { id: 2, checked: false, name: 'Completed Orders' },
        { id: 3, checked: false, name: 'Cancelled Orders' },
        { id: 4, checked: false, name: 'Pending Orders' }
      ],
      earningsFilter: [
        { id: 1, checked: true, name: 'All Earnings' },
        { id: 2, checked: false, name: 'Snacks Earnings' },
        { id: 3, checked: false, name: 'Dairy Earnings' },
        { id: 4, checked: false, name: 'Grocery Earnings' },
        { id: 5, checked: false, name: 'Fruits Earnings' },
        { id: 6, checked: false, name: 'Softdrinks Earnings' },
        { id: 7, checked: false, name: 'Cheese Earnings' },
        { id: 8, checked: false, name: 'Sweets Earnings' },
        { id: 9, checked: false, name: 'Meat Earnings' }
      ],
      gender: 'All',
      countries: []
    }
  }

  return {
    labels,
    series: [
      {
        name: 'Male',
        id: 1,
        color: colors[9],
        data: filters?.selectedOption === 'Orders' ?
          (
            filters?.ordersFilter[0]?.checked ?
              (
                countryFilter.length === 0 ?
                  data.map(el => el !== 0 ? el.filter(st => st.userId.gender === 'male').length : el) :
                  data.map(el => el !== 0 ? el.filter(st => st.userId.gender === 'male' && countryFilter.includes(st.userId.country)).length : el)
              ) : (
                countryFilter.length === 0 ?
                  data.map(el => el !== 0 ? (
                    filters?.ordersFilter?.map(orderFilter => {
                      if (orderFilter?.checked) {
                        if (orderFilter.name === 'Completed Orders') return el.filter(st => st.userId.gender === 'male' && st.status === 'COMPLETED').length;
                        if (orderFilter.name === 'Cancelled Orders') return el.filter(st => st.userId.gender === 'male' && st.status === 'CANCELLED').length;
                        if (orderFilter.name === 'Pending Orders') return el.filter(st => st.userId.gender === 'male' && (st.status === 'PENDING' || st.status === 'IN PROCESS')).length;
                      } else return 0;
                    })
                  ).reduce((a, b) => a + b, 0) : el) :
                  data.map(el => el !== 0 ? (
                    filters?.ordersFilter?.map(orderFilter => {
                      if (orderFilter?.checked) {
                        if (orderFilter.name === 'Completed Orders') return el.filter(st => st.userId.gender === 'male' && st.status === 'COMPLETED' && countryFilter.includes(st.userId.country)).length;
                        if (orderFilter.name === 'Cancelled Orders') return el.filter(st => st.userId.gender === 'male' && st.status === 'CANCELLED' && countryFilter.includes(st.userId.country)).length;
                        if (orderFilter.name === 'Pending Orders') return el.filter(st => st.userId.gender === 'male' && (st.status === 'PENDING' || st.status === 'IN PROCESS') && countryFilter.includes(st.userId.country)).length;
                      } else return 0;
                    })
                  ).reduce((a, b) => a + b, 0) : el)
              )
          ) : (
            filters?.earningsFilter[0]?.checked ?
              (
                countryFilter.length === 0 ?
                  data.map(el => el !== 0 ? el.filter(st => st.userId.gender === 'male').map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el) :
                  data.map(el => el !== 0 ? el.filter(st => st.userId.gender === 'male' && countryFilter.includes(st.userId.country)).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el)
              ) : (
                countryFilter.length === 0 ?
                  data.map(el => el !== 0 ? (
                    filters?.earningsFilter?.map(earningFilter => {
                      if (earningFilter?.checked) {
                        const type = earningFilter?.name?.split(' ')[0];
                        return el.filter(el => (!!el.items.find(st => st.productId?.type === type) && el.userId.gender === 'male')).map(st => st.totalAmount).reduce((a, b) => a + +b, 0);
                      } else return 0;
                    })
                  ).reduce((c, d) => c + d, 0) : el) :
                  data.map(el => el !== 0 ? (
                    filters?.earningsFilter?.map(earningFilter => {
                      if (earningFilter?.checked) {
                        const type = earningFilter?.name?.split(' ')[0];
                        return el.filter(el => (!!el.items.find(st => st.productId?.type === type) && el.userId.gender === 'male' && countryFilter.includes(el.userId.country))).map(st => st.totalAmount).reduce((a, b) => a + +b, 0);
                      } else return 0;
                    })
                  ).reduce((c, d) => c + d, 0) : el)
              )
          )
      },
      {
        name: 'Female',
        id: 2,
        color: colors[9],
        data: filters?.selectedOption === 'Orders' ?
          (
            filters?.ordersFilter[0]?.checked ?
              (
                countryFilter.length === 0 ?
                  data.map(el => el !== 0 ? el.filter(st => st.userId.gender === 'female').length : el) :
                  data.map(el => el !== 0 ? el.filter(st => st.userId.gender === 'female' && countryFilter.includes(st.userId.country)).length : el)
              ) : (
                countryFilter.length === 0 ?
                  data.map(el => el !== 0 ? (
                    filters?.ordersFilter?.map(orderFilter => {
                      if (orderFilter?.checked) {
                        if (orderFilter.name === 'Completed Orders') return el.filter(st => st.userId.gender === 'female' && st.status === 'COMPLETED').length;
                        if (orderFilter.name === 'Cancelled Orders') return el.filter(st => st.userId.gender === 'female' && st.status === 'CANCELLED').length;
                        if (orderFilter.name === 'Pending Orders') return el.filter(st => st.userId.gender === 'female' && (st.status === 'PENDING' || st.status === 'IN PROCESS')).length;
                      } else return 0;
                    })
                  ).reduce((a, b) => a + b, 0) : el) :
                  data.map(el => el !== 0 ? (
                    filters?.ordersFilter?.map(orderFilter => {
                      if (orderFilter?.checked) {
                        if (orderFilter.name === 'Completed Orders') return el.filter(st => st.userId.gender === 'female' && st.status === 'COMPLETED' && countryFilter.includes(st.userId.country)).length;
                        if (orderFilter.name === 'Cancelled Orders') return el.filter(st => st.userId.gender === 'female' && st.status === 'CANCELLED' && countryFilter.includes(st.userId.country)).length;
                        if (orderFilter.name === 'Pending Orders') return el.filter(st => st.userId.gender === 'female' && (st.status === 'PENDING' || st.status === 'IN PROCESS') && countryFilter.includes(st.userId.country)).length;
                      } else return 0;
                    })
                  ).reduce((a, b) => a + b, 0) : el)
              )
          ) : (
            filters?.earningsFilter[0]?.checked ?
              (
                countryFilter.length === 0 ?
                  data.map(el => el !== 0 ? el.filter(st => st.userId.gender === 'female').map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el) :
                  data.map(el => el !== 0 ? el.filter(st => st.userId.gender === 'female' && countryFilter.includes(st.userId.country)).map(st => st.totalAmount).reduce((a, b) => a + +b, 0) : el)
              ) : (
                countryFilter.length === 0 ?
                  data.map(el => el !== 0 ? (
                    filters?.earningsFilter?.map(earningFilter => {
                      if (earningFilter?.checked) {
                        const type = earningFilter?.name?.split(' ')[0];
                        return el.filter(el => (!!el.items.find(st => st.productId?.type === type) && el.userId.gender === 'female')).map(st => st.totalAmount).reduce((a, b) => a + +b, 0);
                      } else return 0;
                    })
                  ).reduce((c, d) => c + d, 0) : el) :
                  data.map(el => el !== 0 ? (
                    filters?.earningsFilter?.map(earningFilter => {
                      if (earningFilter?.checked) {
                        const type = earningFilter?.name?.split(' ')[0];
                        return el.filter(el => (!!el.items.find(st => st.productId?.type === type) && el.userId.gender === 'female' && countryFilter.includes(el.userId.country))).map(st => st.totalAmount).reduce((a, b) => a + +b, 0);
                      } else return 0;
                    })
                  ).reduce((c, d) => c + d, 0) : el)
              )
          )
      },
    ],
  };
}

/**
 * Get Orders By Timeline
 */
const getOrdersDataByTimeline = (allOrders, chartTimeline) => {

  let startDate, labelFormat;

  if (chartTimeline === '1m') { startDate = moment().subtract(1, 'month').startOf('day'); labelFormat = 'MMM DD'; }
  else if (chartTimeline === 'hourly') { startDate = moment().startOf('day').hour(0); labelFormat = 'HH:mm'; }
  else if (chartTimeline === 'weekly') { startDate = moment().startOf('month'); labelFormat = 'MMM DD'; }

  const currentDate = moment().endOf('day');
  let labels = [];
  let data = [];
  if (chartTimeline === 'weekly') {
    const weeksData = Array(4).fill(0);
    const thisdate = new Date()
    for (const order of allOrders) {
      const orderDate = moment(order.createdAt);
      const daysIntoMonth = orderDate.date();
      if (orderDate.month() === (thisdate.getMonth() - 1) && orderDate.year() === thisdate.getFullYear()) {
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
      date = chartTimeline === 'hourly' ? date.clone().add(1, 'hour') : date.clone().add(1, 'day')
    ) {
      const formattedDate = date.format(labelFormat);
      const ordersOnDate = allOrders.filter(order => {
        const orderDate = moment(order.createdAt);
        return (chartTimeline === 'hourly' ? orderDate.isSame(date, 'hour') : orderDate.isSame(date, 'day'));
      });
      const totalOrders = ordersOnDate;

      labels.push(formattedDate);
      data.push(totalOrders);
    }
  }

  return {
    labels,
    series: [
      {
        name: 'Total Orders',
        id: 1,
        color: colors[0],
        data: data.map(el => el !== 0 ? el.length : el),
      },
      {
        name: 'Completed Orders',
        id: 2,
        color: colors[1],
        data: data.map(el => el !== 0 ? el.filter(st => st.status === 'COMPLETED').length : el),
      },
      {
        name: 'Cancelled Orders',
        id: 3,
        color: colors[2],
        data: data.map(el => el !== 0 ? el.filter(st => st.status === 'CANCELLED').length : el),
      },
      {
        name: 'Pending Orders',
        id: 4,
        color: colors[3],
        data: data.map(el => el !== 0 ? el.filter(st => st.status === 'PENDING' || st.status === 'IN PROCESS').length : el),
      },
    ],
  };
}


/**
 * Get Combined Data By Timeline
 */
const getCombinedOrdersDataByTimeline = (allOrders, chartTimeline, filters) => {
  let startDate, labelFormat;

  if (chartTimeline === '1m') { startDate = moment().subtract(1, 'month').startOf('day'); labelFormat = 'MMM DD'; }
  else if (chartTimeline === 'hourly') { startDate = moment().startOf('day').hour(0); labelFormat = 'HH:mm'; }
  else if (chartTimeline === 'weekly') { startDate = moment().startOf('month'); labelFormat = 'MMM DD'; }

  // const currentDate = moment().endOf('day');
  // let labels = [];
  // let data = [];
  // if (chartTimeline === 'weekly') {
  //   const weeksData = Array(4).fill(0);
  //   const thisdate = new Date()
  //   for (const order of allOrders) {
  //     const orderDate = moment(order.createdAt);
  //     const daysIntoMonth = orderDate.date();
  //     if (orderDate.month() === (thisdate.getMonth() - 1) && orderDate.year() === thisdate.getFullYear()) {
  //       const weekIndex = Math.floor(daysIntoMonth / 7);
  //       weeksData[weekIndex] = weeksData[weekIndex] ? [...weeksData[weekIndex], order] : [order];
  //     }
  //   }

  const currentDate = moment().endOf('day');
  const thisdate = new Date();

  let labels = [];
  let data = [];

  if (chartTimeline === 'weekly') {
    const weeksData = Array(4).fill(0).map(() => []);

    for (const order of allOrders) {
      const orderDate = moment(order.createdAt);
      const isLastFourWeeks = orderDate.isSameOrAfter(moment().subtract(3, 'weeks').startOf('week'));

      if (isLastFourWeeks) {
        const weekIndex = moment(order.createdAt).diff(moment().subtract(3, 'weeks').startOf('week'), 'weeks');
        if (weekIndex >= 0 && weekIndex < 4) {
          weeksData[weekIndex].push(order);
        }
      }
    }


    labels = weeksData.map((_, index) => `Week ${index + 1}`);
    data = weeksData;
  }
  else {
    for (
      let date = startDate;
      date <= currentDate;
      date = chartTimeline === 'hourly' ? date.clone().add(1, 'hour') : date.clone().add(1, 'day')
    ) {
      const formattedDate = date.format(labelFormat);
      const ordersOnDate = allOrders.filter(order => {
        const orderDate = moment(order.createdAt);
        return (chartTimeline === 'hourly' ? orderDate.isSame(date, 'hour') : orderDate.isSame(date, 'day'));
      });
      const totalOrders = ordersOnDate;

      labels.push(formattedDate);
      data.push(totalOrders);
    }
  }

  const genderFilter = filters?.gender?.toLowerCase() || 'all';
  const countryFilter = filters?.countries && !filters?.countries.includes('All') ? filters?.countries : [];

  return {
    labels,
    series: [
      {
        name: 'Total Orders',
        id: 1,
        color: colors[0],
        data: (genderFilter === 'all' && countryFilter.length === 0) ?
          data.map(el => el !== 0 ? el.length : el) :
          (genderFilter === 'all' && countryFilter.length !== 0) ?
            data.map(el => el !== 0 ? el.filter(st => countryFilter.includes(st.userId.country)).length : el) :
            (genderFilter !== 'all' && countryFilter.length === 0) ?
              data.map(el => el !== 0 ? el.filter(st => st.userId.gender === genderFilter).length : el) :
              data.map(el => el !== 0 ? el.filter(st => (st.userId.gender === genderFilter && countryFilter.includes(st.userId.country))).length : el),
      },
      {
        name: 'Completed Orders',
        id: 2,
        color: colors[1],
        data: (genderFilter === 'all' && countryFilter.length === 0) ?
          data.map(el => el !== 0 ? el.filter(st => st.status === 'COMPLETED').length : el) :
          (genderFilter === 'all' && countryFilter.length !== 0) ?
            data.map(el => el !== 0 ? el.filter(st => (st.status === 'COMPLETED' && countryFilter.includes(st.userId.country))).length : el) :
            (genderFilter !== 'all' && countryFilter.length === 0) ?
              data.map(el => el !== 0 ? el.filter(st => (st.status === 'COMPLETED' && st.userId.gender === genderFilter)).length : el) :
              data.map(el => el !== 0 ? el.filter(st => (st.status === 'COMPLETED' && st.userId.gender === genderFilter && countryFilter.includes(st.userId.country))).length : el),
      },
      {
        name: 'Cancelled Orders',
        id: 3,
        color: colors[2],
        data: (genderFilter === 'all' && countryFilter.length === 0) ?
          data.map(el => el !== 0 ? el.filter(st => st.status === 'CANCELLED').length : el) :
          (genderFilter === 'all' && countryFilter.length !== 0) ?
            data.map(el => el !== 0 ? el.filter(st => (st.status === 'CANCELLED' && countryFilter.includes(st.userId.country))).length : el) :
            (genderFilter !== 'all' && countryFilter.length === 0) ?
              data.map(el => el !== 0 ? el.filter(st => (st.status === 'CANCELLED' && st.userId.gender === genderFilter)).length : el) :
              data.map(el => el !== 0 ? el.filter(st => (st.status === 'CANCELLED' && st.userId.gender === genderFilter && countryFilter.includes(st.userId.country))).length : el),
      },
      {
        name: 'Pending Orders',
        id: 4,
        color: colors[3],
        data: (genderFilter === 'all' && countryFilter.length === 0) ?
          data.map(el => el !== 0 ? el.filter(st => (st.status === 'PENDING' || st.status === 'IN PROCESS')).length : el) :
          (genderFilter === 'all' && countryFilter.length !== 0) ?
            data.map(el => el !== 0 ? el.filter(st => ((st.status === 'PENDING' || st.status === 'IN PROCESS') && countryFilter.includes(st.userId.country))).length : el) :
            (genderFilter !== 'all' && countryFilter.length === 0) ?
              data.map(el => el !== 0 ? el.filter(st => ((st.status === 'PENDING' || st.status === 'IN PROCESS') && st.userId.gender === genderFilter)).length : el) :
              data.map(el => el !== 0 ? el.filter(st => ((st.status === 'PENDING' || st.status === 'IN PROCESS') && st.userId.gender === genderFilter && countryFilter.includes(st.userId.country))).length : el),
      },
    ],
  };
}


/**
 * Filter All Orders By Timeline
 */
const filterData = (data, filter) => {
  switch (filter) {
    case '7d':
      return data.filter(
        order =>
          moment(order.createdAt).isSameOrAfter(
            moment().subtract(7, 'days'),
            'day'
          ) && moment(order.createdAt).isSameOrBefore(moment(), 'day')
      )
      break;

    case '1m':
      return data.filter(order =>
        moment(order.createdAt).isSameOrAfter(
          moment().subtract(1, 'month'),
          'day'
        )
      )
      break;

    default:

      return data;
      break;
  }
}
