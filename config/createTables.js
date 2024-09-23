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

  const createUsersTableQuery = `
    CREATE TABLE users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE,
      firstName VARCHAR(255),
      lastName VARCHAR(255),
      name VARCHAR(510),
      email VARCHAR(255),
      gender ENUM('male', 'female') DEFAULT 'male',
      phone VARCHAR(15),
      location VARCHAR(255),
      zip VARCHAR(10),
      avatar VARCHAR(255),
      city VARCHAR(255),
      country VARCHAR(255),
      billingAddress VARCHAR(255),
      address VARCHAR(255),
      hashedPassword VARCHAR(255) NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      userId VARCHAR(255),
      age INT,
      area VARCHAR(255),
      role VARCHAR(255) DEFAULT 'user',
      vendor VARCHAR(255),
      stripeId VARCHAR(255),
      status VARCHAR(255) DEFAULT 'active
    )
  `;

  const createUserDevicesTableQuery = `
    CREATE TABLE Metamart.user_devices (
      id INT PRIMARY KEY AUTO_INCREMENT,
      userId INT,
      deviceId VARCHAR(255) DEFAULT NULL,
      fcmToken VARCHAR(255) DEFAULT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `;

  const createProductsTableQuery = `
    CREATE TABLE products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      imageUrl VARCHAR(255),
      productSize INT NOT NULL,
      file VARCHAR(255),
      price DECIMAL(10, 2) NOT NULL,
      quantity INT NOT NULL,
      currency ENUM('usd', 'gbp') DEFAULT 'usd',
      type VARCHAR(255) NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      isDiscounted BOOLEAN DEFAULT 0,
      discountedPrice INT,
      subType VARCHAR(255),
      unit VARCHAR(255)
    )
  `;

  const createRacksTableQuery = `
    CREATE TABLE racks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(16) NOT NULL,
      description VARCHAR(255),
      productSize INT,
      image VARCHAR(255),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      category VARCHAR(255),
      type VARCHAR(255)
    )
  `;

  const createShelvesTableQuery = `
    CREATE TABLE shelves (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      maxSlots INT NOT NULL,
      rack INT NOT NULL,
      FOREIGN KEY (rack) REFERENCES racks(id),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  const createSlotsTableQuery = `
    CREATE TABLE slots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slotNo INT NOT NULL,
      shelfId INT NOT NULL,
      productId INT,
      FOREIGN KEY (shelfId) REFERENCES shelves(id),
      FOREIGN KEY (productId) REFERENCES products(id),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  const createInventoryTableQuery = `
    CREATE TABLE inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId INT,
      quantityAvailable INT,
      FOREIGN KEY (productId) REFERENCES products(id)
    )
  `;

  const createOrdersTableQuery = `
    CREATE TABLE orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderNumber INT,
      userId INT,
      billingAddress VARCHAR(255),
      totalAmount DECIMAL(10, 2) NOT NULL,
      reciptUrl VARCHAR(255),
      transactionId VARCHAR(255),
      currency ENUM('Dollar', 'Pound'),
      status ENUM('IN PROCESS', 'REFUND', 'PENDING', 'COMPLETED', 'CANCELLED', 'ONHOLD') DEFAULT 'IN PROCESS',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      vat DECIMAL(10, 2) NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `;

  const createOrderItemsTableQuery = `
    CREATE TABLE order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderId INT,
      productId INT,
      quantity INT,
      unitPrice INT,
      subtotal INT,
      FOREIGN KEY (orderId) REFERENCES orders(id),
      FOREIGN KEY (productId) REFERENCES products(id)
    )
  `;

  const createCartTableQuery = `
      CREATE TABLE cart (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT,
        productId INT,
        quantity INT,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (productId) REFERENCES products(id)
      )
  `;

  const createTransactionsTableQuery = `
    CREATE TABLE transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT,
      transactionId VARCHAR(255) NOT NULL,
      transactionDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      totalAmount INT,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customerId) REFERENCES users(id)
    )
  `;

  const createTransactionDetailsTableQuery = `
    CREATE TABLE transaction_details (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transactionId INT,
      productId INT,
      quantitySold INT,
      subtotal INT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (transactionId) REFERENCES transactions(id),
      FOREIGN KEY (productId) REFERENCES products(id)
    )
  `;

  const createBannerCampaignsTableQuery = `
    CREATE TABLE banner_campaigns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      adName VARCHAR(255),
      category VARCHAR(255),
      previousAmount DECIMAL(10,2),
      amount DECIMAL(10,2),
      remainingAmount DECIMAL(10,2),
      transactionId VARCHAR(255),
      isPaid BOOLEAN DEFAULT 0,
      status VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `;

  const createBannersTableQuery = `
    CREATE TABLE banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      type VARCHAR(255),
      size INT,
      bannerUrl VARCHAR(255),
      bannerFormat VARCHAR(255),
      location VARCHAR(255),
      gender VARCHAR(255),
      fromAge INT,
      toAge INT,
      amount DECIMAL(10,2),
      impressionsLimit INT,
      timeLimit DATE,
      status VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      category VARCHAR(255),
      productCategory VARCHAR(255),
      device VARCHAR(255),
      os VARCHAR(255),
      fromHour INT,
      toHour INT,
      dayOfWeek VARCHAR(255),
      frequencyCap INT,
      reachNumber INT,
      reachGender VARCHAR(255),
      lifeEvent VARCHAR(255),
      isPaid BOOLEAN DEFAULT 0,
      adName VARCHAR(255),
      shareOfVoice INT,
      campaignId INT,
      bannerSlotId INT,
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (campaignId) REFERENCES banner_campaigns(id),
      FOREIGN KEY (bannerSlotId) REFERENCES banner_slots(id)
    )
  `;

  const createBannerSlotsTableQuery = `
    CREATE TABLE banner_slots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      type VARCHAR(255),
      bannerSize INT,
      thumbnail VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (bannerId) REFERENCES banners(id)
    )
  `;

  const createBannerUsersTableQuery = `
    CREATE TABLE banner_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bannerId INT,
      userId INT,
      gender VARCHAR(255),
      impressions INT,
      maleImpressions INT,
      femaleImpressions INT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      campaignId INT,
      os VARCHAR(255),
      device VARCHAR(255),
      FOREIGN KEY (bannerId) REFERENCES banners(id),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (campaignId) REFERENCES banner_campaigns(id)
    )
  `;

  const createBannerNotificationsTableQuery = `
    CREATE TABLE banner_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      campaignId INT,
      bannerName VARCHAR(255),
      status VARCHAR(255),
      message VARCHAR(255),
      senderId INT,
      receiverId INT,
      isRead BOOLEAN DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaignId) REFERENCES banner_campaigns(id),
      FOREIGN KEY (senderId) REFERENCES users(id),
      FOREIGN KEY (receiverId) REFERENCES users(id)
    )
  `;

  const createPaymentProfilesTable = `
    CREATE TABLE payment_profiles (
      id INT PRIMARY KEY AUTO_INCREMENT,
      userId INT,
      profileType VARCHAR(255) NOT NULL,
      organizationName VARCHAR(255) NOT NULL,
      legalName VARCHAR(255) NOT NULL,
      suite VARCHAR(255),
      suburb VARCHAR(255) NOT NULL,
      city VARCHAR(255) NOT NULL,
      postalCode INT,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `;

  const createDataProtectionContactsTable = `
    CREATE TABLE data_protection_contacts (
      id INT PRIMARY KEY AUTO_INCREMENT,
      userId INT,
      pcName VARCHAR(255) NOT NULL,
      pcEmail VARCHAR(255) NOT NULL,
      pcPhoneNumber VARCHAR(20),
      pcAddress VARCHAR(255),
      dpcName VARCHAR(255),
      dpcEmail VARCHAR(255),
      dpcPhoneNumber VARCHAR(20),
      dpcAddress VARCHAR(255),
      tradeLicense VARCHAR(255),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `;


  // await connection.execute(createUsersTableQuery);
  // await connection.execute(createUserDevicesTableQuery);
  // await connection.execute(createProductsTableQuery);
  // await connection.execute(createRacksTableQuery);
  // await connection.execute(createShelvesTableQuery);
  // await connection.execute(createSlotsTableQuery);
  // await connection.execute(createInventoryTableQuery);
  // await connection.execute(createOrdersTableQuery);
  // await connection.execute(createOrderItemsTableQuery);
  // await connection.execute(createCartTableQuery);
  // await connection.execute(createTransactionsTableQuery);
  // await connection.execute(createTransactionDetailsTableQuery);
  // await connection.execute(createBannerCampaignsTableQuery);
  // await connection.execute(createBannersTableQuery);
  // await connection.execute(createBannerSlotsTableQuery);
  // await connection.execute(createBannerUsersTableQuery);
  // await connection.execute(createBannerNotificationsTableQuery);
  // await connection.execute(createPaymentProfilesTable);
  // await connection.execute(createDataProtectionContactsTable);

  
  connection.end();
}

creatTables();