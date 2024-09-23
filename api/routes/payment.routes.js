'use strict';

const router = require('express').Router();
const auth = require('../../auth/auth.service');
const controller = require('../controllers/payment.controller');


router.post('/createPaymentProfile', auth.isAuthenticated(), controller.createPaymentProfile);
router.post('/saveCard', auth.isAuthenticated(), controller.saveCard);
router.post('/pay', auth.isAuthenticated(), controller.pay);
router.post('/refund', auth.isAuthenticated(), controller.refund);

router.get('/getPaymentProfiles', auth.isAuthenticated(), controller.getPaymentProfiles);
router.get('/getUserCards', auth.isAuthenticated(), controller.getUserCards);

router.put('/updatePaymentProfile', auth.isAuthenticated(), controller.updatePaymentProfile);

router.delete('/deletePaymentProfile/:profileId', auth.isAuthenticated(), controller.deletePaymentProfile);


module.exports = router;