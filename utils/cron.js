const cron = require('node-cron');
const colors = require('colors');
const { removeExpiredTimeBanners } = require('../utils/banner.helper');

cron.schedule('0 0 * * *', async () => {
    try {
        console.log('Removing expired time-based banners'.bgCyan);

        removeExpiredTimeBanners();
    } catch (e) { console.log(`Cron Error: ${e}`.bgRed) }
});