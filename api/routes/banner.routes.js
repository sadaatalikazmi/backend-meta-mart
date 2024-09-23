'use strict';

const router = require('express').Router();
const auth = require('../../auth/auth.service');
const controller = require('../controllers/banner.controller');
const { s3Bucket } = require('../../config/environment');
const { upload } = require('../../utils/s3Config');


router.post('/draftAdCampaign', auth.isAuthenticated(), controller.draftAdCampaign);
router.post('/getBannerMetrics', auth.isAuthenticated(), controller.getBannerMetrics);
router.post('/createBanner', upload.fields([
    { name: 'rackFile', maxCount: 1 },
    { name: 'tableFile', maxCount: 1 },
    { name: 'roofFile', maxCount: 1 },
    { name: 'checkoutFile', maxCount: 1 },
    { name: 'fridgeFile', maxCount: 1 },
    { name: 'wallFile', maxCount: 1 },
]), auth.isAuthenticated(), controller.createBanner);
router.post('/getEditedBannerMetrics', auth.isAuthenticated(), controller.getEditedBannerMetrics);
router.post('/editBanner', upload.fields([
    { name: 'rackFile', maxCount: 1 },
    { name: 'tableFile', maxCount: 1 },
    { name: 'roofFile', maxCount: 1 },
    { name: 'checkoutFile', maxCount: 1 },
    { name: 'fridgeFile', maxCount: 1 },
    { name: 'wallFile', maxCount: 1 },
]), auth.isAuthenticated(), controller.editBanner);
router.post('/createPaymentIntent', auth.isAuthenticated(), controller.createPaymentIntent);
router.post('/getUserDashboard', auth.isAuthenticated(), controller.getUserDashboard);
router.post('/getUserBannersGraph', auth.isAuthenticated(), controller.getUserBannersGraph);
router.post('/getAllBannersGraph', auth.hasRole("admin", "super-admin"), controller.getAllBannersGraph);
router.post('/getCampaignGraphs', auth.isAuthenticated(), controller.getCampaignGraphs);
router.post('/saveDataProtectionContact', auth.isAuthenticated(), controller.saveDataProtectionContact);
router.post('/saveTradeLicense', upload.fields([{ name: 'tradeLicenseFile', maxCount: 1 }]), auth.isAuthenticated(), controller.saveTradeLicense);

router.get('/getCampaign/:campaignId', auth.isAuthenticated(), controller.getCampaign);
router.get('/getRunCampaigns', auth.isAuthenticated(), controller.getRunCampaigns);
router.get('/getBannerLocations', auth.isAuthenticated(), controller.getBannerLocations);
router.get('/getUserBanners', auth.isAuthenticated(), controller.getUserBanners);
router.get('/getUserDraftCampaigns', auth.isAuthenticated(), controller.getUserDraftCampaigns);
router.get('/getAllBanners', auth.hasRole("admin", "super-admin"), controller.getAllBanners);
router.get('/getUnreadNotifications', auth.isAuthenticated(), controller.getUnreadNotifications);
router.get('/getUserNotifications', auth.isAuthenticated(), controller.getUserNotifications);
router.get('/getBannerNotification/:id', auth.isAuthenticated(), controller.getBannerNotification);
router.get('/getRamadanDates', auth.isAuthenticated(), controller.getDatesOfRamadan);
router.get('/getDataProtectionContact', auth.isAuthenticated(), controller.getDataProtectionContact);

router.put('/updateBannerPayment', auth.isAuthenticated(), controller.updateBannerPayment);
router.put('/markAsRead/:notificationId', auth.isAuthenticated(), controller.markAsRead);
router.put('/setStatus', auth.hasRole("admin", "super-admin"), controller.setStatus);
router.put('/detachExpiredTimeBanners', auth.isAuthenticated(), controller.detachExpiredTimeBanners);
router.put('/interact/:bannerId/:os/:device', auth.isAuthenticated(), controller.interact);

router.delete('/deleteBanner/:id', auth.hasRole("admin", "super-admin"), controller.deleteBanner);
router.delete('/discardDraftCampaign/:id', auth.isAuthenticated(), controller.discardDraftCampaign);


module.exports = router;