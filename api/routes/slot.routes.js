'use strict';

const router = require('express').Router();
const auth = require('../../auth/auth.service');
const controller = require('../controllers/slot.controller');

/**************************** ADMIN **************************/

router.post('/createSlot', auth.hasRole("admin", "super-admin"), controller.createSlot);
router.put('/updateSlot', auth.hasRole("admin", "super-admin"), controller.updateSlot);
router.delete('/deleteSlot/:slotId', auth.hasRole("admin", "super-admin"), controller.deleteSlot);

/**************************** USER **************************/

router.get('/getSlot', auth.isAuthenticated(), controller.getSlot);
router.get('/getAllSlot', auth.isAuthenticated(), controller.getAllSlot);
router.get('/getShelfSlot/:_id', auth.isAuthenticated(), controller.getShelfSlot);



module.exports = router;