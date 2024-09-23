'use strict';

const sqlConnection = require("../../config/sqlConnection");
const { sendResponse, errReturned } = require('../../config/dto');
const { SUCCESS, BADREQUEST, NOTFOUND } = require('../../config/ResponseCodes');

/**
 * Create Shelf
 **/

exports.createShelf = async (req, res) => {
  try {
    let { name, maxSlots, rack } = req.body;
    let data = req.body;
    let required = ['name', 'maxSlots', 'rack'];
    for (let key of required)
      if (!data[key] || data[key] === '' || data[key] === undefined || data[key] === null)
        return sendResponse(res, BADREQUEST, `Please Provide ${key}`, []);

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

          sqlConnection.query(`SELECT * from shelves WHERE id = ?`, [result.insertId], function (err, shelfResult) {
            if (error) return errReturned(res, err);

            const newShelf = shelfResult[0];

            sqlConnection.query(`SELECT COUNT(*) as rowCount FROM shelves`, (error, countResult) => {
              if (error) {
                console.error("Error counting rows:", error);
                return;
              }

              const count = countResult[0].rowCount;

              return sendResponse(res, SUCCESS, 'New shelf Created Successfully', newShelf, count);
            });
          });
        });
      });
    });
  } catch (error) { return errReturned(res, error) }
};

/**
 * Get Shelf With Id
 **/
exports.getShelf = async (req, res) => {
  try {
    let { shelfId } = req.body;
    if (!shelfId || shelfId === '' || shelfId === undefined || shelfId === null) return sendResponse(res, BADREQUEST, `Please Provide Shelf Id`, []);

    sqlConnection.query(`SELECT * FROM shelves WHERE id = ?`, [shelfId], (error, rows) => {
      if (error) return errReturned(res, error);

      const shelf = rows[0];

      if (!shelf) return sendResponse(res, BADREQUEST, 'Invalid shelf Id', []);

      return sendResponse(res, SUCCESS, 'Shelf found', shelf);
    });
  } catch (error) { return errReturned(res, error) }
};

/**
 * GET Shelves With Rack Id
 **/
exports.getRackShelves = async (req, res) => {
  try {
    let { _id } = req['params'];
    if (!_id || _id === '' || _id === undefined || _id === null) return sendResponse(res, BADREQUEST, `Please Provide Rack Id`, [])

    sqlConnection.query(`SELECT * FROM shelves WHERE rack = ?`, [_id], (error, rows) => {
      if (error) return errReturned(res, error);
      if (rows.length === 0) return sendResponse(res, BADREQUEST, 'Invalid Rack Id', []);

      const shelves = rows;

      sendResponse(res, SUCCESS, 'Shelves Found', shelves);
    });
  } catch (error) { return errReturned(res, error) }
};

/**
* Get All Shelfs
**/
exports.getAllShelf = async (req, res) => {
  try {
    const getAllShelfQuery = 'SELECT shelves.*, racks.name AS rack_name FROM shelves JOIN racks ON shelves.rack = racks.id';
    sqlConnection.query(getAllShelfQuery, (error, rows) => {
      if (error) return errReturned(res, error);

      if (rows.length === 0) return sendResponse(res, BADREQUEST, 'No Shelf found', []);

      const shelfData = rows.map(row => ({
        id: row.id,
        name: row.name,
        maxSlots: row.maxSlots,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        rack: {
          id: row.rack,
          name: row.rack_name
        }
      }));

      sendResponse(res, SUCCESS, 'Shelf found', shelfData);
    });
  } catch (error) { return errReturned(res, error) }
};

/**
 * Update Shelf With Id
 **/
exports.updateShelf = async (req, res) => {
  try {
    let { id, name, maxSlots } = req.body;

    sqlConnection.query(`SELECT * FROM shelves WHERE id = ?`, [id], (error, rows) => {
      if (error) return errReturned(res, error);

      const shelf = rows[0];

      if (!shelf) return sendResponse(res, BADREQUEST, 'Invalid shelf Id', []);

      const updateShelfQuery = `UPDATE shelves SET name = ?, maxSlots = ? WHERE id = ${id}`;
      const updateValues = [name || shelf.name, maxSlots || shelf.maxSlots, id];
      sqlConnection.query(updateShelfQuery, updateValues, (error, result) => {
        if (error) return errReturned(res, error);
        if (result.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to update the shelf', []);

        sqlConnection.query(`SELECT * from shelves WHERE id = ?`, [id], function (err, shelfResult) {
          if (err) return errReturned(res, err);

          const updatedShelf = shelfResult[0];

          return sendResponse(res, SUCCESS, 'Shelf updated successfully', updatedShelf);
        });
      });
    });
  } catch (error) { errReturned(res, error) }
};


/**
 * Delete Shelf With Id
 **/
exports.deleteShelf = async (req, res) => {
  try {
    let { shelfId } = req.params;
    if (!shelfId || shelfId === undefined || shelfId === null) return sendResponse(res, BADREQUEST, "Shelf Id is required");

    sqlConnection.query(`SELECT * FROM shelves WHERE id = ?`, [shelfId], (error, rows) => {
      if (error) return errReturned(res, error);

      const shelfDetails = rows[0];

      if (!shelfDetails) return sendResponse(res, BADREQUEST, 'Shelf not found');

      const deleteShelfQuery = 'DELETE FROM shelves WHERE id = ?';
      sqlConnection.query(deleteShelfQuery, [shelfId], (err, result) => {
        if (err) return errReturned(res, err);

        if (result.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to delete the shelf');

        return sendResponse(res, SUCCESS, 'Shelf deleted successfully');
      });
    });
  } catch (error) { return errReturned(res, error) }
};
