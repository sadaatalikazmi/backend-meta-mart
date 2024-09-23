'use strict';
module.exports = {
  userRoles: ['user', 'admin', 'super-admin', 'advertiser'],
  userStatus: ['In Complete', 'Verified', 'Registered'],
  
  VAT: 5,
  currency: 'AED',
  orderStatuses: ['PENDING', 'REFUND', 'IN PROCESS', 'COMPLETED', 'CANCELLED', 'ONHOLD'],
  
  validSizes: ['small', 'medium', 'large'],
  productTypes: [
    'Bakery', 'Produce', 'Dairy', 'Chips & Snacks', 'Chocolates & Candies', 'Soft Drinks & Juices', 'Cereals & Packets', 'Hygiene & Personal Care',
    'Household Care', 'Ice Creams', 'Cans & Jars', 'Pasta, Rice & Other', 'Herbs & Spices', 'Coffee & Tea', 'Shampoos & Haircare', 'Pet Care',
    'Butchery', 'Deli', 'Fishery', 'Frozen', 'Other'
  ],
  productSubTypes: [
    'Croissants', 'Viennoiseries', 'Bread', 'Muffins', 'Desserts', 'Cookies', 'Cakes', 'Buns & Sandwiches', 'Veggies', 'Fruits',
    'Fresh Herbs', 'Organic', 'Dried', 'Vegetables', 'Cheese Shelf', 'Milk', 'Yogurt & Laban', 'Eggs', 'Butter & Cream Fresh',
    'Milk', 'Soya & Others', 'Spreads', 'Desserts', 'Chips & Dips', 'Biscuits & Cookies', 'Crackers & Popcorn', 'Protein & Energy',
    'Snacks', 'Healthy Snacks', 'Pouches & Boxes', 'Bars', 'Candies', 'Labs', 'Gums & Mints', 'Soft Drinks', 'Shelf Juices',
    'Energy Drinks', 'Sports Drinks', 'Iced Coffee & Tea', 'Fresh Juices', 'Smoothies', 'Malt Drinks', 'Cereals', 'Oats & Muesli',
    'Cereal Bars', 'Dry Soups', 'Dry Sauces', 'Fem Care', 'Toothpastes', 'Woman Deo', 'Men Deo', 'Mouthwash', 'Floss & Other',
    'Toothbrushes', 'Sanitizers', 'Foot Care', 'Surface Cleaning', 'Liquid Detergents', 'Toilet Rolls', 'Dish Cleaning', 'Powder',
    'Detergents', 'Fabric Softener', 'Bathroom Cleaning', 'Air Fresheners', 'Cups & Tubs', 'Sorbet & Sticks', 'Cones', 'Oil',
    'Spread & Dips', 'Sauces & Dressings', 'Tuna & Fish', 'Pasta & Tomato Sauce', 'Vegetables & Fruits', 'Pickles & Olives',
    'Soups & Beans', 'Canned Meat', 'Syrups & Honey', 'Desserts', 'Sweet Spreads & Dips', 'Rice', 'Pasta', 'Noodles',
    'Pulses & Grains', 'Gluten Free Pasta', 'Shampoos', 'Conditioners', 'Hair Styling', 'Hair Treatments', 'Cat Food', 'Cat Care',
    'Dog Food', 'Bird & Others', 'Dog Care', 'Seasonings', 'Spices', 'Salt & Pepper', 'Herbs', 'Coffee', 'Tea', 'Creamers & Sweeteners',
    'Chocolate', 'Coffee Capsules', 'Fresh Meat', 'Chicken', 'Beef', 'Burgers', 'Lamb', 'Veal', 'Turkey', 'Cold Cuts', 'Sausages',
    'Fish', 'Shrimp', 'Salmon', 'Seabass', 'Vegetables & Potatoes', 'Pastries & Desserts', 'Pizzas & Breads', 'Meals', 'Fruits', 'Other'
  ],
  productsCategories: [
    'Bakery', 'Produce', 'Dairy', 'Chips & Snacks', 'Chocolates & Candies', 'Soft Drinks & Juices', 'Cereals & Packets', 'Hygiene & Personal Care',
    'Household Care', 'Ice Creams', 'Cans & Jars', 'Pasta, Rice & Other', 'Herbs & Spices', 'Coffee & Tea', 'Shampoos & Haircare', 'Pet Care',
    'Butchery', 'Deli', 'Fishery', 'Frozen', 'Other'
  ],
  productUnits: ['pack', 'kg', 'lb', 'dozen', 'ltr'],

  rackCategories: ['Snacks', 'Dairy', 'Grocery', 'Dry Fruits', 'Softdrinks', 'Cheese', 'Sweets', 'Meat', 'Chocolates', 'fruits', 'vegetables'],
  rackTypes: ['miniShelf', 'shelf', 'table', 'cube', 'fridge', 'freezer', 'cheese', 'beef', 'chicken', 'seaFood', 'box', 'glass', 'singleRack', 'smallProducts'],

  emailValidator: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,

  colors: ["#0074D9", "#2ECC40", "#FF4136", "#B10DC9", "#FF851B", "#39CCCC", "#FFDC00", "#F012BE", "#AAAAAA", "#3D9970", "#FFD700", "#FF6347", "#9A32CD", "#48D1CC", "#87CEFA", "#FF69B4", "#40E0D0", "#FF4500", "#32CD32", "#FF8C00", "#00CED1", "#8A2BE2", "#00FA9A", "#D2691E", "#7B68EE", "#ADFF2F", "#800000", "#00FFFF", "#8B008B", "#20B2AA", "#DC143C", "#7FFF00", "#7CFC00", "#800080", "#FF1493", "#00BFFF", "#8B0000", "#66CDAA", "#FF4500", "#6A5ACD", "#FF6347", "#00FA9A", "#8B4513", "#8A2BE2", "#BDB76B", "#00FF00", "#00FF7F", "#8A2BE2", "#32CD32", "#8B4513", "#00000000"],

  sectionNames: ['Bakery', 'Cheese', 'Beef', 'Produce', 'Flower', 'Chips & Snacks', 'Ice Creams', 'Soft Drinks & Juices'],

  bannerSlotTypes: ['rack', 'table', 'roof', 'checkout', 'fridge', 'wall'],
  basicAdAmount: 15,

  daysOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

  lifeEvents: [
    { day: `Ramadan`, date: 'N/A' },
    {day: `Women's Day`, date: '08-03'},
    {day: `Flower Day`, date: '21-03'},
    {day: `Water Day`, date: '22-03'},
    {day: `Labour Day`, date: '01-05'},
    {day: `Tea Day`, date: '21-05'},
    {day: `No-Tobacco Day`, date: '31-05'},
    {day: `Choclate Day`, date: '07-07'},
    {day: `Men's Day`, date: '19-11'},
    {day: `Children's Day`, date: '20-11'},
  ]
};

module.exports.nonce = Math.floor(Math.random(Math.floor(Date.now() / 1000)) * 10000000000);
module.exports.lastName = Math.floor(Math.random(Math.floor(Date.now() / 1000)) * 100000);
