' use strict';

const sqlConnection = require("../../config/sqlConnection");
const { sendResponse, errReturned } = require('../../config/dto');
const { rackCategories, rackTypes } = require('../../config/environment/const')
const { SUCCESS, BADREQUEST, NOTFOUND } = require('../../config/ResponseCodes');


/**
 * Create new Rack
 */
exports.createRack = async (req, res) => {
  try {
    if (!req.file) return sendResponse(res, BADREQUEST, `Please Provide image`, []);

    let { name, description, category, type, productSize } = req['body'];
    let data = req['body']
    let required = ['name', 'description', 'category', 'type', 'productSize'];

    for (let key of required)
      if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null)
        return sendResponse(res, BADREQUEST, `Please Provide ${key}`, []);

    if (!(rackCategories.includes(category))) return sendResponse(res, NOTFOUND, "Please send valid rack category")
    if (!(rackTypes.includes(type))) return sendResponse(res, NOTFOUND, "Please send valid rack type")

    sqlConnection.execute(`SELECT name from racks WHERE name = ?`, [name], function (err, rows) {
      if (err) return errReturned(res, err);

      const rack = rows[0];

      if (rack) return sendResponse(res, BADREQUEST, 'Name already exists', []);
      if (name.length < 2 || name.length > 25) return sendResponse(res, BADREQUEST, 'Name should be in between 2 to 25 characters');
      if (description.length < 5 || description.length > 200) return sendResponse(res, BADREQUEST, 'Description should be in between 5 to 200 characters');

      const insertRackQuery = 'INSERT INTO racks (name, description, category, type, productSize, image) VALUES (?, ?, ?, ?,?, ?)';
      const values = [name, description, category, type, productSize, req.file.location];
      sqlConnection.query(insertRackQuery, values, (err, result) => {
        if (err) return errReturned(res, err);

        sqlConnection.query(`SELECT * from racks WHERE id = ?`, [result.insertId], function (error, rackResult) {
          if (error) return errReturned(res, error);

          const newRack = rackResult[0];

          return sendResponse(res, SUCCESS, 'Rack Created Successfully', newRack);
        });
      });
    });
  } catch (error) {
    errReturned(res, error);
  };
};

/**
 * Place Products
 */
exports.placeProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = req.body.productId;
    const productId = product.id;

    sqlConnection.query('SELECT * FROM products WHERE id = ?', [productId], (productError, productResults) => {
      if (productError) return errReturned(res, productError);
      if (productResults.length === 0) return sendResponse(res, NOTFOUND, 'Product not found');

      const product = productResults[0];

      // Find the rack
      sqlConnection.query('SELECT * FROM racks WHERE id = ?', [id], (rackError, rackResults) => {
        if (rackError) return errReturned(res, rackError);
        if (rackResults.length === 0) return sendResponse(res, NOTFOUND, 'Rack not found');

        const rack = rackResults[0];

        if (rack.category !== product.type) return sendResponse(res, BADREQUEST, `${product.name} is not suitable for rack ${rack.name}`);

        // Find all shelves of this rack
        sqlConnection.query('SELECT * FROM shelves WHERE rack = ?', [id], (shelvesError, shelvesResults) => {
          if (shelvesError) return errReturned(res, shelvesError);
          if (shelvesResults.length === 0) return sendResponse(res, NOTFOUND, 'No shelves found in the rack');

          const shelfIds = shelvesResults.map(shelf => shelf.id);

          // Update all Slots of all shelves
          sqlConnection.query('UPDATE slots SET productId = ? WHERE shelfId IN (?)', [productId, shelfIds], (slotsError, slotsResults) => {
            if (slotsError) return errReturned(res, slotsError);

            return sendResponse(res, SUCCESS, 'Product added to rack', []);
          });
        });
      });
    });
  } catch (err) { errReturned(res, err) }
}

/**
 * Get Single Rack Details
**/

exports.getRack = async (req, res) => {
  try {
    let { rackId } = req['body'];
    if (!rackId || rackId == '' || rackId == undefined || rackId == null) {
      return sendResponse(res, BADREQUEST, `Please Provide Rack Id`, []);
    }

    sqlConnection.query(`SELECT * FROM racks WHERE id = ?`, [rackId], (error, rows) => {
      if (error) {
        return errReturned(res, error);
      }

      const rack = rows[0];

      if (!rack) return sendResponse(res, BADREQUEST, 'Invalid Rack Id', []);

      return sendResponse(res, SUCCESS, 'Racks found', rack);
    });
  } catch (error) { errReturned(res, error) }
};


/**
 * Get All Racks and Details
 */
exports.getAllRack = async (req, res) => {
  try {
    const getAllRacksQuery = `
      SELECT 
        racks.id AS rackId, racks.name, racks.description, racks.image, racks.category, racks.type,
        shelves.id AS shelfId, shelves.name AS shelfName,
        slots.id AS slotId, slots.slotNo,
        products.id AS productId, products.name AS productName, products.description AS productDescription,
        products.imageUrl AS productImageUrl, products.file AS productFile, products.price AS productPrice, products.quantity AS productQuantity,
        products.isDiscounted AS isDiscounted, products.discountedPrice AS discountedPrice, products.unit AS unit
      FROM 
        racks
        LEFT JOIN shelves ON racks.id = shelves.rack
        LEFT JOIN slots ON shelves.id = slots.shelfId
        LEFT JOIN products ON slots.productId = products.id
    `;

    sqlConnection.query(getAllRacksQuery, (error, results) => {
      if (error) return errReturned(res, error);
      if (results.length === 0) return sendResponse(res, BADREQUEST, 'No racks found', null);

      const racks = {};

      results.forEach(row => {
        const { rackId, name, shelfId, shelfName, slotId, slotNo, productId, productName, productDescription, productImageUrl, productFile, productPrice, productQuantity, isDiscounted, discountedPrice, unit } = row;

        if (!racks[rackId]) {
          racks[rackId] = {
            name,
            allShelves: [],
          };
        }

        let shelfIndex = racks[rackId].allShelves.findIndex(shelf => shelf.shelfId === shelfId);

        if (shelfIndex === -1) {
          const shelf = {
            shelfId,
            shelfName,
            slots: []
          };

          racks[rackId].allShelves.push(shelf);

          // Increment shelfIndex by 1
          shelfIndex = racks[rackId].allShelves.length - 1;
        }


        const slot = {
          id: slotId,
          slotNo,
          product: {
            id: productId,
            name: productName,
            description: productDescription,
            imageUrl: productImageUrl,
            file: productFile,
            price: Number(productPrice),
            quantity: productQuantity,
            isDiscounted,
            discountedPrice,
            unit,
          }
        };

        racks[rackId].allShelves[shelfIndex].slots.push(slot);
      });
      // Sort slots within shelves
      for (const rackId in racks) {
        for (const shelf of racks[rackId].allShelves) {
          shelf.slots.sort((a, b) => a.slotNo - b.slotNo);
        }
      }

      // Sort shelves within racks
      for (const rackId in racks) {
        racks[rackId].allShelves.sort((a, b) => {
          const numericPartA = parseInt(a.shelfName.substring(1) || 0);
          const numericPartB = parseInt(b.shelfName.substring(1) || 0);
          return numericPartA - numericPartB;
        });
      }

      const sortedRacks = Object.values(racks).sort((a, b) => {
        const [prefixA, numericPartA] = a.name.match(/([a-zA-Z]+)(\d+)/)?.slice(1);
        const [prefixB, numericPartB] = b.name.match(/([a-zA-Z]+)(\d+)/)?.slice(1);

        if (prefixA !== prefixB) {
          return prefixA.localeCompare(prefixB);
        }

        return parseInt(numericPartA) - parseInt(numericPartB);
      });

      const racksResult = sortedRacks.reduce((obj, cur) => ({ ...obj, [cur.name]: cur }), {});
      return sendResponse(res, SUCCESS, 'Racks found', racksResult);
    });
  } catch (error) {
    return errReturned(res, error);
  }
};

/**
 * Get All Racks for Tabular
 */
exports.getRacks = async (req, res) => {
  try {
    sqlConnection.query(`SELECT * FROM racks`, (error, rows) => {
      if (error) return errReturned(res, error);
      if (rows.length === 0) return sendResponse(res, BADREQUEST, 'No Racks found', []);

      return sendResponse(res, SUCCESS, 'Racks Found', rows);
    });

  } catch (error) { return errReturned(res, error) }
}

/**
 * Update Rack
 */
exports.updateRack = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, type } = req['body'];

    sqlConnection.query('SELECT * FROM racks WHERE id = ?', [id], (error, rows) => {
      if (error) return errReturned(res, error);

      const rack = rows[0];

      if (!rack) return sendResponse(res, NOTFOUND, 'Rack Not Found, Invalid Id');

      const updateValues = [
        name || rack.name,
        description || rack.description,
        category || rack.category,
        type || rack.type,
        req?.file?.location || rack.image,
        id
      ];
      const updateRackQuery = 'UPDATE racks SET name = ?, description = ?, category = ?, type = ?, image = ? WHERE id = ?';
      sqlConnection.query(updateRackQuery, updateValues, (err, result) => {
        if (err) return errReturned(res, err);

        sqlConnection.query(`SELECT * from racks WHERE id = ?`, [id], function (error, rackResult) {
          if (error) return errReturned(res, error);

          const updatedRack = rackResult[0];

          return sendResponse(res, SUCCESS, 'Rack updated', updatedRack);
        });
      });
    });
  } catch (error) { return errReturned(res, error); }
};


/**
 * Delete Rack
**/
exports.deleteRacks = async (req, res) => {
  try {
    let { rackId } = req['params'];
    if (!rackId || rackId === undefined || rackId === null) { return sendResponse(res, BADREQUEST, "Invalid Rack Id"); }

    sqlConnection.query(`SELECT * FROM racks WHERE id = ?`, [rackId], (error, rows) => {
      if (error) {
        return errReturned(res, error);
      }

      const rack = rows[0];

      if (!rack) {
        return sendResponse(res, BADREQUEST, 'Rack not found');
      }

      const deleteRackQuery = 'DELETE FROM racks WHERE id = ?';
      sqlConnection.query(deleteRackQuery, [rackId], (err, result) => {
        if (err) {
          return errReturned(res, err);
        }

        if (result.affectedRows === 0) {
          return sendResponse(res, BADREQUEST, 'Failed to delete the rack');
        }

        return sendResponse(res, SUCCESS, 'Rack deleted successfully');
      });
    });
  } catch (error) { return errReturned(res, error) }
};


/********************* APIs FOR PUSHING DATA INTO DB *****************************/

exports.pushShelves = async (req, res) => {
  try {

    const { rack, NoOfShelves, maxSlots } = req['body']
    for (let i = 0; i < NoOfShelves; i++) {

      let name = `S${i + 1}`;

      sqlConnection.query(`SELECT * FROM racks WHERE id = ?`, [rack], (error, rows) => {
        if (error) return errReturned(res, error);

        const rackDetails = rows[0];

        if (!rackDetails) return sendResponse(res, NOTFOUND, 'Rack Not Found, Invalid Id', []);

        const rackId = rackDetails.id;

        const findShelfQuery = 'SELECT name FROM shelves WHERE name = ? AND rack = ?';
        sqlConnection.query(findShelfQuery, [name, rackId], (error, rows) => {
          if (error) return errReturned(res, error);

          const shelf = rows[0];

          if (shelf) return sendResponse(res, BADREQUEST, 'Name already exists', []);

          const insertShelfQuery = 'INSERT INTO shelves (name, maxSlots, rack) VALUES (?, ?, ?)';
          const values = [name, maxSlots, rackId];
          sqlConnection.query(insertShelfQuery, values, (error, result) => {
            if (error) return errReturned(res, error);
            if (i == NoOfShelves - 1) return sendResponse(res, SUCCESS, 'New shelf Created Successfully');
          });
        });
      });
    }


  } catch (error) {
    errReturned(res, error);
  }
}

/**
 * PUSH SLOTS
 */
exports.pushSlot = async (req, res) => {
  try {
    const { shelfId, maxSlots } = req['body']
    for (let i = 0; i < maxSlots; i++) {

      const slotNo = i + 1;

      sqlConnection.query(`SELECT * FROM shelves WHERE id = ?`, [shelfId], (error, shelves) => {
        if (error) return errReturned(res, error);

        const shelfDetails = shelves[0];

        if (!shelfDetails) return sendResponse(res, NOTFOUND, 'Shelf Not Found', []);

        if (shelfDetails['maxSlots'] < slotNo) return sendResponse(res, BADREQUEST, 'Slots are already full', []);

        const insertSlotQuery = 'INSERT INTO slots (shelfId, slotNo) VALUES (?, ?)';
        const values = [shelfId, slotNo];
        sqlConnection.query(insertSlotQuery, values, (error, result) => {
          if (error) return errReturned(res, error);

          if (i == maxSlots - 1) return sendResponse(res, SUCCESS, 'Slot Created Successfully');
        });
      });

    }

  } catch (error) {
    errReturned(res, error);
  }
}

exports.pushPlacedProducts = async (req, res) => {
  try {

    const { slotId, maxSlotIds, productId } = req['body'];
    for (let i = slotId; i < maxSlotIds; i++) {

      sqlConnection.query(`SELECT * FROM slots WHERE id = ?`, [i], async (error, slotResult) => {
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

                sqlConnection.query(`UPDATE slots SET productId = ? WHERE id = ?`, [productId, i], (error, updateResult) => {
                  if (error) return errReturned(res, error);

                  if (i == maxSlotIds - 1) return sendResponse(res, SUCCESS, 'Product Placed successfully', []);
                });
              });
            });
          });
        });
      });
    }
  } catch (error) { errReturned(res, error) }
}