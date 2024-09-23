'use strict';

const router = require('express').Router();
const auth = require('../../auth/auth.service');
const controller = require('../controllers/bannerSlot.controller');


router.post('/createBannerSlot', auth.hasRole("admin", "super-admin"), controller.createBannerSlot);
router.post('/getAvailableBannerSlots', auth.isAuthenticated(), controller.getAvailableBannerSlots);

router.get('/getBannerSlot/:id', auth.hasRole("admin", "super-admin"), controller.getBannerSlot);
router.get('/getCurrentCampaignSlots/:campaignId', auth.isAuthenticated(), controller.getCurrentCampaignSlots);
router.get('/getAllBannerSlots/:ip/:device/:os', auth.isAuthenticated(), controller.getAllBannerSlots);

router.delete('/deleteBannerSlot/:id', auth.hasRole("admin", "super-admin"), controller.deleteBannerSlot);

// Push Data //
router.post('/pushBannerSlots', auth.hasRole("admin", "super-admin"), controller.pushBannerSlots);


module.exports = router;