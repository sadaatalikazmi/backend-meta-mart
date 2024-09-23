'use strict';

const sqlConnection = require("../config/sqlConnection");
const { colors, bannerSlotTypes } = require('../config/environment/const');
const { selectQuery, updateQuery, deleteQuery } = require('./helper');

const queries = {
    selectBannerLocationsQuery: `SELECT DISTINCT location FROM banners WHERE location IS NOT NULL`,

    insertBannerUserQuery: `
        INSERT into banner_users
        (bannerId, userId, gender, impressions, maleImpressions, femaleImpressions, campaignId, os, device)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,

    getOsDeviceBetweenDatesQuery: `
        SELECT
            bu.campaignId,
            bc.amount,
            COUNT(CASE WHEN bu.os = 'Android' THEN bu.os END) AS android,
            COUNT(CASE WHEN bu.os = 'VR' THEN bu.os END) AS vr,
            COUNT(CASE WHEN bu.device = 'Oculus' THEN bu.device END) AS oculus,
            COUNT(CASE WHEN bu.device = 'Samsung' THEN bu.device END) AS samsung,
            COUNT(CASE WHEN bu.device = 'Oppo' THEN bu.device END) AS oppo,
            COUNT(CASE WHEN bu.device = 'Xiaomi' THEN bu.device END) AS xiaomi,
            COUNT(CASE WHEN bu.device = 'Vivo' THEN bu.device END) AS vivo
        FROM banner_users bu
        LEFT JOIN banner_campaigns bc ON bu.campaignId = bc.id
        WHERE
            bc.userId = ?
            AND bu.createdAt BETWEEN ? AND ?
            AND bu.campaignId IN (?)
        GROUP BY bu.campaignId;
    `,

    getCampaignBannersQuery: `
        SELECT
            b.id,
            b.campaignId,
            b.adName,
            b.userId,
            b.type,
            b.location,
            b.amount,
            bu.gender,
            SUM(bu.impressions) AS impressions,
            SUM(bu.maleImpressions) AS maleImpressions,
            SUM(bu.femaleImpressions) AS femaleImpressions
        FROM banners b
        LEFT JOIN banner_users bu ON b.id = bu.bannerId
        WHERE
            b.campaignId = ? AND
            (b.createdAt BETWEEN ? AND ?)
        GROUP BY b.id, b.type, b.location, b.amount
    `,

    getUserCampaignsQuery: `SELECT * FROM banner_campaigns WHERE userId = ? AND status <> 'draft'`,

    getUserDraftCampaignsQuery: `SELECT * FROM banner_campaigns WHERE userId = ? AND status = 'draft'`,

    getAllCampaignsQuery: 'SELECT * FROM banner_campaigns',

    getUnreadNotificationsQuery: 'SELECT * FROM banner_notifications WHERE receiverId = ? AND isRead = 0',

    getUserNotificationsQuery: 'SELECT * FROM banner_notifications WHERE receiverId = ? ORDER BY createdAt DESC',

    getCamgaignNotificationQuery: 'SELECT * FROM banner_notifications WHERE campaignId = ? ORDER BY createdAt DESC LIMIT 1',
};

const getCountActiveUsersQuery = (gender) => {
    const countActiveUsersQuery = gender === 'male'
        ? `SELECT COUNT(DISTINCT userId) AS activeUsersCount FROM banner_users WHERE gender = 'male'`
        : gender === 'female'
            ? `SELECT COUNT(DISTINCT userId) AS activeUsersCount FROM banner_users WHERE gender = 'female'`
            : `SELECT COUNT(DISTINCT userId) AS activeUsersCount FROM banner_users`;

    return countActiveUsersQuery;
};

const getImpressionsBetweenDatesQuery = (startDate, endDate, campaigns) => {
    const impressionsBetweenDatesQuery = `
        SELECT
            bu.id AS id,
            bu.bannerId AS bannerId,
            bu.userId AS bannerUserId,
            bu.gender AS gender,
            bu.impressions AS impressions,
            bu.maleImpressions AS maleimpressions,
            bu.femaleimpressions AS femaleimpressions,
            bu.campaignId AS campaignId,
            bu.os AS os,
            bu.device AS device,
            bu.createdAt AS createdAt,
            bc.userId AS userId,
            bc.adName AS campaignName
        FROM banner_users bu
        LEFT JOIN banner_campaigns bc ON bc.id = bu.campaignId
        WHERE
        bc.userId = ?
        AND bu.createdAt BETWEEN ? AND ?
        AND bu.campaignId IN (?);
    `;

    let fromDate = new Date();
    let toDate = new Date();

    if (startDate && startDate !== null && endDate && endDate !== null) {
        fromDate = new Date(startDate);
        toDate = new Date(endDate);
    } else {
        fromDate.setDate(toDate.getDate() - 30);
    }

    return { impressionsBetweenDatesQuery, fromDate, toDate };
};

const getBannersBetweenDatesQuery = (startDate, endDate) => {
    const bannersBetweenDatesQuery = `
        SELECT
            b.id,
            b.campaignId,
            b.adName,
            b.userId,
            b.type,
            b.location,
            b.amount,
            bu.gender,
            SUM(bu.impressions) AS impressions,
            SUM(bu.maleImpressions) AS maleImpressions,
            SUM(bu.femaleImpressions) AS femaleImpressions
        FROM banners b
        LEFT JOIN banner_users bu ON b.id = bu.bannerId
        WHERE b.createdAt BETWEEN ? AND ?
        GROUP BY b.id, b.type, b.location, b.amount;
    `;

    let fromDate = new Date();
    let toDate = new Date();

    if (startDate && startDate !== null && endDate && endDate !== null) {
        fromDate = new Date(startDate);
        toDate = new Date(endDate);
    } else {
        fromDate.setDate(toDate.getDate() - 30);
    }

    return { bannersBetweenDatesQuery, fromDate, toDate };
};

const getCampaignImpressionsBetweenDatesQuery = (startDate, endDate) => {
    const campaignImpressionsBetweenDatesQuery = `SELECT * FROM banner_users WHERE campaignId = ? AND (createdAt BETWEEN ? AND ?)`;

    let fromDate = new Date();
    let toDate = new Date();

    if (startDate && startDate !== null && endDate && endDate !== null) {
        fromDate = new Date(startDate);
        toDate = new Date(endDate);
    } else {
        fromDate.setDate(toDate.getDate() - 30);
    }

    return { campaignImpressionsBetweenDatesQuery, fromDate, toDate };
};

const getGraphSeries = (graphData) => {
    const graphSeries = [
        {
            name: 'Total Impressions',
            id: 1,
            color: colors[0],
            data: graphData.map(el => el.impressions ? Number(el.impressions) : 0)
        },
        {
            name: 'Male Impressions',
            id: 2,
            color: colors[1],
            data: graphData.map(el => el.maleImpressions ? Number(el.maleImpressions) : 0)
        },
        {
            name: 'Female Impressions',
            id: 3,
            color: colors[2],
            data: graphData.map(el => el.femaleImpressions ? Number(el.femaleImpressions) : 0)
        },
        {
            name: 'Amount',
            id: 4,
            color: colors[3],
            data: graphData.map(el => el.amount ? Number(el.amount) : 0)
        }
    ];

    return graphSeries;
}

const getGraphResponse = (location, banners) => {
    const graphData = location === 'all' ? banners : banners.filter(banner => banner.location && banner.location.includes(location));

    // const bannerIdGraphData = graphData;
    const bannerIdGraphData = graphData.reduce((result, item) => {
        const existingItem = result.find((group) => group.campaignId === item.campaignId && group.adName === item.adName);

        if (existingItem) {
            existingItem.impressions += item.impressions ? parseInt(item.impressions, 10) : 0;
            existingItem.maleImpressions += item.maleImpressions ? parseInt(item.maleImpressions, 10) : 0;
            existingItem.femaleImpressions += item.femaleImpressions ? parseInt(item.femaleImpressions, 10) : 0;
        } else {
            result.push({
                campaignId: item.campaignId,
                adName: item.adName,
                userId: item.userId,
                location: item.location,
                impressions: item.impressions ? parseInt(item.impressions, 10) : 0,
                maleImpressions: item.maleImpressions ? parseInt(item.maleImpressions, 10) : 0,
                femaleImpressions: item.femaleImpressions ? parseInt(item.femaleImpressions, 10) : 0,
                amount: item.amount ? parseInt(item.amount, 10) : 0,
            });
        }

        return result;
    }, []);

    const slotTypeGraphData = bannerSlotTypes.map(type => {
        const typeData = graphData
            .filter(obj => obj.type === type)
            .reduce((acc, obj) => {
                acc.impressions += obj.impressions ? Number(obj.impressions) : 0;
                acc.maleImpressions += obj.maleImpressions ? Number(obj.maleImpressions) : 0;
                acc.femaleImpressions += obj.femaleImpressions ? Number(obj.femaleImpressions) : 0;
                acc.amount += obj.amount ? parseFloat(obj.amount) : 0;

                return acc;
            }, {
                type,
                impressions: 0,
                maleImpressions: 0,
                femaleImpressions: 0,
                amount: 0
            });

        return typeData;
    });

    const bannersGraph = {
        bannerIdGraph: {
            labels: bannerIdGraphData.map(el => el.adName),
            series: getGraphSeries(bannerIdGraphData),
        },
        slotTypeGraph: {
            labels: bannerSlotTypes,
            series: getGraphSeries(slotTypeGraphData),
        },
    };

    return bannersGraph;
};

const removeBanner = (bannerId) => {
    try {
        sqlConnection.query(selectQuery('*', 'banners', 'id'), [bannerId], (bannerError, bannerResult) => {
            if (bannerError) return console.error(bannerError);

            const updateBannerQuery = updateQuery('banners', ['status'], 'id');
            const updateBannerValues = ['expired', bannerId];
            sqlConnection.query(updateBannerQuery, updateBannerValues, (updateBannerError, updateBannersResult) => {
                if (updateBannerError) return console.log(updateBannerError);

                sqlConnection.query(selectQuery('*', 'banners', 'campaignId'), [bannerResult[0].campaignId], (bannersError, bannersResult) => {
                    if (bannersError) return console.log(bannersError);

                    let statusArray = bannersResult.map(banner => banner.status);
                    let expireCount = statusArray.filter(status => status === 'expired').length;

                    if (expireCount === bannersResult.length) {
                        let updateBannerCampaignQuery = updateQuery('banner_campaigns', ['status'], 'id');
                        let updateBannerCampaignValues = ['expired', bannerResult[0].campaignId];
                        sqlConnection.query(updateBannerCampaignQuery, updateBannerCampaignValues, (updateCampaignError, updateCampaignValues) => {
                            if (updateCampaignError) return console.log(updateCampaignError);

                            return console.log('Banner removed successfully');
                        });
                    } else return console.log('Banner removed successfully');
                });
            });
        });
    } catch (error) { console.log(error) }
};

const removeExpiredTimeBanners = () => {
    try {
        const findExpiredBannersQuery = `
            SELECT * FROM banners
            WHERE status <> 'expired' AND category = 'awareness' AND timeLimit < CURRENT_DATE
        `;
        sqlConnection.query(findExpiredBannersQuery, (findExpiredBannersError, findExpiredBannersResult) => {
            if (findExpiredBannersError) return console.log(findExpiredBannersError);

            const expiredBanners = findExpiredBannersResult;

            let expiredBannersPromise = expiredBanners && expiredBanners.map((expiredBanner) => removeBanner(expiredBanner.id));

            Promise.all(expiredBannersPromise)
                .then(() => console.log('Expired banners removed successfully'))
                .catch(error => console.log(error));
        });
    } catch (error) { console.log(error) }
};

const removeExpiredImpressionBanner = (bannerId) => {
    try {
        sqlConnection.query(selectQuery('*', 'banner_users', 'bannerId'), [bannerId], (selectBannerUsersError, selectBannerUsersResult) => {
            if (selectBannerUsersError) return console.log(selectBannerUsersError);

            let bannerUsers = selectBannerUsersResult;

            sqlConnection.query(selectQuery('*', 'banners', 'id'), [bannerId], (bannerError, bannerResult) => {
                if (bannerError) return console.log(bannerError);

                const banner = bannerResult[0];

                const impressions = bannerUsers.reduce((sum, bannerUser) => sum + bannerUser.impressions, 0);
                const maleImpressions = bannerUsers.reduce((sum, bannerUser) => sum + bannerUser.maleImpressions, 0);
                const femaleImpressions = bannerUsers.reduce((sum, bannerUser) => sum + bannerUser.femaleImpressions, 0);
                const sovImpressions = (impressions * 100) / banner.impressionsLimit;

                if (banner.category === 'target') {
                    if (impressions >= banner.impressionsLimit) removeBanner(bannerId);
                    else return console.log('User interacted successfully');
                } else if (banner.category === 'awareness') {
                    if (banner.shareOfVoice && banner.shareOfVoice != null && sovImpressions >= banner.shareOfVoice) removeBanner(bannerId);
                    else if (banner.reachNumber !== null && banner.reachGender !== null && impressions > 5) {
                        let reachPercentage;
                        if (banner.reachGender.includes('male')) {
                            reachPercentage = (maleImpressions * 100) / impressions;
                            if (reachPercentage >= banner.reachNumber) removeBanner(bannerId);
                        }

                        if (banner.reachGender.includes('female')) {
                            reachPercentage = (femaleImpressions * 100) / impressions;
                            if (reachPercentage >= banner.reachNumber) removeBanner(bannerId);
                        }

                        else return console.log('User interacted successfully');
                    } else return console.log('User interacted successfully');
                }
            });
        });
    } catch (error) { console.log(error) }
};

module.exports = {
    ...queries,
    getCountActiveUsersQuery,
    getImpressionsBetweenDatesQuery,
    getBannersBetweenDatesQuery,
    getCampaignImpressionsBetweenDatesQuery,
    getGraphResponse,
    removeBanner,
    removeExpiredTimeBanners,
    removeExpiredImpressionBanner,
};