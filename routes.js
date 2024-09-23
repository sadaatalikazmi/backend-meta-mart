"use strict";
/**
 *   Main application routes
 **/

module.exports = (app) => {
  app.use("/api/user", require("./api/routes/user.routes"));
  app.use("/api/rack", require("./api/routes/rack.routes"));
  app.use("/api/shelf", require("./api/routes/shelf.routes"));
  app.use("/api/slot", require("./api/routes/slot.routes"));
  app.use("/api/product", require("./api/routes/product.routes"));
  app.use("/api/order", require("./api/routes/order.routes"));
  app.use("/api/analytics", require("./api/routes/analytics.routes"));
  app.use("/api/bannerSlot", require("./api/routes/bannerSlot.routes"));
  app.use("/api/banner", require("./api/routes/banner.routes"));
  app.use("/api/payment", require("./api/routes/payment.routes"));
};
