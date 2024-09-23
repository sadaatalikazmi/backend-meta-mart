' use strict';

const https = require('https');
const moment = require("moment");
const sqlConnection = require("../../config/sqlConnection");
const { validSizes } = require("../../config/environment/const")
const { sendResponse, errReturned } = require('../../config/dto');
const { productsCategories, sectionNames, productTypes, colors, productUnits } = require('../../config/environment/const')
const { SUCCESS, BADREQUEST, NOTFOUND } = require('../../config/ResponseCodes');
const { getOrdersBetweenDatesQuery } = require('../../utils/order.helper');


/**
 * Add Product and glb file to AWS
 **/
exports.addProduct = async (req, res) => {
  try {
    const { files } = req;
    if (!files || files.length < 1) return sendResponse(res, BADREQUEST, "Image is not attached");

    const categorizedObjects = files.map(object => {
      const extension = object.originalname.split('.').pop().toLowerCase();

      if (extension === 'glb') {
        return { type: 'file', ...object };
      } else if (extension === 'jpg' || extension === 'jpeg' || extension === 'png') {
        return { type: 'imageUrl', ...object };
      }
    });
    const glbObject = categorizedObjects.find(obj => obj.type === 'file');
    const imageUrlObject = categorizedObjects.find(obj => obj.type === 'imageUrl');

    if (!glbObject) return sendResponse(res, BADREQUEST, "3D Model (glb) not uploaded");

    const file = glbObject.location;
    const imageUrl = imageUrlObject ? imageUrlObject.location : null;

    let { name, description, quantity, price, type, productSize, slotId, unit } = req['body'];
    let data = req['body'];
    const required = ['name', 'description', 'quantity', 'price', 'productSize'];

    for (let key of required) {
      if (!data[key] || data[key] === '' || data[key] === undefined || data[key] === null) {
        return sendResponse(res, BADREQUEST, `Please Provide ${key}`);
      }
    }

    if (!productUnits.includes(unit)) return sendResponse(res, BADREQUEST, `Please select unit from ${productUnits}`);

    const glbRegex = /\.glb$/i;
    if (!(glbRegex.test(file))) {
      return sendResponse(res, BADREQUEST, "Please provide glb format file");
    }
    if (price <= 0) { return sendResponse(res, BADREQUEST, "Please provide valid price") }
    if (quantity <= 0) { return sendResponse(res, BADREQUEST, "Please provide valid quantity") }

    const addProductQuery = `
      INSERT INTO products (name, description, quantity, file, price, imageUrl, productSize, type, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [name, description, quantity, file, price, imageUrl, productSize, type, unit];
    sqlConnection.query(addProductQuery, values, (error, result) => {
      if (error) return errReturned(res, error);

      const insertInventoryQuery = `INSERT INTO inventory (productId, quantityAvailable) VALUES (?, ?)`;
      const insertInventoryValues = [result.insertId, quantity];
      sqlConnection.query(insertInventoryQuery, insertInventoryValues, (insertInventoryError, insertInventoryResult) => {
        if (insertInventoryError) return errReturned(res, insertInventoryError);

        sqlConnection.query(`SELECT * FROM products WHERE id = ?`, [result.insertId], (err, productResult) => {
          if (err) return errReturned(res, err);

          const newProduct = productResult[0];

          return sendResponse(res, SUCCESS, 'Product Added Successfully', newProduct);
        });
      });
    });
  } catch (error) {
    errReturned(res, error);
  }
};

/**
    *ADD DISCOUNT ON PRODUCT || OFFER  
 */

exports.addDiscount = async (req, res) => {
  try {
    let { productId, discount } = req['body']
    let data = req['body'];
    const required = ['productId', 'discount'];
    for (let key of required)
      if (!data[key] || data[key] === '' || data[key] === undefined || data[key] === null)
        return sendResponse(res, BADREQUEST, `Please Provide ${key}`);

    const validateProduct = `
        SELECT price
        FROM products
        WHERE id = ?;
      `;

    sqlConnection.query(validateProduct, [productId], (error, results) => {
      if (error) return errReturned(res, 'Error checking product');

      if (results.length < 1) return sendResponse(res, NOTFOUND, 'Product not found');

      const productPrice = results[0].price;

      if (productPrice < discount) return sendResponse(res, BADREQUEST, `Discount should be less than the product price: ${productPrice}`);

      const updateQuery = `
        UPDATE products
        SET discountedPrice = ?,
        isDiscounted = 1
        WHERE id = ?;
      `;

      sqlConnection.query(updateQuery, [discount, productId], (error, results) => {
        if (error) return sendResponse(res, BADREQUEST, 'Error in updating discount');
        return sendResponse(res, SUCCESS, 'Discount updated successfully');
      });
    })
  } catch (error) { errReturned(res, error) }
}


/**
 * Get Hot Products
 */
exports.getHotProduct = async (req, res) => {
  try {
    const fetchHotProductsQuery = `
      SELECT
        p.type,
        p.id AS productId,
        p.currency,
        p.name,
        p.description,
        p.imageUrl,
        p.file,
        p.price,
        p.productSize,
        p.type,
        p.quantity,
        p.createdAt,
        p.updatedAt,
        COUNT(o.id) AS totalOrders
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.productId
      LEFT JOIN orders o ON oi.orderId = o.id
      GROUP BY p.type, p.id
      ORDER BY p.type ASC, totalOrders DESC
    `;

    sqlConnection.query(fetchHotProductsQuery, (error, results) => {
      if (error) return errReturned(res, error);

      const hotProductsByType = {};
      results.forEach(row => {
        const { type, productId, currency, name, description, imageUrl, file, price, productSize, quantity, totalOrders, createdAt, updatedAt } = row;
        if (!hotProductsByType[type]) {
          hotProductsByType[type] = [];
        }
        hotProductsByType[type].push({
          id: productId,
          currency,
          name,
          description,
          quantity,
          file,
          price,
          productSize,
          type,
          totalOrders,
          createdAt,
          updatedAt,
          imageUrl,
        });
      });

      const hotProductsinCategories = Object.keys(hotProductsByType).map(type => {
        return {
          type,
          hotProducts: hotProductsByType[type].filter(product => product.totalOrders !== 0).slice(0, 4) // Limit to 4 hot products per type
        };
      });

      const hotProducts = hotProductsinCategories.filter(category => category.hotProducts.length > 0);

      return sendResponse(res, SUCCESS, "Product found Successfully", hotProducts);
    });

  } catch (error) { return errReturned(res, error); };
}


/**
 * Top Items Purchased Graph 
 */
exports.getTopItemsPurchasedGraph = async (req, res) => {
  try {

    let { number, fromDate, toDate } = req['body'];

    let filters = {
      fromDate,
      toDate
    }

    let startDate = new Date();
    let endDate = new Date();
    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
      startDate = new Date(filters.fromDate);
      endDate = new Date(filters.toDate);
    } else {
      startDate.setDate(endDate.getDate() - 30);
    }

    const fetchHotProductsQuery = `
      SELECT
        p.type,
        p.id AS productId,
        p.currency,
        p.name,
        p.description,
        p.imageUrl,
        p.file,
        p.price,
        p.productSize,
        p.type,
        p.quantity,
        p.createdAt,
        p.updatedAt,
        COUNT(o.id) AS totalOrders,
        oi.subTotal
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.productId
      LEFT JOIN orders o ON oi.orderId = o.id
      WHERE o.createdAt BETWEEN ? AND ? 
      GROUP BY p.type, p.id
      ORDER BY p.type ASC, totalOrders DESC
    `;

    sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
      if (error) return errReturned(res, error);

      if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Top ${number} Products not found`)

      // Create a map to store aggregated subTotal and totalOrders for each productId
      const productAggregates = new Map();

      // Iterate through the products array
      for (const product of results) {
        const { productId, subTotal, totalOrders, name, type } = product;

        // Check if the productId already exists in the map
        if (productAggregates.has(productId)) {
          // If it exists, add the subTotal and totalOrders to the existing values
          const existingAggregate = productAggregates.get(productId);
          existingAggregate.subTotal += parseFloat(subTotal);
          existingAggregate.totalOrders += totalOrders;
        } else {
          // If it doesn't exist, create a new entry in the map
          productAggregates.set(productId, {
            subTotal: parseFloat(subTotal),
            totalOrders,
            category: type,
            productName: name
          });
        }
      }

      // Convert the map values back to an array
      const aggregatedProducts = Array.from(productAggregates, ([productId, aggregate]) => ({
        productId: parseInt(productId),
        subTotal: aggregate.subTotal.toFixed(2),
        totalOrders: aggregate.totalOrders,
        category: aggregate.category,
        productName: aggregate.productName

      }));

      // Sort the array based on totalOrders in descending order
      aggregatedProducts.sort((a, b) => b.totalOrders - a.totalOrders);

      let chartData = {
        TotalOrders: { labels: [], data: [] },
        Earnings: { labels: [], data: [] },
      }

      // if (aggregatedProducts.length < number) return sendResponse(res, SUCCESS, "Top Products", { chartData });

      const topElements = aggregatedProducts.slice(0, number);

      topElements.forEach(element => {
        chartData['TotalOrders']['data'].push(element['totalOrders']);
        chartData['TotalOrders']['labels'].push(element['productName']);

        chartData['Earnings']['data'].push(Number(element['subTotal']));
        chartData['Earnings']['labels'].push(element['productName']);
      });

      return sendResponse(res, SUCCESS, "Top Products", { chartData });
    });
  } catch (error) { errReturned(res, error) }
}


/**
 * Least Items purchased
 */
exports.getLeastItemsPurchasedGraph = async (req, res) => {
  try {

    let { number, fromDate, toDate } = req['body'];

    let filters = {
      fromDate,
      toDate
    }

    let startDate = new Date();
    let endDate = new Date();

    const fetchHotProductsQuery = `
    SELECT
    p.type,
    p.id AS productId,
    p.currency,
    p.name,
    p.description,
    p.imageUrl,
    p.file,
    p.price,
    p.productSize,
    p.type,
    p.quantity,
    o.createdAt,
    o.updatedAt,
    COUNT(o.id) AS totalOrders,
    oi.subTotal
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
LEFT JOIN orders o ON oi.orderId = o.id
GROUP BY p.type, p.id
ORDER BY p.type ASC, totalOrders DESC
`;

    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
      startDate = new Date(filters.fromDate);
      endDate = new Date(filters.toDate);
    } else {
      startDate.setDate(endDate.getDate() - 30);
    }


    sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
      if (error) return errReturned(res, error);

      if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Least ${number} Products not found`)

      // Create a map to store aggregated subTotal and totalOrders for each productId
      const productAggregates = new Map();

      // Iterate through the products array
      for (const product of results) {
        const { productId, subTotal, totalOrders, name, type, createdAt } = product;

        // Check if the productId already exists in the map
        if (productAggregates.has(productId)) {
          // If it exists, add the subTotal and totalOrders to the existing values
          const existingAggregate = productAggregates.get(productId);
          existingAggregate.subTotal += parseFloat(subTotal);
          existingAggregate.totalOrders += totalOrders;
        } else {
          // If it doesn't exist, create a new entry in the map
          productAggregates.set(productId, {
            subTotal: parseFloat(subTotal),
            totalOrders,
            category: type,
            productName: name,
            createdAt: createdAt
          });
        }
      }

      // Convert the map values back to an array
      const aggregatedProducts = Array.from(productAggregates, ([productId, aggregate]) => ({
        productId: parseInt(productId),
        subTotal: aggregate.subTotal.toFixed(2),
        totalOrders: aggregate.totalOrders,
        category: aggregate.category,
        productName: aggregate.productName,
        createdAt: aggregate.createdAt

      }));

      // Sort the array based on totalOrders in descending order
      aggregatedProducts.sort((a, b) => a.totalOrders - b.totalOrders);

      // if (aggregatedProducts.length < number) return sendResponse(res, BADREQUEST, `Please send number less than or equal to ${aggregatedProducts.length}`)
      const topElements = aggregatedProducts.slice(0, number);

      // create two arrays for nan and notnull values
      let productsWithZeroOrders = [];
      let productsWithNonZeroOrders = [];
      topElements.forEach(element => {
        if (element['totalOrders'] == 0) productsWithZeroOrders.push(element)
        else productsWithNonZeroOrders.push(element)
      });

      if (productsWithZeroOrders.length == number) {
        // create charts and send it to frontend
        let chartData = {
          TotalOrders: { labels: [], data: [] },
          Earnings: { labels: [], data: [] },

        }

        productsWithZeroOrders.forEach(element => {
          chartData['TotalOrders']['data'].push(element['totalOrders']);
          chartData['TotalOrders']['labels'].push(element['productName']);

          chartData['Earnings']['data'].push(0);
          chartData['Earnings']['labels'].push(element['productName']);
        });

        return sendResponse(res, SUCCESS, `Least ${number} Products purchased`, { chartData });
      }

      else {
        // sort the array
        productsWithNonZeroOrders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        fromDate = new Date(fromDate);
        toDate = new Date(toDate);

        const filteredArray = productsWithNonZeroOrders.filter(obj => {
          const createdAt = new Date(obj.createdAt);
          return createdAt >= fromDate && createdAt <= toDate;
        });

        // append the array till the array meet the number that frontend requested
        filteredArray.forEach(element => {
          if (productsWithZeroOrders.length < number) productsWithZeroOrders.push(element);
        });

        // create charts and send it to frontend
        let chartData = {
          TotalOrders: { labels: [], data: [] },
          Earnings: { labels: [], data: [] },

        }

        productsWithZeroOrders.forEach(element => {
          chartData['TotalOrders']['data'].push(element['totalOrders']);
          chartData['TotalOrders']['labels'].push(element['productName']);

          chartData['Earnings']['data'].push(0);
          chartData['Earnings']['labels'].push(element['productName']);
        });

        return sendResponse(res, SUCCESS, `Least ${number} Products purchased`, { chartData });
      }
    });
  } catch (error) { errReturned(res, error) }
}


/**
 * Top Categories Purchased
 */
exports.getTopCategoriesPurchasedGraph = async (req, res) => {
  try {

    const { number, fromDate, toDate } = req['body'];

    let filters = {
      fromDate,
      toDate
    }

    let startDate = new Date();
    let endDate = new Date();
    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
      startDate = new Date(filters.fromDate);
      endDate = new Date(filters.toDate);
    } else {
      startDate.setDate(endDate.getDate() - 30);
    }

    const fetchHotProductsQuery = `
    SELECT
    p.type,
    p.id AS productId,
    p.currency,
    p.name,
    p.description,
    p.imageUrl,
    p.file,
    p.price,
    p.productSize,
    p.type,
    p.quantity,
    p.createdAt,
    p.updatedAt,
    COUNT(o.id) AS totalOrders,
    oi.subTotal
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
LEFT JOIN orders o ON oi.orderId = o.id
WHERE o.createdAt BETWEEN ? AND ? 
GROUP BY p.type, p.id
ORDER BY p.type ASC, totalOrders DESC
`;

    sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
      if (error) return errReturned(res, error);

      if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Top ${number} Products not found`)

      // Group products by type
      const groupedProducts = results.reduce((groups, product) => {
        const { type } = product;

        if (!groups[type]) {
          groups[type] = [];
        }

        groups[type].push(product);

        return groups;
      }, {});

      const sumByType = calculateSum(groupedProducts);

      const categories = Object.keys(sumByType);
      let chartData = {
        TotalOrders: { labels: [], data: [] },
        Earnings: { labels: [], data: [] }
      }

      if (categories.length <= number) {

        for (let index = 0; index < categories.length; index++) {
          const element = categories[index];

          chartData['TotalOrders']['data'].push(sumByType[element]['totalOrders']);
          chartData['TotalOrders']['labels'].push(categories[index]);

          chartData['Earnings']['data'].push(sumByType[element]['subTotal']);
          chartData['Earnings']['labels'].push(categories[index]);

        }
        return sendResponse(res, SUCCESS, "Top Categories", { chartData });
      }
      else {

        // Sort the categories based on totalOrders in descending order
        const sortedCategories = Object.keys(sumByType).sort((a, b) => sumByType[b].totalOrders - sumByType[a].totalOrders);
        // Retrieve the top two categories
        const topCategories = sortedCategories.slice(0, number);


        for (let index = 0; index < topCategories.length; index++) {
          const element = topCategories[index];

          chartData['TotalOrders']['data'].push(sumByType[element]['totalOrders']);
          chartData['TotalOrders']['labels'].push(topCategories[index]);
          chartData['Earnings']['data'].push(sumByType[element]['subTotal']);
          chartData['Earnings']['labels'].push(topCategories[index]);

        }
        return sendResponse(res, SUCCESS, `Top categories graph`, { chartData })
      }
    });

  } catch (error) { errReturned(res, error) }
}

/**
 * Least X Categories Purchased
 */
exports.getLeastCategoriesPurchasedGraph = async (req, res) => {
  try {
    let { number, fromDate, toDate } = req['body'];
    let filters = {
      fromDate,
      toDate
    }

    let chartData = {
      TotalOrders: { labels: [], data: [] },
      Earnings: { labels: [], data: [] }
    }

    let startDate = new Date();
    let endDate = new Date();

    const fetchHotProductsQuery = `
    SELECT
    p.type,
    p.id AS productId,
    p.currency,
    p.name,
    p.description,
    p.imageUrl,
    p.file,
    p.price,
    p.productSize,
    p.type,
    p.quantity,
    o.createdAt,
    o.updatedAt,
    COUNT(o.id) AS totalOrders,
    oi.subTotal
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
LEFT JOIN orders o ON oi.orderId = o.id
GROUP BY p.type, p.id
ORDER BY p.type ASC, totalOrders DESC
`;

    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
      startDate = new Date(filters.fromDate);
      endDate = new Date(filters.toDate);

    } else {
      startDate.setDate(endDate.getDate() - 30);
    }

    sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
      if (error) return errReturned(res, error);

      if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Least Products not found`)
      // Sort the array based on totalOrders in descending order
      results.sort((a, b) => a.createdAt - b.createdAt);

      // Group products by type
      const groupedProducts = results.reduce((groups, product) => {
        const { type } = product;

        if (!groups[type]) {
          groups[type] = [];
        }

        groups[type].push(product);

        return groups;
      }, {});

      const categorySums = {};

      Object.entries(groupedProducts).forEach(([category, productList]) => {
        let subtotalSum = 0;
        let totalOrdersSum = 0;

        productList.forEach((product) => {
          const createdAt = new Date(product.createdAt);
          if (createdAt >= startDate && createdAt <= endDate) {
            subtotalSum += parseFloat(product.subTotal);
            totalOrdersSum += product.totalOrders;
          }
        });

        categorySums[category] = {
          subTotalSum: subtotalSum,
          totalOrdersSum: totalOrdersSum,
        };
      });

      const dataArray = Object.entries(categorySums);
      dataArray.sort((a, b) => b[1].totalOrdersSum - a[1].totalOrdersSum);
      const sortedData = Object.fromEntries(dataArray);

      const allCategories = Object.keys(sortedData)

      for (let index = 0; index < allCategories.length; index++) {
        const element = allCategories[index];

        if (index < number) {

          chartData['TotalOrders']['data'].push(sortedData[element]['totalOrdersSum']);
          chartData['TotalOrders']['labels'].push(element);

          chartData['Earnings']['data'].push(sortedData[element]['subTotalSum']);
          chartData['Earnings']['labels'].push(element);
        }

      }
      return sendResponse(res, SUCCESS, "Least Categories", { chartData });
    });

    // return sendResponse(res, SUCCESS, "Finished")
  } catch (error) { errReturned(res, error) }
}


/**
 * Get Categories Sales by Month Graph
 */
exports.getCategoriesSalesByMonthGraph = async (req, res) => {
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
          ...productTypes.map((type, idx) => ({
            name: `${type} Orders`,
            id: idx + 1,
            data: data.map(el => el !== 0 ? el.filter(el => !!el.items.find(st => st.productId?.type === type)).length : el),
            color: colors[idx + 1]
          }))
        ]
      };

      return sendResponse(res, SUCCESS, "", { graph });
    });
  } catch (error) {
    return errReturned(res, error);
  }
}

/**
 * Get Top Items Purchased Graph by category
 */
exports.getTopItemsPurchasedGraphByCategory = async (req, res) => {
  try {
    const { number, fromDate, toDate } = req['body'];

    let categories = req.body.categories.map(category => {
      if (category['checked']) return category['name']
    });

    let filters = {
      fromDate,
      toDate
    }

    let startDate = new Date();
    let endDate = new Date();
    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
      startDate = new Date(filters.fromDate);
      endDate = new Date(filters.toDate);
    } else {
      startDate.setDate(endDate.getDate() - 30);
    }

    const fetchHotProductsQuery = `
    SELECT
    p.type,
    p.id AS productId,
    p.currency,
    p.name,
    p.description,
    p.imageUrl,
    p.file,
    p.price,
    p.productSize,
    p.type,
    p.quantity,
    p.createdAt,
    p.updatedAt,
    COUNT(o.id) AS totalOrders,
    oi.subTotal
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
LEFT JOIN orders o ON oi.orderId = o.id
WHERE o.createdAt BETWEEN ? AND ? 
GROUP BY p.type, p.id
ORDER BY p.type ASC, totalOrders DESC
`;

    sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
      if (error) return errReturned(res, error);

      if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Top ${number} Products not found`)

      const filteredArray = results.filter(item => categories.includes(item.type));

      // Create a map to store aggregated subTotal and totalOrders for each productId
      const productAggregates = new Map();

      // Iterate through the products array
      for (const product of filteredArray) {
        const { productId, subTotal, totalOrders, name, type } = product;

        // Check if the productId already exists in the map
        if (productAggregates.has(productId)) {
          // If it exists, add the subTotal and totalOrders to the existing values
          const existingAggregate = productAggregates.get(productId);
          existingAggregate.subTotal += parseFloat(subTotal);
          existingAggregate.totalOrders += totalOrders;
        } else {
          // If it doesn't exist, create a new entry in the map
          productAggregates.set(productId, {
            subTotal: parseFloat(subTotal),
            totalOrders,
            category: type,
            productName: name
          });
        }
      }

      // Convert the map values back to an array
      const aggregatedProducts = Array.from(productAggregates, ([productId, aggregate]) => ({
        productId: parseInt(productId),
        subTotal: aggregate.subTotal.toFixed(2),
        totalOrders: aggregate.totalOrders,
        category: aggregate.category,
        productName: aggregate.productName

      }));

      // Sort the array based on totalOrders in descending order
      aggregatedProducts.sort((a, b) => b.totalOrders - a.totalOrders);

      let chartData = {
        TotalOrders: { labels: [], data: [] },
        Earnings: { labels: [], data: [] },
      };

      // if (aggregatedProducts.length < number) return sendResponse(res, SUCCESS, 'Top Products', { chartData });

      const topElements = aggregatedProducts.slice(0, number);

      topElements.forEach(element => {
        chartData['TotalOrders']['data'].push(element['totalOrders']);
        chartData['TotalOrders']['labels'].push(element['productName']);

        chartData['Earnings']['data'].push(element['subTotal']);
        chartData['Earnings']['labels'].push(element['productName']);
      });

      return sendResponse(res, SUCCESS, "Top Products", { chartData });
    });
  } catch (error) { errReturned(res, error) }
}


/**
 * Get Top Items Purchased Graph by category
 */
exports.getTopItemsPurchasedGraphSubCategory = async (req, res) => {
  try {
    const { number, fromDate, toDate } = req['body'];

    let subCategories = req.body.subCategories.map(category => {
      if (category['checked']) return category['name']
    });

    let filters = {
      fromDate,
      toDate
    }

    let startDate = new Date();
    let endDate = new Date();
    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
      startDate = new Date(filters.fromDate);
      endDate = new Date(filters.toDate);
    } else {
      startDate.setDate(endDate.getDate() - 30);
    }

    const fetchHotProductsQuery = `
    SELECT
    p.type,
    p.id AS productId,
    p.currency,
    p.name,
    p.description,
    p.imageUrl,
    p.file,
    p.price,
    p.productSize,
    p.type,
    p.subType,
    p.quantity,
    p.createdAt,
    p.updatedAt,
    COUNT(o.id) AS totalOrders,
    oi.subTotal
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
LEFT JOIN orders o ON oi.orderId = o.id
WHERE o.createdAt BETWEEN ? AND ? 
GROUP BY p.type, p.id
ORDER BY p.type ASC, totalOrders DESC
`;



    sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
      if (error) return errReturned(res, error);

      if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Top ${number} Products not found`)

      // return sendResponse(res, BADREQUEST, ":::::", results)
      const filteredArray = results.filter(item => subCategories.includes(item.subType));

      // Create a map to store aggregated subTotal and totalOrders for each productId
      const productAggregates = new Map();

      // Iterate through the products array
      for (const product of filteredArray) {
        const { productId, subTotal, totalOrders, name, type } = product;

        // Check if the productId already exists in the map
        if (productAggregates.has(productId)) {
          // If it exists, add the subTotal and totalOrders to the existing values
          const existingAggregate = productAggregates.get(productId);
          existingAggregate.subTotal += parseFloat(subTotal);
          existingAggregate.totalOrders += totalOrders;
        } else {
          // If it doesn't exist, create a new entry in the map
          productAggregates.set(productId, {
            subTotal: parseFloat(subTotal),
            totalOrders,
            category: type,
            productName: name
          });
        }
      }

      // Convert the map values back to an array
      const aggregatedProducts = Array.from(productAggregates, ([productId, aggregate]) => ({
        productId: parseInt(productId),
        subTotal: aggregate.subTotal.toFixed(2),
        totalOrders: aggregate.totalOrders,
        category: aggregate.category,
        productName: aggregate.productName

      }));

      // Sort the array based on totalOrders in descending order
      aggregatedProducts.sort((a, b) => b.totalOrders - a.totalOrders);

      let chartData = {
        TotalOrders: { labels: [], data: [] },
        Earnings: { labels: [], data: [] },
      };

      // if (aggregatedProducts.length < number) return sendResponse(res, SUCCESS, 'Top Products', { chartData });

      const topElements = aggregatedProducts.slice(0, number);

      topElements.forEach(element => {
        chartData['TotalOrders']['data'].push(element['totalOrders']);
        chartData['TotalOrders']['labels'].push(element['productName']);

        chartData['Earnings']['data'].push(Number(element['subTotal']));
        chartData['Earnings']['labels'].push(element['productName']);
      });
      return sendResponse(res, SUCCESS, "Top Products", { chartData });
    });
  } catch (error) { errReturned(res, error) }
}

/**
 * Least X Items by Category
 */
exports.getLeastItemsPurchasedGraphbyCategory = async (req, res) => {
  try {
    let { number, fromDate, toDate } = req['body'];

    let categories = req.body.categories.map(category => {
      if (category['checked']) return category['name']
    });

    let filters = {
      fromDate,
      toDate
    }

    let startDate = new Date();
    let endDate = new Date();

    const fetchHotProductsQuery = `
    SELECT
    p.type,
    p.id AS productId,
    p.currency,
    p.name,
    p.description,
    p.imageUrl,
    p.file,
    p.price,
    p.productSize,
    p.type,
    p.quantity,
    o.createdAt,
    o.updatedAt,
    COUNT(o.id) AS totalOrders,
    oi.subTotal
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
LEFT JOIN orders o ON oi.orderId = o.id
GROUP BY p.type, p.id
ORDER BY p.type ASC, totalOrders DESC
`;

    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
      startDate = new Date(filters.fromDate);
      endDate = new Date(filters.toDate);
    } else {
      startDate.setDate(endDate.getDate() - 30);
    }


    sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
      if (error) return errReturned(res, error);

      if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Least ${number} Products not found`)

      const filteredArray = results.filter(item => categories.includes(item.type));

      // Create a map to store aggregated subTotal and totalOrders for each productId
      const productAggregates = new Map();

      // Iterate through the products array
      for (const product of filteredArray) {
        const { productId, subTotal, totalOrders, name, type, createdAt } = product;

        // Check if the productId already exists in the map
        if (productAggregates.has(productId)) {
          // If it exists, add the subTotal and totalOrders to the existing values
          const existingAggregate = productAggregates.get(productId);
          existingAggregate.subTotal += parseFloat(subTotal);
          existingAggregate.totalOrders += totalOrders;
        } else {
          // If it doesn't exist, create a new entry in the map
          productAggregates.set(productId, {
            subTotal: parseFloat(subTotal),
            totalOrders,
            category: type,
            productName: name,
            createdAt: createdAt
          });
        }
      }

      // Convert the map values back to an array
      const aggregatedProducts = Array.from(productAggregates, ([productId, aggregate]) => ({
        productId: parseInt(productId),
        subTotal: aggregate.subTotal.toFixed(2),
        totalOrders: aggregate.totalOrders,
        category: aggregate.category,
        productName: aggregate.productName,
        createdAt: aggregate.createdAt

      }));

      // Sort the array based on totalOrders in descending order
      aggregatedProducts.sort((a, b) => a.totalOrders - b.totalOrders);

      let chartData = {
        TotalOrders: { labels: [], data: [] },
        Earnings: { labels: [], data: [] },
      };

      // if (aggregatedProducts.length < number) return sendResponse(res, SUCCESS, 'Least Products', { chartData });

      const topElements = aggregatedProducts.slice(0, number);

      // create two arrays for nan and notnull values
      let productsWithZeroOrders = [];
      let productsWithNonZeroOrders = [];
      topElements.forEach(element => {
        if (element['totalOrders'] == 0) productsWithZeroOrders.push(element)
        else productsWithNonZeroOrders.push(element)
      });

      if (productsWithZeroOrders.length == number) {
        productsWithZeroOrders.forEach(element => {
          chartData['TotalOrders']['data'].push(element['totalOrders']);
          chartData['TotalOrders']['labels'].push(element['productName']);

          chartData['Earnings']['data'].push(0);
          chartData['Earnings']['labels'].push(element['productName']);
        });
        return sendResponse(res, SUCCESS, `Least ${number} Products purchased`, { chartData });
      }

      else {
        // sort the array
        productsWithNonZeroOrders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        fromDate = new Date(fromDate);
        toDate = new Date(toDate);

        const filteredArray = productsWithNonZeroOrders.filter(obj => {
          const createdAt = new Date(obj.createdAt);
          return createdAt >= fromDate && createdAt <= toDate;
        });

        // append the array till the array meet the number that frontend requested
        filteredArray.forEach(element => {
          if (productsWithZeroOrders.length < number) productsWithZeroOrders.push(element);
        });

        // create charts and send it to frontend
        let chartData = {
          TotalOrders: { labels: [], data: [] },
          Earnings: { labels: [], data: [] },
        }

        productsWithZeroOrders.forEach(element => {
          chartData['TotalOrders']['data'].push(element['totalOrders']);
          chartData['TotalOrders']['labels'].push(element['productName']);

          chartData['Earnings']['data'].push(0);
          chartData['Earnings']['labels'].push(element['productName']);
        });
        return sendResponse(res, SUCCESS, `Least ${number} Products purchased`, { chartData });
      }
    });
  } catch (error) { errReturned(res, error) }
}

/**
 * Least X Items by SubCategory
 */

exports.getLeastItemsPurchasedGraphSubCategory = async (req, res) => {
  try {
    let { number, fromDate, toDate } = req['body'];

    let subCategories = req.body.subCategories.map(category => {
      if (category['checked']) return category['name']
    });

    let filters = {
      fromDate,
      toDate
    }

    let startDate = new Date();
    let endDate = new Date();

    const fetchHotProductsQuery = `
    SELECT
    p.type,
    p.id AS productId,
    p.currency,
    p.name,
    p.description,
    p.imageUrl,
    p.file,
    p.price,
    p.productSize,
    p.type,
    p.subType,
    p.quantity,
    o.createdAt,
    o.updatedAt,
    COUNT(o.id) AS totalOrders,
    oi.subTotal
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
LEFT JOIN orders o ON oi.orderId = o.id
GROUP BY p.type, p.id
ORDER BY p.type ASC, totalOrders DESC
`;

    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
      startDate = new Date(filters.fromDate);
      endDate = new Date(filters.toDate);
    } else {
      startDate.setDate(endDate.getDate() - 30);
    }


    sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
      if (error) return errReturned(res, error);

      if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Least ${number} Products not found`)

      const filteredArray = results.filter(item => subCategories.includes(item.subType));

      // Create a map to store aggregated subTotal and totalOrders for each productId
      const productAggregates = new Map();

      // Iterate through the products array
      for (const product of filteredArray) {
        const { productId, subTotal, totalOrders, name, type, createdAt } = product;

        // Check if the productId already exists in the map
        if (productAggregates.has(productId)) {
          // If it exists, add the subTotal and totalOrders to the existing values
          const existingAggregate = productAggregates.get(productId);
          existingAggregate.subTotal += parseFloat(subTotal);
          existingAggregate.totalOrders += totalOrders;
        } else {
          // If it doesn't exist, create a new entry in the map
          productAggregates.set(productId, {
            subTotal: parseFloat(subTotal),
            totalOrders,
            category: type,
            productName: name,
            createdAt: createdAt
          });
        }
      }

      // Convert the map values back to an array
      const aggregatedProducts = Array.from(productAggregates, ([productId, aggregate]) => ({
        productId: parseInt(productId),
        subTotal: aggregate.subTotal.toFixed(2),
        totalOrders: aggregate.totalOrders,
        category: aggregate.category,
        productName: aggregate.productName,
        createdAt: aggregate.createdAt

      }));

      // Sort the array based on totalOrders in descending order
      aggregatedProducts.sort((a, b) => a.totalOrders - b.totalOrders);

      let chartData = {
        TotalOrders: { labels: [], data: [] },
        Earnings: { labels: [], data: [] },
      };

      // if (aggregatedProducts.length < number) return sendResponse(res, SUCCESS, 'Top Products', { chartData });

      // if (aggregatedProducts.length < number) return sendResponse(res, BADREQUEST, `Please send number less than or equal to ${aggregatedProducts.length}`)
      const topElements = aggregatedProducts.slice(0, number);

      // create two arrays for nan and notnull values
      let productsWithZeroOrders = [];
      let productsWithNonZeroOrders = [];
      topElements.forEach(element => {
        if (element['totalOrders'] == 0) productsWithZeroOrders.push(element)
        else productsWithNonZeroOrders.push(element)
      });

      if (productsWithZeroOrders.length == number) {
        // create charts and send it to frontend
        // let chartData = {
        //   TotalOrders: { labels: [], data: [] },
        //   Earnings: { labels: [], data: [] },

        // }

        productsWithZeroOrders.forEach(element => {
          chartData['TotalOrders']['data'].push(element['totalOrders']);
          chartData['TotalOrders']['labels'].push(element['productName']);

          chartData['Earnings']['data'].push(0);
          chartData['Earnings']['labels'].push(element['productName']);

        });
        return sendResponse(res, SUCCESS, `Least ${number} Products purchased`, { chartData });

      }

      else {
        // sort the array
        productsWithNonZeroOrders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        fromDate = new Date(fromDate);
        toDate = new Date(toDate);

        const filteredArray = productsWithNonZeroOrders.filter(obj => {
          const createdAt = new Date(obj.createdAt);
          return createdAt >= fromDate && createdAt <= toDate;
        });

        // append the array till the array meet the number that frontend requested
        filteredArray.forEach(element => {
          if (productsWithZeroOrders.length < number) productsWithZeroOrders.push(element);
        });

        // create charts and send it to frontend
        let chartData = {
          TotalOrders: { labels: [], data: [] },
          Earnings: { labels: [], data: [] },

        }

        productsWithZeroOrders.forEach(element => {
          chartData['TotalOrders']['data'].push(element['totalOrders']);
          chartData['TotalOrders']['labels'].push(element['productName']);

          chartData['Earnings']['data'].push(0);
          chartData['Earnings']['labels'].push(element['productName']);

        });
        return sendResponse(res, SUCCESS, `Least ${number} Products purchased`, { chartData });
      }

    });

  } catch (error) { errReturned(res, error) }
}

/**
 * Sales By Gender
 */
exports.getSalesByGenderByGraph = async (req, res) => {
  try {

    const { fromDate, toDate } = req['body'];

    let filters = {
      fromDate,
      toDate
    }

    let startDate = new Date();
    let endDate = new Date();
    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
      startDate = new Date(filters.fromDate);
      endDate = new Date(filters.toDate);
    } else {
      startDate.setDate(endDate.getDate() - 30);
    }

    const fetchHotProductsQuery = `
    SELECT
    p.type,
    p.id AS productId,
    p.currency,
    p.name,
    p.description,
    p.imageUrl,
    p.file,
    p.price,
    p.productSize,
    p.type,
    p.quantity,
    p.createdAt,
    p.updatedAt,
    u.gender AS userGender, u.id AS userId, u.name AS userName,
    COUNT(o.id) AS totalOrders,
    oi.subTotal
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
LEFT JOIN orders o ON oi.orderId = o.id
LEFT JOIN users u ON o.userId = u.id
WHERE o.createdAt BETWEEN ? AND ? 
GROUP BY p.type, p.id
ORDER BY p.type ASC, totalOrders DESC
`;

    sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
      if (error) return errReturned(res, error);

      if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Top Products not found`)

      // Group products by gender
      const groupedProducts = results.reduce((groups, product) => {
        const { userGender } = product;

        if (!groups[userGender]) {
          groups[userGender] = [];
        }

        groups[userGender].push(product);

        return groups;
      }, {});


      const sumByType = calculateSum(groupedProducts);

      const chartData = {
        male: {
          totalOrders: sumByType?.male?.totalOrders ? sumByType?.male?.totalOrders : 0,
          subTotal: sumByType?.male?.subTotal ? sumByType?.male?.subTotal : 0,
        },
        female: {
          totalOrders: sumByType?.female?.totalOrders ? sumByType?.female?.totalOrders : 0,
          subTotal: sumByType?.female?.subTotal ? sumByType?.female?.subTotal : 0,
        },
      };

      return sendResponse(res, SUCCESS, "Sales by Gender", { chartData })
    });
  } catch (error) { errReturned(res, error) }
}

/**
 * Sales By Age Group
 */
exports.getSalesByByAgeGroupGraph = async (req, res) => {
  try {
    const { fromDate, toDate } = req['body'];

    let filters = {
      fromDate,
      toDate
    }

    let startDate = new Date();
    let endDate = new Date();
    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
      startDate = new Date(filters.fromDate);
      endDate = new Date(filters.toDate);
    } else {
      startDate.setDate(endDate.getDate() - 30);
    }

    const fetchHotProductsQuery = `
    SELECT
    p.type,
    p.id AS productId,
    p.currency,
    p.name,
    p.description,
    p.imageUrl,
    p.file,
    p.price,
    p.productSize,
    p.type,
    p.quantity,
    p.createdAt,
    p.updatedAt,
    u.gender AS userGender, u.id AS userId, u.name AS userName, u.age AS userAge,
    COUNT(o.id) AS totalOrders,
    oi.subTotal
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
LEFT JOIN orders o ON oi.orderId = o.id
LEFT JOIN users u ON o.userId = u.id
WHERE o.createdAt BETWEEN ? AND ? 
GROUP BY p.type, p.id
ORDER BY p.type ASC, totalOrders DESC
`;

    sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
      if (error) return errReturned(res, error);

      if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Top Products not found`)


      let newObject = {
        "20 or less yrs": [],
        "20 to 30 yrs": [],
        "31 to 40 yrs": [],
        "40+ yrs": []
      }
      // Grouping the data by userAge
      const groupedData = results.reduce((result, item) => {
        const age = item.userAge;
        if (age < 20) {
          if (!newObject["20 or less yrs"]) {
            newObject["20 or less yrs"] = [];
          }
          newObject["20 or less yrs"].push(item);
        } else if (age >= 20 && age <= 30) {
          if (!newObject["20 to 30 yrs"]) {
            newObject["20 to 30 yrs"] = [];
          }
          newObject["20 to 30 yrs"].push(item);
        } else if (age >= 31 && age <= 40) {
          if (!newObject["31 to 40 yrs"]) {
            newObject["31 to 40 yrs"] = [];
          }
          newObject["31 to 40 yrs"].push(item);
        } else {
          if (!newObject["40+ yrs"]) {
            newObject["40+ yrs"] = [];
          }
          newObject["40+ yrs"].push(item);
        }
        return result;
      }, {});

      const sumByType = calculateSum(newObject);

      const ages = Object.keys(sumByType);
      let chartData = {
        TotalOrders: { labels: [], data: [] },
        Earnings: { labels: [], data: [] }
      }

      for (let index = 0; index < ages.length; index++) {
        const element = ages[index];

        chartData['TotalOrders']['data'].push(sumByType[element]['totalOrders']);
        chartData['TotalOrders']['labels'].push(ages[index]);

        chartData['Earnings']['data'].push(sumByType[element]['subTotal']);
        chartData['Earnings']['labels'].push(ages[index]);

      }
      return sendResponse(res, SUCCESS, "Top Categories", { chartData });
    });
  } catch (error) { errReturned(res, error) }
}


/**
 * Sales By Area Graph X
 */
exports.getSalesByAreaGraph = async (req, res) => {
  try {
    const { fromDate, toDate, number } = req['body'];

    let filters = {
      fromDate,
      toDate
    }

    let startDate = new Date();
    let endDate = new Date();
    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
      startDate = new Date(filters.fromDate);
      endDate = new Date(filters.toDate);
    } else {
      startDate.setDate(endDate.getDate() - 30);
    }

    const fetchHotProductsQuery = `
    SELECT
    p.type,
    p.id AS productId,
    p.currency,
    p.name,
    p.description,
    p.imageUrl,
    p.file,
    p.price,
    p.productSize,
    p.type,
    p.quantity,
    p.createdAt,
    p.updatedAt,
    u.gender AS userGender, u.id AS userId, u.name AS userName, u.age AS userAge , u.area AS userArea,
    COUNT(o.id) AS totalOrders,
    oi.subTotal
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
LEFT JOIN orders o ON oi.orderId = o.id
LEFT JOIN users u ON o.userId = u.id
WHERE o.createdAt BETWEEN ? AND ? 
GROUP BY p.type, p.id
ORDER BY p.type ASC, totalOrders DESC
`;

    sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
      if (error) return errReturned(res, error);

      if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Top ${number} Products not found`)

      // Grouping the data by userAge
      const groupedProducts = results.reduce((groups, product) => {
        const { userArea } = product;

        if (!groups[userArea]) {
          groups[userArea] = [];
        }

        groups[userArea].push(product);

        return groups;
      }, {});

      const sumByType = calculateSum(groupedProducts);

      const dataArray = Object.entries(sumByType);
      dataArray.sort((a, b) => b[1].totalOrders - a[1].totalOrders);
      const sortedData = Object.fromEntries(dataArray);


      const ages = Object.keys(sortedData);

      let chartData = {
        TotalOrders: { labels: [], data: [] },
        Earnings: { labels: [], data: [] }
      }


      for (let index = 0; index < ages.length; index++) {
        const element = ages[index];
        if (index < number) {
          chartData['TotalOrders']['data'].push(sortedData[element]['totalOrders']);
          chartData['TotalOrders']['labels'].push(ages[index]);

          chartData['Earnings']['data'].push(sortedData[element]['subTotal']);
          chartData['Earnings']['labels'].push(ages[index]);
        }
      }
      return sendResponse(res, SUCCESS, "Sales", { chartData });

    });

  } catch (error) { errReturned(res, error) }
}

/**
 * Top Items Purchased by Gender
 */
exports.getTopItemsPurchaseByGenderGraph = async (req, res) => {

  const { fromDate, toDate } = req['body'];

  let filters = {
    fromDate,
    toDate
  }

  let startDate = new Date();
  let endDate = new Date();
  if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
    startDate = new Date(filters.fromDate);
    endDate = new Date(filters.toDate);
  } else {
    startDate.setDate(endDate.getDate() - 30);
  }

  const fetchHotProductsQuery = `
  SELECT
  p.type,
  p.id AS productId,
  p.currency,
  p.name,
  p.description,
  p.imageUrl,
  p.file,
  p.price,
  p.productSize,
  p.type,
  p.quantity,
  p.createdAt,
  p.updatedAt,
  u.gender AS userGender, u.id AS userId, u.name AS userName, u.age AS userAge , u.area AS userArea,
  COUNT(o.id) AS totalOrders,
  oi.subTotal
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
LEFT JOIN orders o ON oi.orderId = o.id
LEFT JOIN users u ON o.userId = u.id
WHERE o.createdAt BETWEEN ? AND ? 
GROUP BY p.type, p.id
ORDER BY p.type ASC, totalOrders DESC
`;

  sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
    if (error) return errReturned(res, error);

    if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Top ${number} Products not found`)

    // Grouping the data by userAge
    const groupedProducts = results.reduce((groups, product) => {
      const { name } = product;

      if (!groups[name]) {
        groups[name] = [];
      }

      groups[name].push(product);

      return groups;
    }, {});

    const products = Object.keys(groupedProducts);

    let updatedGroupedProducts = {};


    for ([index, element] of products.entries()) {
      updatedGroupedProducts[element] = {
        data: [0, 0],
        color: colors[index]
      };

      const groupedProductsElement = groupedProducts[element];
      for (const { userGender, totalOrders } of groupedProductsElement) {
        if (userGender === 'male') {
          updatedGroupedProducts[element].data[0] += totalOrders;
        } else {
          updatedGroupedProducts[element].data[1] += totalOrders;
        }
      }
    }

    return sendResponse(res, SUCCESS, "TopItemsPurchasedGraphByGender", { updatedGroupedProducts });
  });
}

/**
 * Top Categories Purchased By Gender
 */
exports.getTopCategoriesPurchaseByGenderGraph = async (req, res) => {

  const { fromDate, toDate } = req['body'];

  let filters = {
    fromDate,
    toDate
  }

  let startDate = new Date();
  let endDate = new Date();
  if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.fromDate && filters?.toDate !== null && filters?.toDate) {
    startDate = new Date(filters.fromDate);
    endDate = new Date(filters.toDate);
  } else {
    startDate.setDate(endDate.getDate() - 30);
  }

  const fetchHotProductsQuery = `
  SELECT
  p.type,
  p.id AS productId,
  p.currency,
  p.name,
  p.description,
  p.imageUrl,
  p.file,
  p.price,
  p.productSize,
  p.type,
  p.quantity,
  p.createdAt,
  p.updatedAt,
  u.gender AS userGender, u.id AS userId, u.name AS userName, u.age AS userAge , u.area AS userArea,
  COUNT(o.id) AS totalOrders,
  oi.subTotal
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
LEFT JOIN orders o ON oi.orderId = o.id
LEFT JOIN users u ON o.userId = u.id
WHERE o.createdAt BETWEEN ? AND ? 
GROUP BY p.type, p.id
ORDER BY p.type ASC, totalOrders DESC
`;

  sqlConnection.query(fetchHotProductsQuery, [startDate, endDate], (error, results) => {
    if (error) return errReturned(res, error);

    if (!results || results.length < 0) return sendResponse(res, BADREQUEST, `Top ${number} Products not found`)

    // Grouping the data by userAge
    const groupedProducts = results.reduce((groups, product) => {
      const { type } = product;
      if (!groups[type]) { groups[type] = []; }
      groups[type].push(product);
      return groups;
    }, {});


    const products = Object.keys(groupedProducts);

    let updatedGroupedProducts = {};

    for ([index, element] of products.entries()) {
      updatedGroupedProducts[element] = {
        data: [0, 0],
        color: colors[index]
      };

      const groupedProductsElement = groupedProducts[element];
      for (const { userGender, totalOrders } of groupedProductsElement) {
        if (userGender === 'male') {
          updatedGroupedProducts[element].data[0] += totalOrders;
        } else {
          updatedGroupedProducts[element].data[1] += totalOrders;
        }
      }
    }

    return sendResponse(res, SUCCESS, "TopItemsPurchasedGraphByGender", { updatedGroupedProducts });
  });
}


/**
 * Get Product by its Id
**/
exports.getProduct = async (req, res) => {
  try {
    let { productId } = req['body'];
    if (!productId || productId == '' || productId == undefined || productId == null) return sendResponse(res, BADREQUEST, `Please Provide Product Id`);

    sqlConnection.query(`SELECT * FROM products WHERE id = ?`, [productId], (error, results) => {
      if (error) return errReturned(res, error);

      if (results.length > 0) {
        const product = results[0];
        return sendResponse(res, SUCCESS, "Product found Successfully", product);
      } else return sendResponse(res, NOTFOUND, "Product not found");
    });
  } catch (error) { return errReturned(res, error); };
};

/**
 * Get All Unique Products
**/
exports.getAllProducts = async (req, res) => {
  try {
    const findUniqueProductsQuery = `
      SELECT p.*
      FROM products p
      JOIN (
        SELECT MIN(id) AS id
        FROM products
        GROUP BY name
      ) u ON p.id = u.id
    `;
    sqlConnection.query(findUniqueProductsQuery, (error, results) => {
      if (error) return errReturned(res, error);

      if (results.length > 0) return sendResponse(res, SUCCESS, "Products found Successfully", results);
      else return sendResponse(res, BADREQUEST, "No Products found");
    });
  } catch (error) { return errReturned(res, error) };
};

/**
 * Get Categories Of Products
 */
exports.productCategories = async (req, res) => {
  try {
    const productCategoriesQuery = `
      SELECT p.*
      FROM products p
      JOIN (
        SELECT MIN(id) as min_id, type
        FROM products
        GROUP BY type
      ) t ON p.id = t.min_id
    `;
    sqlConnection.query(productCategoriesQuery, (error, results) => {
      if (error) return errReturned(res, error);

      if (results.length > 0) return sendResponse(res, SUCCESS, 'Product categories are:', results);
      else return sendResponse(res, NOTFOUND, 'Categories not found');
    });
  } catch (error) { errReturned(res, error) }
}

/**
 * Products Based On Categories
 */

exports.getCategoriesProducts = async (req, res) => {
  try {
    let { productCategory } = req['params'];
    if (!productCategory) return sendResponse(res, NOTFOUND, "Please send Product Category")
    if (!productsCategories.includes(productCategory))
      return sendResponse(res, BADREQUEST, "Please send Valid product Category");

    sqlConnection.query(`SELECT * FROM products WHERE type = ?`, [productCategory], (error, results) => {
      if (error) return errReturned(res, error);

      if (results.length > 0) return sendResponse(res, SUCCESS, 'Found Products based on category', results);
      else return sendResponse(res, NOTFOUND, 'Products not found');
    });
  } catch (error) { errReturned(res, error) }
}

/**
    * GET SECTION NAMES
 */

exports.getSectionNames = async (req, res) => {
  try {
    if (sectionNames.length < 1) return sendResponse(res, BADREQUEST, "Section names not found")
    return sendResponse(res, SUCCESS, "Section names", sectionNames)
  } catch (error) { errReturned(res, error) }
}


/**
 * Place Products
 */
exports.placingProduct = async (req, res) => {
  try {
    let { slotId, productId } = req['body'];
    let data = req['body'];
    const required = ['slotId', 'productId'];
    for (let key of required) {
      if (!data[key] || data[key] === '' || data[key] === undefined || data[key] === null) {
        return sendResponse(res, BADREQUEST, `Please Provide ${key}`);
      }
    }

    sqlConnection.query(`SELECT * FROM slots WHERE id = ?`, [slotId], async (error, slotResult) => {
      if (error) return errReturned(res, error);
      if (slotResult.length === 0) return sendResponse(res, NOTFOUND, 'Slot not found', []);

      const slotDetails = slotResult[0];

      sqlConnection.query(`SELECT * FROM shelves WHERE id = ?`, [slotDetails.shelfId], async (error, shelfResult) => {
        if (error) return errReturned(res, error);
        if (shelfResult.length === 0) return sendResponse(res, NOTFOUND, 'Shelf not found', []);

        const shelfDetails = shelfResult[0];

        sqlConnection.query(`SELECT * FROM racks WHERE id = ?`, [shelfDetails.rack], async (error, rackResult) => {
          if (error) return errReturned(res, error);
          if (rackResult.length === 0) return sendResponse(res, BADREQUEST, 'Rack Not Found', []);

          const rackDetail = rackResult[0];

          sqlConnection.query(`SELECT * FROM products WHERE id = ?`, [productId], async (error, productResult) => {
            if (error) return errReturned(res, error);
            if (productResult.length === 0) return sendResponse(res, BADREQUEST, 'Product Not Found', []);

            const productDetails = productResult[0];

            if (slotDetails['productId'] == productId) return sendResponse(res, BADREQUEST, "Product Already Exist")

            sqlConnection.query(`SELECT * FROM slots WHERE productId = ?`, [productId], async (error, slotsResult) => {
              if (error) return errReturned(res, error);

              const alreadyExistProduct = slotsResult;

              if (rackDetail.productSize !== productDetails.productSize) return sendResponse(res, BADREQUEST, `Product size didn't match`, []);
              if (alreadyExistProduct.length >= productDetails.quantity) return sendResponse(res, BADREQUEST, 'Not Enough Product Quantity', []);

              sqlConnection.query(`UPDATE slots SET productId = ? WHERE id = ?`, [productId, slotId], (error, updateResult) => {
                if (error) return errReturned(res, error);

                return sendResponse(res, SUCCESS, 'Product Placed successfully', []);
              });
            });
          });
        });
      });
    });
  } catch (error) { errReturned(res, error) }
};

/**
 * Place Multiple Products
 */
exports.placingManyProducts = async (req, res) => {
  try {
    let { slotIds, productId } = req['body'];
    const required = ['slotIds', 'productId'];
    for (let key of required) {
      if (!req['body'][key] || req['body'][key] === '' || req['body'][key] === undefined || req['body'][key] === null) {
        return sendResponse(res, BADREQUEST, `Please Provide ${key}`);
      }
    }

    sqlConnection.query(`SELECT * FROM products WHERE id = ?`, [productId], async (error, productResults) => {
      if (error) return errReturned(res, error);
      if (productResults.length === 0) return sendResponse(res, NOTFOUND, 'Product not found');

      let productDetails = productResults[0];

      sqlConnection.query(`SELECT * FROM slots WHERE id IN (?)`, [slotIds], async (error, slotsResults) => {
        if (error) return errReturned(res, error);
        if (slotsResults.length !== slotIds.length) return sendResponse(res, NOTFOUND, 'One or more slots not found');

        let shelfIds = Array.from(new Set(slotsResults.map(slot => slot.shelfId)));

        sqlConnection.query(`SELECT * FROM shelves WHERE id IN (?)`, [shelfIds], async (error, shelvesResults) => {
          if (error) return errReturned(res, error);

          let rackIds = Array.from(new Set(shelvesResults.map(shelf => shelf.rack)));

          for (const rackId of rackIds) {
            sqlConnection.query(`SELECT * FROM racks WHERE id = ?`, [rackId], async (error, rackResults) => {
              if (error) return errReturned(res, error);
              if (rackResults.length === 0) return sendResponse(res, BADREQUEST, 'Rack Not Found');

              let rackDetails = rackResults[0];

              if (rackDetails.category !== productDetails.type || rackDetails.productSize !== productDetails.productSize) {
                return sendResponse(res, BADREQUEST, `${productDetails.name} is not suitable for the rack ${rackDetails.name}`);
              }

              sqlConnection.query(`SELECT * FROM slots WHERE productId = ?`, [productId], async (error, alreadyExistProductResults) => {
                if (error) return errReturned(res, error);
                if (alreadyExistProductResults.length >= productDetails.quantity) return sendResponse(res, BADREQUEST, 'Not Enough Quantity');

                // Update all slots in the slotIds array with the given productId
                sqlConnection.query(`UPDATE slots SET productId = ? WHERE id IN (?)`, [productId, slotIds], (error, updateResult) => {
                  if (error) return errReturned(res, error);

                  return sendResponse(res, SUCCESS, 'Products Placed successfully');
                });
              });
            });
          }
        });
      });
    });
  } catch (error) { errReturned(res, error) }
}

/**
 * Update Product
**/
exports.updateProduct = async (req, res) => {
  try {
    let { selectedProductId: productId, quantity, price, description, name, type, productSize } = req['body'];

    sqlConnection.query(`SELECT * FROM products WHERE id = ?`, [productId], (error, rows) => {
      if (error) return errReturned(res, error);

      const product = rows[0];

      if (!product) return sendResponse(res, BADREQUEST, 'Invalid product Id', []);

      const updateValues = [
        quantity || product.quantity,
        price || product.price,
        description || product.description,
        name || product.name,
        type || product.type,
        productSize || product.productSize,
        productId,
      ];
      const updateProductQuery = 'UPDATE products SET quantity = ?, price = ?, description = ?, name = ?, type = ?, productSize = ? WHERE id = ?';
      sqlConnection.query(updateProductQuery, updateValues, (error, result) => {
        if (error) return errReturned(res, error);
        if (result.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to update the product', []);

        sqlConnection.query(`SELECT * from products WHERE id = ?`, [productId], function (err, productResult) {
          if (err) return errReturned(res, err);

          const updatedProduct = productResult[0];

          return sendResponse(res, SUCCESS, 'Product updated successfully', updatedProduct);
        });
      });
    });
  } catch (error) { errReturned(res, error); }
};

/**
 * Upload 3DModel in S3
**/

exports.uploadProductModel = async (req, res) => {
  try {
    let { files } = req;
    if (!files || files.length < 1) return sendResponse(res, BADREQUEST, "Image is not successfully attached")
    const updatedFile = files[0]['location'];
    if (!updatedFile || updatedFile == "undefined" || updatedFile == null)
      return sendResponse(res, BADREQUEST, "3DModel not uploaded");
    return sendResponse(res, SUCCESS, `${files.length} File is uploaded successfully`, updatedFile);
  } catch (error) { errReturned(res, error) }
};


/*Delete Product **/

exports.deleteProduct = async (req, res) => {
  try {
    let { productId } = req['params'];
    if (!productId || productId === undefined || productId === null) { return sendResponse(res, BADREQUEST, "Invalid Product Id"); }

    sqlConnection.query(`SELECT * FROM products WHERE id = ?`, [productId], (error, result) => {
      if (error) return errReturned(res, error);
      if (result.length === 0) return sendResponse(res, BADREQUEST, 'Product not found', []);

      sqlConnection.query(`DELETE FROM products WHERE id = ?`, [productId], (error, result) => {
        if (error) return errReturned(res, error);
        if (result.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to delete the product', []);

        return sendResponse(res, SUCCESS, 'Product deleted successfully', []);
      });
    });
  } catch (error) { return errReturned(res, error) };
}


exports.importData = async (req, res) => {
  // Read the CSV file and parse it row by row
  try {
    const dataFileUrl = req.files.data[0].location; // Assuming req.files.data[0].location holds the S3 URL

    // Download the data file from S3
    const fileContent = await downloadFile(dataFileUrl);

    // Process the fileContent as needed (e.g., parse CSV, validate, etc.)
    let rows = fileContent.split('\n'); // Assuming each line is a row
    rows.shift(); // Remove the header row if needed
    rows.pop();

    if (rows.length !== req.files.model?.length) return sendResponse(res, BADREQUEST, `All rows must have a model`);
    if (rows.length !== req.files.images?.length) return sendResponse(res, BADREQUEST, `All rows must have an image`);

    rows = rows.map(el => el.replace('\r', ''))

    for (const rowIndex in rows) {
      const row = rows[rowIndex];
      const columns = row.split(','); // Assuming comma-separated values
      let [name, description, quantity, price, type, unit, rack, shelf, slot, size, model, imageUrl] = columns;

      let img = req.files.images.find(el => el.originalname === imageUrl)
      if (!img) return sendResponse(res, BADREQUEST, `No Image Found in row ${rowIndex + 1}`);

      let modalImg = req.files.model.find(el => el.originalname === model)
      if (!modalImg) return sendResponse(res, BADREQUEST, `No Model Found in row ${rowIndex + 1}`);

      // Validate price, quantity, and size
      price = +(price);
      quantity = +(quantity);
      size = size.trim().toLowerCase();

      if (isNaN(price) || price <= 0) return sendResponse(res, BADREQUEST, `Invalid price for row: row ${rowIndex + 1}`);
      if (isNaN(quantity) || quantity <= 0) return sendResponse(res, BADREQUEST, `Invalid quantity for row: row ${rowIndex + 1}`);
      if (!validSizes.includes(size)) return sendResponse(res, BADREQUEST, `Invalid size for row: row ${rowIndex + 1}`);
      if (!name || name.length < 5) return sendResponse(res, BADREQUEST, `Name Length must be greater than 5 letters: row ${rowIndex + 1}`);
      if (!description || description.length < 5) return sendResponse(res, BADREQUEST, `Description Length must be greater than 5 letters: row ${rowIndex + 1}`);
      if (!productUnits.includes(unit)) return sendResponse(res, BADREQUEST, `Please select unit from ${productUnits} for row: row ${rowIndex + 1}`);

      if (slot && (!rack || !shelf)) return sendResponse(res, BADREQUEST, `Error: Slot is present, but rack and shelf are missing in row: row ${rowIndex + 1}`);
      else if (rack && (!slot || !shelf)) return sendResponse(res, BADREQUEST, `Error: Rack is present, but slot is missing in row: row ${rowIndex + 1}`);
      else if (shelf && (!slot || !rack)) return sendResponse(res, BADREQUEST, `Error: Shelf is present, but slot is missing in row: row ${rowIndex + 1}`);

      // * Check if rack, shelf and slot exitsts in db
      sqlConnection.query(`SELECT * FROM racks WHERE name = ?`, [rack], (error, rackResult) => {
        if (error) return errReturned(res, error);
        if (rackResult.length === 0) return sendResponse(res, BADREQUEST, `No Rack Found in row ${rowIndex + 1}`);

        let rackItem = rackResult[0];

        if (rackItem) {
          sqlConnection.query(`SELECT * FROM shelves WHERE name = ? and rack = ?`, [shelf, rackItem.id], (err, shelfResult) => {
            if (err) return errReturned(res, err);
            if (shelfResult.length === 0) return sendResponse(res, BADREQUEST, `No Shelf Found in row ${rowIndex + 1}`);

            let shelfItem = shelfResult[0];

            if (shelfItem) {
              sqlConnection.query(`SELECT * FROM slots WHERE slotNo = ? and shelfId = ?`, [slot, shelfItem.id], (error, slotResult) => {
                if (error) return errReturned(res, error);
                if (slotResult.length === 0) return sendResponse(res, BADREQUEST, `No Slot Found in row ${rowIndex + 1}`);

                let slotItem = slotResult[0];
                size = size.toLowerCase();

                const addProductQuery = `
                  INSERT INTO products (name, description, quantity, file, price, imageUrl, productSize, type, unit)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                const values = [
                  name,
                  description,
                  quantity,
                  modalImg.location,
                  price,
                  img.location,
                  size === 'small' ? 1 : size === 'medium' ? 2 : 3,
                  type,
                  unit
                ];
                sqlConnection.query(addProductQuery, values, (err, result) => {
                  if (err) return errReturned(res, err);

                  const insertInventoryQuery = `INSERT INTO inventory (productId, quantityAvailable) VALUES (?, ?)`;
                  const insertInventoryValues = [result.insertId, quantity];
                  sqlConnection.query(insertInventoryQuery, insertInventoryValues, (insertInventoryError, insertInventoryResult) => {
                    if (insertInventoryError) return errReturned(res, insertInventoryError);

                    if (slotItem && shelfItem) {
                      sqlConnection.query(`UPDATE slots SET productId = ? WHERE slotNo = ? and shelfId = ?`, [result.insertId, slot, shelfItem.id], (error, updateSlotResult) => {
                        if (error) return errReturned(res, error);

                        if (rows.length === (parseFloat(rowIndex) + 1)) return sendResponse(res, SUCCESS, "Data Imported Successfully", []);
                      });
                    }
                  });
                });
              });
            }
          });
        }
      });
    }
  } catch (error) { return errReturned(res, error) };
}


/**
 * Check Product Quantity 
 */
exports.productQuantity = async (req, res) => {
  try {
    let triggerProducts = [];

    sqlConnection.query(`SELECT * FROM products`, async (error, productsResults) => {
      if (error) return errReturned(res, error);

      for (let product of productsResults) {
        if (product.quantity < 5) {
          triggerProducts.push(product);
        }
      }

      if (triggerProducts.length > 0) return sendResponse(res, SUCCESS, 'Products are on low quantity', triggerProducts);
      else return sendResponse(res, SUCCESS, 'Products quantity is fine');
    });
  } catch (error) { errReturned(res, error) }
}

// Function to download a file from a URL
const downloadFile = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        resolve(data);
      });

      response.on('error', (error) => {
        reject(error);
      });
    });
  });
};



function calculateSum(data) {
  const result = {};
  for (const type in data) {
    const items = data[type];
    let totalOrders = 0;
    let subTotal = 0;

    for (const item of items) {
      totalOrders += item.totalOrders;
      subTotal += parseFloat(item.subTotal);
    }

    result[type] = {
      totalOrders,
      subTotal
    };
  }

  return result;
}
