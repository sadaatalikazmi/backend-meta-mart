'use strict';

const router = require('express').Router();
const auth = require('../../auth/auth.service');
const controller = require('../controllers/analytics.controller');

router.post('/getUsersData', auth.hasRole("admin", "super-admin"), controller.getUsersData);
router.post('/getEventsData', auth.hasRole("admin", "super-admin"), controller.getEventsData);
router.post('/getConversionsData', auth.hasRole("admin", "super-admin"), controller.getConversionsData);

module.exports = router;