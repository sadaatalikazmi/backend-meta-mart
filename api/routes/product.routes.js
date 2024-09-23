'use strict';

const router = require('express').Router();
const auth = require('../../auth/auth.service');
const controller = require('../controllers/product.controller');
const { s3Bucket } = require('../../config/environment');

/**************************** ADMIN **************************/

router.get('/hot', auth.hasRole("admin", "super-admin"), controller.getHotProduct);
router.put('/addDiscount', auth.hasRole("admin", "super-admin"), controller.addDiscount);
router.put('/updateProduct', auth.hasRole("admin", "super-admin"), controller.updateProduct);
router.put('/placingProduct', auth.hasRole("admin", "super-admin"), controller.placingProduct);
router.put('/place-many', auth.hasRole("admin", "super-admin"), controller.placingManyProducts);
router.get('/productQuantity', auth.hasRole("admin", "super-admin"), controller.productQuantity);
router.get('/productCategories', auth.hasRole("admin", "super-admin"), controller.productCategories);
router.delete('/deleteProduct/:productId', auth.hasRole("admin", "super-admin"), controller.deleteProduct);
router.post('/addProduct', s3Bucket.array('productFiles'), auth.hasRole("admin", "super-admin"), controller.addProduct);
router.get('/getCategoriesProducts/:productCategory', auth.hasRole("admin", "super-admin"), controller.getCategoriesProducts);
router.post('/uploadProductModel', s3Bucket.array('model'), auth.hasRole("admin", "super-admin"), controller.uploadProductModel);
router.post('/data', auth.hasRole("admin", "super-admin"), s3Bucket.fields([
  { name: 'model' },
  { name: 'images' },
  { name: 'data', maxCount: 1 }
]), controller.importData)

/**************************** USER **************************/
router.get('/getProduct', controller.getProduct);
router.get('/getAllProduct', controller.getAllProducts);

/*********************************** Graphs ****************************************/
router.post('/getTopItemsPurchasedGraph', controller.getTopItemsPurchasedGraph);
router.post('/getLeastItemsPurchasedGraph', controller.getLeastItemsPurchasedGraph);

router.post('/getTopCategoriesPurchasedGraph', controller.getTopCategoriesPurchasedGraph);
router.post('/getLeastCategoriesPurchasedGraph', controller.getLeastCategoriesPurchasedGraph);
router.post('/categoriesSalesByMonthGraph', controller.getCategoriesSalesByMonthGraph);

router.post('/getTopItemsPurchaseByCategoryGraph', controller.getTopItemsPurchasedGraphByCategory);
router.post('/getLeastItemsPurchaseByCategoryGraph', controller.getLeastItemsPurchasedGraphbyCategory);

router.post('/getTopItemsPurchaseSubCategoryGraph', controller.getTopItemsPurchasedGraphSubCategory);
router.post('/getLeastItemsPurchaseSubCategoryGraph', controller.getLeastItemsPurchasedGraphSubCategory);

router.post('/getSalesByGenderByGraph', controller.getSalesByGenderByGraph);
router.post('/getSalesByByAgeGroupGraph', controller.getSalesByByAgeGroupGraph);
router.post('/getSalesByAreaGraph', controller.getSalesByAreaGraph);

router.post('/getTopItemsPurchaseByGenderGraph', controller.getTopItemsPurchaseByGenderGraph);
router.post('/getTopCategoriesPurchaseByGenderGraph', controller.getTopCategoriesPurchaseByGenderGraph);

router.get('/getSectionNames', controller.getSectionNames);

module.exports = router;