'use strict';
// =================== //
// Production Settings //
// =================== //
module.exports = {
  mongo: {
    db_url: process['env']['prod_db_url'],
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    },
    debug: false,
  },
  client: `http://localhost:3000`,
  server: `https://localhost:4000`
};