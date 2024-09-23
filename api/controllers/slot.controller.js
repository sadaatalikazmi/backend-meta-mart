' use strict';

const sqlConnection = require("../../config/sqlConnection");
const { sendResponse, errReturned } = require('../../config/dto');
const { SUCCESS, BADREQUEST, NOTFOUND } = require('../../config/ResponseCodes');

/**
 * Create A New Slot
 */

exports.createSlot = async (req, res) => {
  try {
    let { shelfId, slotNo } = req['body'];
    let data = req['body'];
    let required = ['shelfId', 'slotNo'];
    for (let key of required)
      if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null)
        return sendResponse(res, BADREQUEST, `Please Provide ${key}`, []);

    sqlConnection.query(`SELECT * FROM shelves WHERE id = ?`, [shelfId], (error, shelves) => {
      if (error) return errReturned(res, error);

      const shelfDetails = shelves[0];

      if (!shelfDetails) return sendResponse(res, NOTFOUND, 'Shelf Not Found', []);

      if (shelfDetails['maxSlots'] < slotNo) return sendResponse(res, BADREQUEST, 'Slots are already full', []);

      const insertSlotQuery = 'INSERT INTO slots (shelfId, slotNo) VALUES (?, ?)';
      const values = [shelfId, slotNo];
      sqlConnection.query(insertSlotQuery, values, (error, result) => {
        if (error) return errReturned(res, error);

        sqlConnection.query(`SELECT * from slots WHERE id = ?`, [result.insertId], function (err, slotResult) {
          if (err) return errReturned(res, err);

          const newSlot = slotResult[0];

          return sendResponse(res, SUCCESS, 'Slot Created Successfully', newSlot);
        });
      });
    });
  } catch (error) { errReturned(res, error); };
};

/**
 * Get Slot
 */
exports.getSlot = async (req, res) => {
  try {
    let { slotId } = req['body'];
    if (!slotId || slotId == '' || slotId == undefined || slotId == null)
      return sendResponse(res, BADREQUEST, `Please Provide Slot Id`, []);

    sqlConnection.query(`SELECT * FROM slots WHERE id = ?`, [slotId], (error, rows) => {
      if (error) return errReturned(res, error);

      const slot = rows[0];

      if (!slot) return sendResponse(res, BADREQUEST, 'Invalid slot Id', []);

      return sendResponse(res, SUCCESS, 'Here is found slot', slot);
    });
  } catch (error) { errReturned(res, error) }
}

/**
 * Get Shelves Slot
 */
exports.getShelfSlot = async (req, res) => {
  try {
    let { _id } = req['params'];
    if (!_id || _id == '' || _id == undefined || _id == null)
      return sendResponse(res, BADREQUEST, `Please Provide Shelf Id`, []);

    sqlConnection.query(`SELECT * FROM slots WHERE shelfId = ?`, [_id], (error, rows) => {
      if (error) return errReturned(res, error);
      if (rows.length < 1) return sendResponse(res, BADREQUEST, 'Invalid Shelf Id', []);

      const slots = rows;

      return sendResponse(res, SUCCESS, 'Here is found Shelf', slots);
    });
  } catch (error) { errReturned(res, error) }
};

/**
 * Get All Slots
 */
exports.getAllSlot = async (req, res) => {
  try {
    let query = 'SELECT slots.*, products.name AS productName, products.price, products.type, products.imageUrl, shelves.name AS shelfName, racks.id AS rackId, racks.name AS rackName, racks.category, racks.image AS rackImage FROM slots ' +
      'INNER JOIN shelves ON slots.shelfId = shelves.id ' +
      'INNER JOIN racks ON shelves.rack = racks.id ' +
      'LEFT JOIN products ON slots.productId = products.id';

    if (req.query.rack) query += ' WHERE racks.id = ' + req.query.rack;

    if (req.query.shelf) {
      if (req.query.rack) query += ' AND shelves.id = ' + req.query.shelf;
      else query += ' WHERE shelves.id = ' + req.query.shelf;
    }

    sqlConnection.query(query, (error, rows) => {
      if (error) return errReturned(res, error);
      if (rows.length < 1) return sendResponse(res, NOTFOUND, 'No Slot found', []);

      let slots = [];
      rows.forEach(row => {
        slots.push({
          id: row.id,
          shelfId: {
            id: row.shelfId,
            name: row.shelfName,
            rack: {
              id: row.rackId,
              name: row.rackName,
              category: row.category,
              image: row.rackImage
            }
          },
          slotNo: row.slotNo,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          productId: {
            id: row.productId,
            name: row.productName,
            price: row.price,
            type: row.type,
            imageUrl: row.imageUrl,
          }
        });
      });

      return sendResponse(res, SUCCESS, 'Here are found slots', slots);
    });
  } catch (error) { errReturned(res, error) }
};

/**
 * Update Slot
 */

exports.updateSlot = async (req, res) => {
  try {
    let { _id, shelfId, slotNo } = req['body'];

    sqlConnection.query(`SELECT * FROM slots WHERE id = ?`, [_id], (error, rows) => {
      if (error) return errReturned(res, error);

      const slot = rows[0];

      if (!slot) return sendResponse(res, BADREQUEST, 'Invalid slot Id', []);

      const updateSlotQuery = 'UPDATE slots SET shelfId = ?, slotNo = ? WHERE id = ?';
      const updateValues = [shelfId || slot.shelfId, slotNo || slot.slotNo, _id];
      sqlConnection.query(updateSlotQuery, updateValues, (error, result) => {
        if (error) return errReturned(res, error);
        if (result.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to update the slot', []);

        sqlConnection.query(`SELECT * from slots WHERE id = ?`, [_id], function (err, slotResult) {
          if (err) return errReturned(res, err);

          const updatedSlot = slotResult[0];

          return sendResponse(res, SUCCESS, 'Slot updated successfully', updatedSlot);
        });
      });
    });

  } catch (error) { errReturned(res, error) }
};

/**
 * Delete Slot
 */
exports.deleteSlot = async (req, res) => {
  try {
    let { slotId } = req['params'];
    if (!slotId || slotId === undefined || slotId === null)
      return sendResponse(res, BADREQUEST, 'Slot Id is required');

    sqlConnection.query(`SELECT * FROM slots WHERE id = ?`, [slotId], (error, rows) => {
      if (error) return errReturned(res, error);

      const slot = rows[0];

      if (!slot) return sendResponse(res, BADREQUEST, 'Slot not found', []);

      sqlConnection.query(`DELETE FROM slots WHERE id = ?`, [slotId], (error, result) => {
        if (error) return errReturned(res, error);
        if (result.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to delete the slot', []);

        return sendResponse(res, SUCCESS, 'Slot deleted successfully', []);
      });
    });
  } catch (error) { errReturned(res, error) }
}
