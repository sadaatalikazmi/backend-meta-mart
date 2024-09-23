'use strict';
// ==================== //
// Development Settings //
// ==================== //
module.exports = {
  mongo: {
    db_url: process['env']['dev_db_url'],

    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    },
    debug: false,
  },
  client: `http://localhost:3000`,
  server: `https://localhost:4000`
};
