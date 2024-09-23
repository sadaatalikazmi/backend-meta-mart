'use strict'

const geoip = require('geoip-lite');
require('hijri-date');
// const hijriMoment = require('moment-hijri');
const { daysOfWeek } = require('../config/environment/const')

const queries = {
    getCurrentCampaignSlotsQuery: `
        SELECT banner_slots.*
        FROM banner_slots
        JOIN banners ON banners.bannerSlotId = banner_slots.id
        WHERE banners.campaignId = ?
    `,

    getAllBannerSlotsQuery: `
        SELECT
            banner_slots.id AS bannerSlotId,
            banner_slots.*,
            banners.id AS bannerId,
            banners.*,
            (SELECT SUM(impressions) FROM banner_users bu WHERE bu.bannerId = banners.id AND bu.userId = ?) AS userFrequency
        FROM banner_slots
        LEFT JOIN banners ON banner_slots.id = banners.bannerSlotId
    `,

    getUserProductCategoriesQuery: `
        SELECT DISTINCT p.type
        FROM users u
        JOIN orders o ON u.id = o.userId
        JOIN order_items oi ON o.id = oi.orderId
        JOIN products p ON oi.productId = p.id
        WHERE u.id = ?
    `,
};

const getLocationFromIP = (ip) => {
    const geo = geoip.lookup(ip);

    return geo ? geo.city : null;
};

const getTimeMetrics = () => {
    const currentDate = new Date();

    const date = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');

    const currentHour = currentDate.getHours();
    const currentDay = daysOfWeek[currentDate.getDay()];
    const lifeEventDate = `${date}-${month}`;

    return { currentDate, currentHour, currentDay, lifeEventDate };
};

const getRamadanDates = () => {
    const currentHijriDate = new HijriDate();
    const currentHijriYear = currentHijriDate.getFullYear();
    const startDate = (new HijriDate(currentHijriYear, 9, 1)).toGregorian();
    const endDate = (new HijriDate(currentHijriYear, 9, 30)).toGregorian();

    return { startDate, endDate };
}

module.exports = { ...queries, getLocationFromIP, getTimeMetrics, getRamadanDates };