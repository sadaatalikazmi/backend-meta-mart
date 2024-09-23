'use strict';

const router = require('express').Router();
const auth = require('../../auth/auth.service');
const controller = require('../controllers/shelf.controller');

/**************************** ADMIN **************************/

router.put('/updateShelf', auth.hasRole("admin", "super-admin"), controller.updateShelf);
router.post('/createShelf', auth.hasRole("admin", "super-admin"), controller.createShelf);
router.delete('/deleteShelf/:shelfId', auth.hasRole("admin", "super-admin"), controller.deleteShelf);

/**************************** USER **************************/

router.get('/getShelf', auth.isAuthenticated(), controller.getShelf);
router.get('/getAllShelf', auth.isAuthenticated(), controller.getAllShelf);
router.get('/getRackShelves/:_id', auth.isAuthenticated(), controller.getRackShelves);

module.exports = router;