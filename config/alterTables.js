const mysql = require('mysql2');
require('colors');
require('dotenv').config({ path: `./.env.${process['env']['NODE_ENV']}` });
require('dotenv').config();

const creatTables = async () => {
  const connection = await mysql.createConnection({
    host: process.env.MY_SQL_HOST,
    user: process.env.MY_SQL_USER,
    password: process.env.MY_SQL_PASSWORD,
    database: process.env.MY_SQL_DB
  });

  await connection.connect((err) => {
    if (err) {
      console.error(`Error connecting to MySQL: ${err}`.bgRed);
      return;
    }

    console.log('Connected to MySQL server'.bgGreen);
  });

  const alterOrdersTableQuery = `
    ALTER TABLE orders
    ADD CONSTRAINT fk_orders_users
    FOREIGN KEY (userId) REFERENCES users(id)
  `;

  const alterOrderItemsTableQuery = `
    ALTER TABLE order_items
    ADD CONSTRAINT fk_order_items_orders
    FOREIGN KEY (orderId) REFERENCES orders(id),
    ADD CONSTRAINT fk_order_items_products
    FOREIGN KEY (productId) REFERENCES products(id)
  `;

  const alterShelvesTableQuery = `
    ALTER TABLE shelves
    ADD CONSTRAINT fk_shelves_racks
    FOREIGN KEY (rack) REFERENCES racks(id)
  `;

  const alterSlotsTableQuery = `
    ALTER TABLE slots
    ADD CONSTRAINT fk_slots_shelves
    FOREIGN KEY (shelfId) REFERENCES shelves(id),
    ADD CONSTRAINT fk_slots_products
    FOREIGN KEY (productId) REFERENCES products(id)
  `;

  const alterCartTableQuery = `
    ALTER TABLE cart
    ADD CONSTRAINT fk_cart_users
    FOREIGN KEY (userId) REFERENCES users(id),
    ADD CONSTRAINT fk_cart_products
    FOREIGN KEY (productId) REFERENCES products(id)
  `;

  const alterTransactionsTableQuery = `
    ALTER TABLE transactions
    ADD CONSTRAINT fk_transactions_users
    FOREIGN KEY (customerId) REFERENCES users(id)
  `;

  const alterTransactionDetailsTableQuery = `
    ALTER TABLE transaction_details
    ADD CONSTRAINT fk_transaction_details_transactions
    FOREIGN KEY (transactionId) REFERENCES transactions(id),
    ADD CONSTRAINT fk_transaction_details_products
    FOREIGN KEY (productId) REFERENCES products(id)
  `;

  const alterInventoryTableQuery = `
    ALTER TABLE inventory
    ADD CONSTRAINT fk_inventory_products
    FOREIGN KEY (productId) REFERENCES products(id)
  `;

  const alterBannersTableQuery = `
    ALTER TABLE banners
    ADD CONSTRAINT fk_banners_users
    FOREIGN KEY (userId) REFERENCES users(id)
  `;

  const alterBannerSlotsTableQuery = `
    ALTER TABLE banner_slots
    ADD CONSTRAINT fk_banner_slots_banners
    FOREIGN KEY (bannerId) REFERENCES banners(id)
  `;

  const alterBannerUsersTableQuery = `
    ALTER TABLE banner_users
    ADD CONSTRAINT fk_banner_users_banners
    FOREIGN KEY (bannerId) REFERENCES banners(id),
    ADD CONSTRAINT fk_banner_users_users
    FOREIGN KEY (userId) REFERENCES users(id)
  `;


  // await connection.execute(alterOrdersTableQuery);
  // await connection.execute(alterOrderItemsTableQuery);
  // await connection.execute(alterShelvesTableQuery);
  // await connection.execute(alterSlotsTableQuery);
  // await connection.execute(alterCartTableQuery);
  // await connection.execute(alterTransactionsTableQuery);
  // await connection.execute(alterTransactionDetailsTableQuery);
  // await connection.execute(alterInventoryTableQuery);
  // await connection.execute(alterBannersTableQuery);
  // await connection.execute(alterBannerSlotsTableQuery);
  // await connection.execute(alterBannerUsersTableQuery);

  connection.end();
}

creatTables();