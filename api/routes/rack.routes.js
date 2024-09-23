'use strict';

const router = require('express').Router();
const auth = require('../../auth/auth.service');
const controller = require('../controllers/rack.controller');
const { s3Bucket } = require('../../config/environment');

/**************************** ADMIN **************************/

router.post('/pushSlot', auth.hasRole("admin", "super-admin"), controller.pushSlot);
router.post('/pushShelves', auth.hasRole("admin", "super-admin"), controller.pushShelves);
router.post('/pushPlacedProducts', auth.hasRole("admin", "super-admin"), controller.pushPlacedProducts);


router.post('/createRack', auth.hasRole("admin", "super-admin"), s3Bucket.single('image'), controller.createRack);
router.put('/updateRack/:id', auth.hasRole("admin", "super-admin"), s3Bucket.single('image'), controller.updateRack);

router.put('/placeProduct/:id', auth.hasRole("admin", "super-admin"), controller.placeProduct);
router.delete('/deleteRacks/:rackId', auth.hasRole("admin", "super-admin"), controller.deleteRacks);

/**************************** USER **************************/

router.get('/getAllRack', controller.getAllRack);
router.get('/getRack', auth.isAuthenticated(), controller.getRack);
router.get('/getRacks', auth.isAuthenticated(), controller.getRacks);

module.exports = router;