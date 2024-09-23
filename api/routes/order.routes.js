'use strict';

const router = require('express').Router();
const auth = require('../../auth/auth.service');
const controller = require('../controllers/order.controller');

router.get('/getVat', auth.isAuthenticated(), controller.getVat);
router.post('/createOrder', auth.isAuthenticated(), controller.createOrder);
router.get('/getAllOrders', auth.isAuthenticated(), controller.getAllOrders);
router.get('/orderHistory', auth.isAuthenticated(), controller.getUserOrders);

router.post('/orders-stats', auth.isAuthenticated(), controller.getOrderStats);
router.get('/orders-graphs', auth.isAuthenticated(), controller.getAllOrdersGraphs);

router.put('/setStatus', auth.hasRole("admin", "super-admin"), controller.setStatus);
router.get('/earning-graphs', auth.hasRole("admin", "super-admin"), controller.getAllEarningsGraphs);
router.post('/valueVsOrderGraph', auth.hasRole("admin", "super-admin"), controller.getValueVsOrderGraph);
router.post('/valueSalesByMonthGraph', auth.hasRole("admin", "super-admin"), controller.getValueSalesByMonthGraph);
router.post('/salesRegisteredByYearGraph', auth.hasRole("admin", "super-admin"), controller.getSalesRegisteredByYearGraph);
router.post('/salesByHourOfTheDayGraph', auth.hasRole("admin", "super-admin"), controller.getSalesByHourOfTheDayGraph);
router.post('/salesByDayOfTheWeekGraph', auth.hasRole("admin", "super-admin"), controller.getSalesByDayOfTheWeekGraph);
router.post('/countries-graphs', auth.hasRole("admin", "super-admin"), controller.getAllCountriesGraphs);
router.post('/genders-graphs', auth.hasRole("admin", "super-admin"), controller.getGendersGraphs);
router.post('/combined-orders-graphs', auth.hasRole("admin", "super-admin"), controller.getCombinedOrdersGraphs);
router.post('/combined-earnings-graphs', auth.hasRole("admin", "super-admin"), controller.getCombinedEarningsGraphs);

router.post("/addToCart", auth.isAuthenticated(), controller.addToCartProducts);
router.get("/getCartProducts", auth.isAuthenticated(), controller.getCartProducts);

module.exports = router;