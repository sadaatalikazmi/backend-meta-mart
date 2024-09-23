"use strict";

const router = require("express").Router();
const controller = require("../controllers/user.controller");
const auth = require("../../auth/auth.service");


/////////////////////   ADMIN    ///////////////////////////

router.get("/getAllUsers", auth.hasRole("admin", "super-admin"), controller.getAllUsers);
router.get('/newcustomers-graph', auth.hasRole("admin", "super-admin"), controller.newCustomersGraph);
router.put("/updateUser/:id", auth.hasRole("admin", "super-admin"), controller.updateUser);


/////////////////////   USER    ///////////////////////////

router.post("/login", controller.login);
router.post("/signup", controller.signUp)
router.post("/loginWithGoogle", controller.loginWithGoogle);
router.get("/me", auth.isAuthenticated(), controller.myProfle);
router.get("/getVendor", auth.isAuthenticated(), controller.getVendor);
router.put("/updateUser", auth.isAuthenticated(), controller.updateMe);
router.put("/updateUsername", auth.isAuthenticated(), controller.updateUsername);
router.put("/billingAddress", auth.isAuthenticated(), controller.billingAddress);
router.put("/updateVendor", auth.isAuthenticated(), controller.updateVendor);
router.patch("/cancelAccount", auth.isAuthenticated(), controller.cancelAccount);

router.get("/countriesList", auth.isAuthenticated(), controller.countriesList);

module.exports = router;
