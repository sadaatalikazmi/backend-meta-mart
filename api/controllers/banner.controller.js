'use strict';

const moment = require("moment");
const stripe = require('stripe')(process?.env?.STRIPE_SECRET_KEY);
const { sendResponse, errReturned } = require('../../config/dto');
const { SUCCESS, BADREQUEST } = require('../../config/ResponseCodes');
const { basicAdAmount, bannerSlotTypes } = require('../../config/environment/const');
const sqlConnection = require("../../config/sqlConnection");
const { insertQuery, selectQuery, updateQuery, deleteQuery, sendEmail, formatWord, sendFirebaseNotification } = require('../../utils/helper');
const { getRamadanDates } = require('../../utils/bannerSlot.helper');
const {
    selectBannerLocationsQuery,
    insertBannerUserQuery,
    getOsDeviceBetweenDatesQuery,
    getCampaignBannersQuery,
    getUserCampaignsQuery,
    getUserDraftCampaignsQuery,
    getUnreadNotificationsQuery,
    getAllCampaignsQuery,
    getUserNotificationsQuery,
    getCamgaignNotificationQuery,
    getCountActiveUsersQuery,
    getImpressionsBetweenDatesQuery,
    getBannersBetweenDatesQuery,
    getCampaignImpressionsBetweenDatesQuery,
    getGraphResponse,
    removeExpiredTimeBanners,
    removeExpiredImpressionBanner,
} = require('../../utils/banner.helper');



// Draft Ad Campaign //
exports.draftAdCampaign = async (req, res) => {
    try {
        let userId = req.user.id;
        let data = {};

        Object.keys(req.body).map(key => {
            if (req.body[key] == '' || req.body[key] === 'undefined' || req.body[key] === 'null') data[key] = null;
            else data[key] = req.body[key];

            return data;
        });

        let {
            draftType, campaignId, advertisementName, category, type, bannerSlotId,
            location, gender, fromAge, toAge, productCategory,
            os, device, fromHour, toHour, dayOfWeek,
            frequencyCap, shareOfVoice, reachNumber, reachGender, lifeEvent, timeLimit,
        } = data;
        let slotTypes, slotIds, status;

        let required = ['draftType', 'advertisementName', 'category', 'type', 'bannerSlotId'];
        if (draftType === 'existing') required.push('campaignId');
        for (let key of required) {
            if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null) return sendResponse(res, BADREQUEST, `Please provide ${key}`, []);
        }

        slotTypes = type.split(',');
        slotIds = bannerSlotId.split(',').map(Number);

        if ((fromAge && toAge) && (Number(fromAge) > Number(toAge))) return sendResponse(res, BADREQUEST, 'Lower age limit must be less than or equal to upper age limit', []);
        if ((fromAge && toAge) && (Number(fromAge) < 0 || Number(toAge) < 0)) return sendResponse(res, BADREQUEST, 'Age must be greater than 0', []);
        if ((fromHour && toHour) && (Number(fromHour) > Number(toHour))) return sendResponse(res, BADREQUEST, 'Lower time limit must be less than or equal to upper time limit', []);
        if (timeLimit && (new Date(timeLimit)) <= (new Date())) return sendResponse(res, BADREQUEST, 'Time limit must be greater than today', []);

        timeLimit = (category === 'awareness' && lifeEvent === null && timeLimit) ? (new Date(timeLimit)) : null;
        status = 'draft';

        let bannerSlotsPromise;

        if (draftType === 'existing') {
            sqlConnection.query(deleteQuery('banners', 'campaignId'), [campaignId], (deleteBannersError, deleteBannersResult) => {
                if (deleteBannersError) return errReturned(res, deleteBannersError);

                sqlConnection.query(deleteQuery('banner_campaigns', 'id'), [campaignId], (deleteCampaignError, deleteCampaignResult) => {
                    if (deleteCampaignError) return errReturned(res, deleteCampaignError);

                    bannerSlotsPromise = slotIds && slotIds.map(slotId => {
                        return new Promise((resolve, reject) => {
                            sqlConnection.query(selectQuery('*', 'banner_slots', 'id'), [slotId], (bannerSlotError, bannerSlotResult) => {
                                if (bannerSlotError) reject(bannerSlotError);
                                if (!bannerSlotResult || bannerSlotResult.length <= 0) reject('Banner slot not found');

                                resolve();
                            });
                        });
                    });
                });
            });
        } else {
            bannerSlotsPromise = slotIds && slotIds.map(slotId => {
                return new Promise((resolve, reject) => {
                    sqlConnection.query(selectQuery('*', 'banner_slots', 'id'), [slotId], (bannerSlotError, bannerSlotResult) => {
                        if (bannerSlotError) reject(bannerSlotError);
                        if (!bannerSlotResult || bannerSlotResult.length <= 0) reject('Banner slot not found');

                        resolve();
                    });
                });
            });
        }

        setTimeout(() => {
            Promise.all(bannerSlotsPromise)
                .then(() => {
                    const insertBannerCampaignQuery = insertQuery('banner_campaigns', ['userId', 'adName', 'category', 'status']);
                    const insertBannerValues = [userId, advertisementName, category, status];
                    sqlConnection.query(insertBannerCampaignQuery, insertBannerValues, (insertBannerCampaignError, insertBannerCampaignResult) => {
                        if (insertBannerCampaignError) return errReturned(res, insertBannerCampaignError);

                        let insertBannerPromise = slotIds && slotIds.map(slotId => {
                            return new Promise((resolve, reject) => {
                                sqlConnection.query(selectQuery('*', 'banner_slots', 'id'), [slotId], (bannerSlotError, bannerSlotResult) => {
                                    if (bannerSlotError) reject(bannerSlotError);

                                    let bannerSlot = bannerSlotResult[0];
                                    if (!bannerSlot) reject('Banner slot not found');

                                    const insertBannerQuery = insertQuery(
                                        'banners',
                                        [
                                            'adName', 'userId', 'campaignId', 'bannerSlotId', 'category', 'type', 'status',
                                            'location', 'gender', 'fromAge', 'toAge', 'productCategory',
                                            'device', 'os', 'fromHour', 'toHour', 'dayOfWeek',
                                            'frequencyCap', 'shareOfVoice', 'reachNumber', 'reachGender', 'lifeEvent', 'timeLimit'
                                        ]
                                    );
                                    const insertBannerValues = [
                                        advertisementName, userId, insertBannerCampaignResult.insertId, slotId, category, bannerSlot.type, status,
                                        location, gender, fromAge, toAge, productCategory,
                                        device, os, fromHour, toHour, dayOfWeek,
                                        frequencyCap, shareOfVoice, reachNumber, reachGender, lifeEvent, timeLimit
                                    ];
                                    sqlConnection.query(insertBannerQuery, insertBannerValues, (insertBannerError, insertBannerResult) => {
                                        if (insertBannerError) reject(insertBannerError);

                                        sqlConnection.query(selectQuery('*', 'banners', 'id'), [insertBannerResult.insertId], (bannerError, bannerResult) => {
                                            if (bannerError) reject(bannerError);

                                            resolve();
                                        });
                                    });
                                });
                            });
                        });

                        Promise.all(insertBannerPromise)
                            .then(() => {
                                sqlConnection.query(selectQuery('*', 'banner_campaigns', 'id'), [insertBannerCampaignResult.insertId], (bannerCampaignError, bannerCampaignResult) => {
                                    if (bannerCampaignError) return errReturned(res, bannerCampaignError);

                                    return sendResponse(res, SUCCESS, 'Campaign drafted successfully', bannerCampaignResult[0])
                                });
                            })
                            .catch(error => errReturned(res, error));
                    });
                })
                .catch(error => errReturned(res, error));
        }, 1000);
    } catch (error) { errReturned(res, error) }
};


// Get Banner Metrics //
exports.getBannerMetrics = async (req, res) => {
    try {
        let data = {};

        Object.keys(req.body).map(key => {
            if (req.body[key] == '' || req.body[key] === 'undefined' || req.body[key] === 'null') data[key] = null;
            else data[key] = req.body[key];

            return data;
        });

        let { category, bannerSlotId, gender, fromAge, toAge, fromHour, toHour, lifeEvent, timeLimit } = data;
        let impressionsLimit, fieldsAmount, amount, numberOfFields = 0;

        let required = ['advertisementName', 'category', 'type', 'bannerSlotId'];
        for (let key of required) {
            if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null) return sendResponse(res, BADREQUEST, `Please provide ${key}`, []);
        }

        if (category === 'awareness' && lifeEvent === null && timeLimit === null) return sendResponse(res, BADREQUEST, 'Please provide life event or ending time', []);
        if (fromAge && toAge && fromAge > toAge) return sendResponse(res, BADREQUEST, 'Lower age limit must be less than or equal to upper age limit');
        if (fromAge && toAge && (fromAge < 0 || toAge < 0)) return sendResponse(res, BADREQUEST, 'Age must be greater than 0');
        if (fromHour && toHour && fromHour > toHour) return sendResponse(res, BADREQUEST, 'Lower time limit must be less than or equal to upper time limit');
        if (timeLimit && (new Date(timeLimit)) <= (new Date())) return sendResponse(res, BADREQUEST, 'Time limit must be greater than today');

        numberOfFields += (bannerSlotId.split(',').length - 1);
        fieldsAmount = numberOfFields * 5;

        sqlConnection.query(getCountActiveUsersQuery(gender), (activeUsersCountError, activeUsersCountResult) => {
            if (activeUsersCountError) return errReturned(res, activeUsersCountError);

            impressionsLimit = activeUsersCountResult[0]?.activeUsersCount > 2 ? (activeUsersCountResult[0]?.activeUsersCount * 100) : 200;
            amount = (((impressionsLimit / 1000) * basicAdAmount) + fieldsAmount).toFixed(2);

            return sendResponse(res, SUCCESS, 'Campaign Metrics', { amount, impressionsLimit });
        });
    } catch (error) { errReturned(res, error) }
};


// Create Banner //
exports.createBanner = async (req, res) => {
    try {
        let userId = req.user.id;
        let { rackFile, tableFile, roofFile, checkoutFile, fridgeFile, wallFile } = req.files;
        let data = {};

        Object.keys(req.body).map(key => {
            if (req.body[key] == '' || req.body[key] === 'undefined' || req.body[key] === 'null') data[key] = null;
            else data[key] = req.body[key];

            return data;
        });

        let {
            campaignId, advertisementName, category, type, bannerSlotId, amount,
            location, gender, fromAge, toAge, productCategory,
            os, device, fromHour, toHour, dayOfWeek, impressionsLimit,
            frequencyCap, shareOfVoice, reachNumber, reachGender, lifeEvent, timeLimit,
        } = data;
        let slotTypes, slotIds, size, bannerUrl, bannerFormat, status;

        let required = ['campaignId', 'advertisementName', 'category', 'type', 'bannerSlotId'];
        for (let key of required) {
            if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null) return sendResponse(res, BADREQUEST, `Please provide ${key}`, []);
        }

        slotTypes = type.split(',');
        slotIds = bannerSlotId.split(',').map(Number);

        if (category === 'awareness' && lifeEvent === null && timeLimit === null) return sendResponse(res, BADREQUEST, 'Please provide life event or ending time', []);
        if ((fromAge && toAge) && (Number(fromAge) > Number(toAge))) return sendResponse(res, BADREQUEST, 'Lower age limit must be less than or equal to upper age limit', []);
        if ((fromAge && toAge) && (Number(fromAge) < 0 || Number(toAge) < 0)) return sendResponse(res, BADREQUEST, 'Age must be greater than 0', []);
        if ((fromHour && toHour) && (Number(fromHour) > Number(toHour))) return sendResponse(res, BADREQUEST, 'Lower time limit must be less than or equal to upper time limit', []);
        if (impressionsLimit && (Number(impressionsLimit) < 200)) return sendResponse(res, BADREQUEST, 'Impressions limit must be at least 200', []);
        if (timeLimit && (new Date(timeLimit)) <= (new Date())) return sendResponse(res, BADREQUEST, 'Time limit must be greater than today', []);
        if (slotTypes.includes('rack') && !rackFile) return sendResponse(res, BADREQUEST, 'Please provide image for rack ad', []);
        if (slotTypes.includes('table') && !tableFile) return sendResponse(res, BADREQUEST, 'Please provide image for table ad', []);
        if (slotTypes.includes('roof') && !roofFile) return sendResponse(res, BADREQUEST, 'Please provide image for roof ad', []);
        if (slotTypes.includes('checkout') && !checkoutFile) return sendResponse(res, BADREQUEST, 'Please provide image for checkout ad', []);
        if (slotTypes.includes('fridge') && !fridgeFile) return sendResponse(res, BADREQUEST, 'Please provide image for fridge ad', []);
        if (slotTypes.includes('wall') && !wallFile) return sendResponse(res, BADREQUEST, 'Please provide image for wall ad', []);

        timeLimit = (category === 'awareness' && lifeEvent === null && timeLimit) ? (new Date(timeLimit)) : null;
        status = 'active';

        let bannerSlotsPromise;

        sqlConnection.query(deleteQuery('banners', 'campaignId'), [campaignId], (deleteBannersError, deleteBannersResult) => {
            if (deleteBannersError) return errReturned(res, deleteBannersError);

            sqlConnection.query(deleteQuery('banner_campaigns', 'id'), [campaignId], (deleteCampaignError, deleteCampaignResult) => {
                if (deleteCampaignError) return errReturned(res, deleteCampaignError);

                bannerSlotsPromise = slotIds && slotIds.map(slotId => {
                    return new Promise((resolve, reject) => {
                        sqlConnection.query(selectQuery('*', 'banner_slots', 'id'), [slotId], (bannerSlotError, bannerSlotResult) => {
                            if (bannerSlotError) reject(bannerSlotError);
                            if (!bannerSlotResult || bannerSlotResult.length <= 0) reject('Banner slot not found');

                            resolve();
                        });
                    });
                });
            });
        });

        setTimeout(() => {
            Promise.all(bannerSlotsPromise)
                .then(() => {
                    const insertBannerCampaignQuery = insertQuery('banner_campaigns', ['userId', 'adName', 'category', 'amount', 'remainingAmount', 'status']);
                    const insertBannerValues = [userId, advertisementName, category, amount, amount, status];
                    sqlConnection.query(insertBannerCampaignQuery, insertBannerValues, (insertBannerCampaignError, insertBannerCampaignResult) => {
                        if (insertBannerCampaignError) return errReturned(res, insertBannerCampaignError);

                        let insertBannerPromise = slotIds && slotIds.map(slotId => {
                            return new Promise((resolve, reject) => {
                                sqlConnection.query(selectQuery('*', 'banner_slots', 'id'), [slotId], (bannerSlotError, bannerSlotResult) => {
                                    if (bannerSlotError) reject(bannerSlotError);

                                    let bannerSlot = bannerSlotResult[0];
                                    if (!bannerSlot) reject('Banner slot not found');

                                    sqlConnection.query(getCountActiveUsersQuery(gender), (activeUsersCountError, activeUsersCountResult) => {
                                        if (activeUsersCountError) reject(activeUsersCountError);

                                        if (bannerSlot.type === 'rack') bannerUrl = rackFile && rackFile[0].location;
                                        else if (bannerSlot.type === 'table') bannerUrl = tableFile && tableFile[0].location;
                                        else if (bannerSlot.type === 'roof') bannerUrl = roofFile && roofFile[0].location;
                                        else if (bannerSlot.type === 'checkout') bannerUrl = checkoutFile && checkoutFile[0].location;
                                        else if (bannerSlot.type === 'fridge') bannerUrl = fridgeFile && fridgeFile[0].location;
                                        else if (bannerSlot.type === 'wall') bannerUrl = wallFile && wallFile[0].location;

                                        bannerFormat = bannerUrl?.split('.')[bannerUrl?.split('.')?.length - 1];

                                        if (bannerSlot.type === 'rack' || bannerSlot.type === 'table' || bannerSlot.type === 'roof' || bannerSlot.type === 'fridge') size = 1;
                                        else if (bannerSlot.type === 'checkout') size = 2;
                                        else if (bannerSlot.type === 'wall') size = 3;

                                        const insertBannerQuery = insertQuery(
                                            'banners',
                                            [
                                                'adName', 'userId', 'campaignId', 'bannerSlotId', 'category', 'type', 'amount', 'size', 'bannerUrl', 'bannerFormat', 'status',
                                                'location', 'gender', 'fromAge', 'toAge', 'productCategory',
                                                'device', 'os', 'fromHour', 'toHour', 'dayOfWeek', 'impressionsLimit',
                                                'frequencyCap', 'shareOfVoice', 'reachNumber', 'reachGender', 'lifeEvent', 'timeLimit'
                                            ]
                                        );
                                        const insertBannerValues = [
                                            advertisementName, userId, insertBannerCampaignResult.insertId, slotId, category, bannerSlot.type, amount, size, bannerUrl, bannerFormat, status,
                                            location, gender, fromAge, toAge, productCategory,
                                            device, os, fromHour, toHour, dayOfWeek, impressionsLimit,
                                            frequencyCap, shareOfVoice, reachNumber, reachGender, lifeEvent, timeLimit
                                        ];
                                        sqlConnection.query(insertBannerQuery, insertBannerValues, (insertBannerError, insertBannerResult) => {
                                            if (insertBannerError) reject(insertBannerError);

                                            sqlConnection.query(selectQuery('*', 'banners', 'id'), [insertBannerResult.insertId], (bannerError, bannerResult) => {
                                                if (bannerError) reject(bannerError);

                                                resolve();
                                            });
                                        });
                                    });
                                });
                            });
                        });

                        Promise.all(insertBannerPromise)
                            .then(() => {
                                sqlConnection.query(selectQuery('*', 'banner_campaigns', 'id'), [insertBannerCampaignResult.insertId], (bannerCampaignError, bannerCampaignResult) => {
                                    if (bannerCampaignError) return errReturned(res, bannerCampaignError);

                                    return sendResponse(res, SUCCESS, 'Campaign created successfully', bannerCampaignResult[0])
                                });
                            })
                            .catch(error => errReturned(res, error));
                    });
                })
                .catch(error => errReturned(res, error));
        }, 3000);
    } catch (error) { errReturned(res, error) }
};


// Get Edited Banner Metrics //
exports.getEditedBannerMetrics = async (req, res) => {
    try {
        let data = {};

        Object.keys(req.body).map(key => {
            if (req.body[key] == '' || req.body[key] === 'undefined' || req.body[key] === 'null') data[key] = null;
            else data[key] = req.body[key];

            return data;
        });

        let { campaignId, category, bannerSlotId, gender, fromAge, toAge, fromHour, toHour, lifeEvent, timeLimit } = data;
        let impressionsLimit, previousAmount, fieldsAmount, amount, remainingAmount, isPaid, numberOfFields = 0;

        let required = ['campaignId', 'advertisementName', 'category', 'type', 'bannerSlotId'];
        for (let key of required) {
            if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null) return sendResponse(res, BADREQUEST, `Please provide ${key}`, []);
        }

        if (category === 'awareness' && lifeEvent === null && timeLimit === null) return sendResponse(res, BADREQUEST, 'Please provide life event or ending time', []);
        if ((fromAge && toAge) && (Number(fromAge) > Number(toAge))) return sendResponse(res, BADREQUEST, 'Lower age limit must be less than or equal to upper age limit', []);
        if ((fromAge && toAge) && (Number(fromAge) < 0 || Number(toAge) < 0)) return sendResponse(res, BADREQUEST, 'Age must be greater than 0', []);
        if ((fromHour && toHour) && (Number(fromHour) > Number(toHour))) return sendResponse(res, BADREQUEST, 'Lower time limit must be less than or equal to upper time limit', []);
        if (timeLimit && (new Date(timeLimit)) <= (new Date())) return sendResponse(res, BADREQUEST, 'Time limit must be greater than today', []);

        numberOfFields += (bannerSlotId.split(',').length - 1);
        fieldsAmount = numberOfFields * 5;

        sqlConnection.query(selectQuery('*', 'banner_campaigns', 'id'), [campaignId], (campaignError, campaignResult) => {
            if (campaignError) return errReturned(res, campaignError);

            let bannerCampaign = campaignResult[0];

            if (!bannerCampaign) return sendResponse(res, BADREQUEST, 'Campaign not found', []);

            sqlConnection.query(getCountActiveUsersQuery(gender), (activeUsersCountError, activeUsersCountResult) => {
                if (activeUsersCountError) reject(activeUsersCountError);

                impressionsLimit = activeUsersCountResult[0]?.activeUsersCount > 2 ? (activeUsersCountResult[0]?.activeUsersCount * 100) : 200;
                amount = Number((((impressionsLimit / 1000) * basicAdAmount) + fieldsAmount).toFixed(2));

                if (bannerCampaign?.amount >= amount) {
                    previousAmount = bannerCampaign?.isPaid === 1 ? Number(bannerCampaign?.amount) : 0;
                    remainingAmount = bannerCampaign?.isPaid === 1 ? Number((amount - bannerCampaign?.amount).toFixed(2)) : Number(amount.toFixed(2));
                    isPaid = bannerCampaign?.isPaid;
                } else {
                    previousAmount = Number(bannerCampaign?.amount);
                    remainingAmount = Number((amount - bannerCampaign?.amount).toFixed(2));
                    isPaid = 0;
                }

                return sendResponse(res, SUCCESS, 'Edited Campaign Metrics', { previousAmount, amount, remainingAmount, impressionsLimit });
            });
        });
    } catch (error) { errReturned(res, error) }
};


// Edit Banner //
exports.editBanner = async (req, res) => {
    try {
        let userId = req.user.id;
        let { rackFile, tableFile, roofFile, checkoutFile, fridgeFile, wallFile } = req.files;
        let data = {};

        Object.keys(req.body).map(key => {
            if (req.body[key] == '' || req.body[key] === 'undefined' || req.body[key] === 'null') data[key] = null;
            else data[key] = req.body[key];

            return data;
        });

        let {
            campaignId, advertisementName, category, type, bannerSlotId, amount,
            location, gender, fromAge, toAge, productCategory,
            os, device, fromHour, toHour, dayOfWeek, impressionsLimit,
            frequencyCap, shareOfVoice, reachNumber, reachGender, lifeEvent, timeLimit
        } = data;
        let slotTypes, slotIds, newSlotIds, size, bannerUrl, bannerFormat, previousAmount, remainingAmount, isPaid, numberOfFields, status;

        let required = ['campaignId', 'advertisementName', 'category', 'type', 'bannerSlotId'];
        for (let key of required) {
            if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null)
                return sendResponse(res, BADREQUEST, `Please provide ${key}`, []);
        }

        slotTypes = type.split(',');
        slotIds = bannerSlotId.split(',').map(Number);
        newSlotIds = slotIds;

        if (category === 'awareness' && lifeEvent === null && timeLimit === null) return sendResponse(res, BADREQUEST, 'Please provide life event or ending time', []);
        if ((fromAge && toAge) && (Number(fromAge) > Number(toAge))) return sendResponse(res, BADREQUEST, 'Lower age limit must be less than or equal to upper age limit', []);
        if ((fromAge && toAge) && (Number(fromAge) < 0 || Number(toAge) < 0)) return sendResponse(res, BADREQUEST, 'Age must be greater than 0', []);
        if ((fromHour && toHour) && (Number(fromHour) > Number(toHour))) return sendResponse(res, BADREQUEST, 'Lower time limit must be less than or equal to upper time limit', []);
        if (impressionsLimit && (Number(impressionsLimit) < 200)) return sendResponse(res, BADREQUEST, 'Impressions limit must be at least 200', []);
        if (amount && (Number(amount) > 0) && (Number(amount) < 0.5)) return sendResponse(res, BADREQUEST, 'Amount must be at least $ 0.5', []);
        if (timeLimit && (new Date(timeLimit)) <= (new Date())) return sendResponse(res, BADREQUEST, 'Time limit must be greater than today', []);
        if (slotTypes.includes('rack') && !rackFile && !data.rackFile) return sendResponse(res, BADREQUEST, 'Please provide image for rack ad', []);
        if (slotTypes.includes('table') && !tableFile && !data.tableFile) return sendResponse(res, BADREQUEST, 'Please provide image for table ad', []);
        if (slotTypes.includes('roof') && !roofFile && !data.roofFile) return sendResponse(res, BADREQUEST, 'Please provide image for roof ad', []);
        if (slotTypes.includes('checkout') && !checkoutFile && !data.checkoutFile) return sendResponse(res, BADREQUEST, 'Please provide image for checkout ad', []);
        if (slotTypes.includes('fridge') && !fridgeFile && !data.fridgeFile) return sendResponse(res, BADREQUEST, 'Please provide image for fridge ad', []);
        if (slotTypes.includes('wall') && !wallFile && !data.wallFile) return sendResponse(res, BADREQUEST, 'Please provide image for wall ad', []);

        // numberOfFields = Object.values(data).filter(value => value !== null).length - 1;
        // numberOfFields += ((type.split(',').length) - 1) + ((bannerSlotId.split(',').length) - 1);
        // numberOfFields += productCategory ? ((productCategory.split(',').length) - 1) : 0;
        // numberOfFields += location ? ((location.split(',').length) - 1) : 0;
        // numberOfFields += os ? ((os.split(',').length) - 1) : 0;
        // numberOfFields += device ? ((device.split(',').length) - 1) : 0;
        // numberOfFields += gender ? ((gender.split(',').length) - 1) : 0;
        // numberOfFields += reachGender ? ((reachGender.split(',').length) - 1) : 0;
        // numberOfFields += dayOfWeek ? ((dayOfWeek.split(',').length) - 1) : 0;

        // if (data.rackFile) numberOfFields -= 1;
        // if (data.tableFile) numberOfFields -= 1;
        // if (data.roofFile) numberOfFields -= 1;
        // if (data.checkoutFile) numberOfFields -= 1;
        // if (data.fridgeFile) numberOfFields -= 1;
        // if (data.wallFile) numberOfFields -= 1;

        timeLimit = (category === 'awareness' && lifeEvent === null) ? new Date(timeLimit) : null;
        // amount = numberOfFields > 4 ? (basicAdAmount + ((numberOfFields - 4) * 100)) : basicAdAmount;

        sqlConnection.query(selectQuery('*', 'banner_campaigns', 'id'), [campaignId], (campaignError, campaignResult) => {
            if (campaignError) return errReturned(res, campaignError);

            let bannerCampaign = campaignResult[0];

            if (!bannerCampaign) return sendResponse(res, BADREQUEST, 'Campaign not found', []);

            status = (bannerCampaign?.status !== 'suspended' && Number(amount) <= 0)
                ? bannerCampaign?.status
                : (bannerCampaign?.status === 'suspended' && Number(amount) <= 0)
                    ? 'pending'
                    : (Number(amount) > 0)
                        ? 'active'
                        : bannerCampaign?.status;

            if (Number(amount) > 0) {
                previousAmount = bannerCampaign?.amount;
                remainingAmount = bannerCampaign.status === 'active' ? (Number(amount) + Number(bannerCampaign?.amount)) : Number(amount);
                amount = Number(bannerCampaign?.amount) + Number(amount);
                isPaid = 0;
            } else {
                previousAmount = bannerCampaign?.amount;
                remainingAmount = bannerCampaign.status === 'active' ? bannerCampaign?.amount : Number(amount);
                amount = previousAmount - Math.abs(Number(amount));
                isPaid = bannerCampaign?.isPaid;
            }

            sqlConnection.query(selectQuery('*', 'banners', 'campaignId'), [campaignId], (campaignBannersError, campaignBannersResult) => {
                if (campaignBannersError) return errReturned(res, campaignBannersError);
                if (campaignBannersResult.length <= 0) return sendResponse(res, BADREQUEST, 'Ads not found for this campaign', []);

                let existingBannersPromise = campaignBannersResult && campaignBannersResult.map(banner => {
                    return new Promise((resolve, reject) => {
                        sqlConnection.query(selectQuery('*', 'banner_slots', 'id'), [banner.bannerSlotId], (bannerSlotError, bannerSlotResult) => {
                            if (bannerSlotError) reject(bannerSlotError);

                            let bannerSlot = bannerSlotResult[0];

                            if (!bannerSlot) reject(`Banner slot not found`);

                            if (slotIds.includes(bannerSlot.id)) {
                                newSlotIds = newSlotIds.filter(slotId => slotId !== bannerSlot.id);

                                if (bannerSlot.type === 'rack') bannerUrl = rackFile ? rackFile[0].location : data.rackFile;
                                else if (bannerSlot.type === 'table') bannerUrl = tableFile ? tableFile[0].location : data.tableFile;
                                else if (bannerSlot.type === 'roof') bannerUrl = roofFile ? roofFile[0].location : data.roofFile;
                                else if (bannerSlot.type === 'checkout') bannerUrl = checkoutFile ? checkoutFile[0].location : data.checkoutFile;
                                else if (bannerSlot.type === 'fridge') bannerUrl = fridgeFile ? fridgeFile[0].location : data.fridgeFile;
                                else if (bannerSlot.type === 'wall') bannerUrl = wallFile ? wallFile[0].location : data.wallFile;

                                bannerFormat = bannerUrl?.split('.')[bannerUrl?.split('.')?.length - 1];

                                if (bannerSlot.type === 'rack' || bannerSlot.type === 'table' || bannerSlot.type === 'roof' || bannerSlot.type === 'fridge') size = 1;
                                else if (bannerSlot.type === 'checkout') size = 2;
                                else if (bannerSlot.type === 'wall') size = 3;

                                let editBannerQuery = updateQuery(
                                    'banners',
                                    [
                                        'adName', 'category', 'type', 'amount', 'isPaid', 'size', 'bannerUrl', 'bannerFormat', 'status',
                                        'location', 'gender', 'fromAge', 'toAge', 'productCategory',
                                        'device', 'os', 'fromHour', 'toHour', 'dayOfWeek', 'impressionsLimit',
                                        'frequencyCap', 'shareOfVoice', 'reachNumber', 'reachGender', 'lifeEvent', 'timeLimit'
                                    ],
                                    'id'
                                );
                                let editBannerValues = [
                                    advertisementName, category, bannerSlot.type, amount, isPaid, size, bannerUrl, bannerFormat, status,
                                    location, gender, fromAge, toAge, productCategory,
                                    device, os, fromHour, toHour, dayOfWeek, impressionsLimit,
                                    frequencyCap, shareOfVoice, reachNumber, reachGender, lifeEvent, timeLimit, banner.id
                                ];
                                sqlConnection.query(editBannerQuery, editBannerValues, (editBannerError, editBannerResult) => {
                                    if (editBannerError) reject(editBannerError);

                                    resolve();
                                });
                            } else {
                                sqlConnection.query(deleteQuery('banner_users', 'bannerId'), [banner.id], (deleteBannerUserError, deleteBannerUserResult) => {
                                    if (deleteBannerUserError) reject(deleteBannerUserError);

                                    sqlConnection.query(deleteQuery('banners', 'id'), [banner.id], (deleteBannerError, deleteBannerResult) => {
                                        if (deleteBannerError) reject(deleteBannerError);
                                        if (deleteBannerResult.affectedRows === 0) reject('Failed to delete the banner');

                                        resolve();
                                    });
                                });
                            }
                        });
                    });
                });

                Promise.all(existingBannersPromise)
                    .then(() => {
                        let insertBannersPromise = newSlotIds && newSlotIds.map(slotId => {
                            return new Promise((resolve, reject) => {
                                sqlConnection.query(selectQuery('*', 'banner_slots', 'id'), [slotId], (bannerSlotError, bannerSlotResult) => {
                                    if (bannerSlotError) reject(bannerSlotError);
                                    if (!bannerSlotResult || bannerSlotResult.length <= 0) reject('Banner slot not found');

                                    let bannerSlot = bannerSlotResult[0];

                                    if (!bannerSlot) reject('Banner slot not found');

                                    if (bannerSlot.type === 'rack') bannerUrl = rackFile ? rackFile[0].location : data.rackFile;
                                    else if (bannerSlot.type === 'table') bannerUrl = tableFile ? tableFile[0].location : data.tableFile;
                                    else if (bannerSlot.type === 'roof') bannerUrl = roofFile ? roofFile[0].location : data.roofFile;
                                    else if (bannerSlot.type === 'checkout') bannerUrl = checkoutFile ? checkoutFile[0].location : data.checkoutFile;
                                    else if (bannerSlot.type === 'fridge') bannerUrl = fridgeFile ? fridgeFile[0].location : data.fridgeFile;
                                    else if (bannerSlot.type === 'wall') bannerUrl = wallFile ? wallFile[0].location : data.wallFile;

                                    bannerFormat = bannerUrl?.split('.')[bannerUrl?.split('.')?.length - 1];

                                    if (bannerSlot.type === 'rack' || bannerSlot.type === 'table' || bannerSlot.type === 'roof' || bannerSlot.type === 'fridge') size = 1;
                                    else if (bannerSlot.type === 'checkout') size = 2;
                                    else if (bannerSlot.type === 'wall') size = 3;

                                    const insertBannerQuery = insertQuery(
                                        'banners',
                                        [
                                            'adName', 'userId', 'campaignId', 'bannerSlotId', 'category', 'type', 'amount', 'size', 'bannerUrl', 'bannerFormat', 'status',
                                            'location', 'gender', 'fromAge', 'toAge', 'productCategory',
                                            'device', 'os', 'fromHour', 'toHour', 'dayOfWeek', 'impressionsLimit',
                                            'frequencyCap', 'shareOfVoice', 'reachNumber', 'reachGender', 'lifeEvent', 'timeLimit'
                                        ]
                                    );
                                    const insertBannerValues = [
                                        advertisementName, userId, campaignId, slotId, category, bannerSlot.type, Math.abs(amount), size, bannerUrl, bannerFormat, status,
                                        location, gender, fromAge, toAge, productCategory,
                                        device, os, fromHour, toHour, dayOfWeek, impressionsLimit,
                                        frequencyCap, shareOfVoice, reachNumber, reachGender, lifeEvent, timeLimit
                                    ];
                                    sqlConnection.query(insertBannerQuery, insertBannerValues, (insertBannerError, insertBannerResult) => {
                                        if (insertBannerError) reject(insertBannerError);

                                        resolve();
                                    });
                                });
                            });
                        });

                        Promise.all(insertBannersPromise)
                            .then(() => {
                                const updateBannerCampaignQuery = updateQuery(
                                    'banner_campaigns',
                                    ['adName', 'category', 'previousAmount', 'amount', 'remainingAmount', 'isPaid', 'status'],
                                    'id'
                                );
                                const updateBannerCampaignValues = [advertisementName, category, previousAmount, amount, remainingAmount, isPaid, status, campaignId];
                                sqlConnection.query(updateBannerCampaignQuery, updateBannerCampaignValues, async (updateBannerCampaignError, updateBannerCampaignQResult) => {
                                    if (updateBannerCampaignError) return errReturned(res, updateBannerCampaignError);

                                    sqlConnection.query(selectQuery('*', 'banner_campaigns', 'id'), [campaignId], (bannerCampaignError, bannerCampaignResult) => {
                                        if (bannerCampaignError) return errReturned(res, bannerCampaignError);

                                        return sendResponse(res, SUCCESS, 'Campaign edited successfully', bannerCampaignResult[0]);
                                    });
                                });
                            })
                            .catch(error => errReturned(res, error));
                    })
                    .catch(error => errReturned(res, error));
            });
        });
    } catch (error) { errReturned(res, error) }
};


// Create Payment Intent //
exports.createPaymentIntent = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id || id == '' || id == undefined || id == null) return sendResponse(res, BADREQUEST, `Please provide banner id`, []);

        sqlConnection.query(selectQuery('remainingAmount', 'banner_campaigns', 'id'), [id], async (bannerAmountError, bannerAmountResult) => {
            if (bannerAmountError) return errReturned(res, bannerAmountError);

            const bannerAmount = (Number(bannerAmountResult[0]?.remainingAmount) * 100);

            if (!bannerAmount) return sendResponse(res, BADREQUEST, 'Banner amount not found', []);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: bannerAmount,
                currency: 'usd'
            });

            const payment = {
                clientSecret: paymentIntent.client_secret,
                amount: paymentIntent.amount,
            };

            return sendResponse(res, SUCCESS, 'Payment intent created successfully', payment);
        });
    } catch (error) { errReturned(res, error) }
};


// Get Unread User Notifications //
exports.getUnreadNotifications = async (req, res) => {
    try {
        const userId = req.user.id;

        sqlConnection.query(getUnreadNotificationsQuery, [userId], (unreadNotificationsError, unreadNotificationsResult) => {
            if (unreadNotificationsError) return errReturned(res, unreadNotificationsError);

            return sendResponse(res, SUCCESS, 'Unread User Notifications', unreadNotificationsResult);
        });
    } catch (error) { errReturned(res, error) }
};


// Get User Notifications //
exports.getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;

        sqlConnection.query(getUserNotificationsQuery, [userId], (userNotificationsError, userNotificationsResult) => {
            if (userNotificationsError) return errReturned(res, userNotificationsError);

            return sendResponse(res, SUCCESS, 'User Notifications', userNotificationsResult);
        });
    } catch (error) { errReturned(res, error) }
};


// Get Banner Notification //
exports.getBannerNotification = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || id === undefined || id === null) return sendResponse(res, BADREQUEST, 'Please provide banner id');

        sqlConnection.query(getCamgaignNotificationQuery, [id], (bannerNotificationError, bannerNotificationResult) => {
            if (bannerNotificationError) return errReturned(res, bannerNotificationError);
            if (!bannerNotificationResult[0]) return sendResponse(res, BADREQUEST, 'Campaign notification not found', []);

            return sendResponse(res, SUCCESS, 'Campaign Notification', bannerNotificationResult[0]);
        });

    } catch (error) { errReturned(res, error) }
};


// Get Ramadan Dates //
exports.getDatesOfRamadan = async (req, res) => {
    try {
        return sendResponse(res, SUCCESS, 'Ramadan Dates', getRamadanDates());
    } catch (error) { errReturned(res, error) }
};


// Get Data Protection Contact //
exports.getDataProtectionContact = async (req, res) => {
    try {
        let userId = req.user.id;

        sqlConnection.query(selectQuery('*', 'data_protection_contacts', 'userId'), [userId], (dpcError, dpcResult) => {
            if (dpcError) return errReturned(res, dpcError);
            if (!dpcResult) return sendResponse(res, BADREQUEST, 'Data protection contact not found', []);

            return sendResponse(res, SUCCESS, 'Data Protection Contact', dpcResult[0]);
        })
    } catch (error) { errReturned(res, error) }
};


// Update Banner Payment //
exports.updateBannerPayment = async (req, res) => {
    try {
        let { campaignId, transactionId } = req.body;
        let data = req.body;

        let required = ['campaignId', 'transactionId'];
        for (let key of required) {
            if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null)
                return sendResponse(res, BADREQUEST, `Please provide ${key}`, []);
        }

        sqlConnection.query(selectQuery('*', 'banner_campaigns', 'id'), [campaignId], (checkCampaignError, checkCampaignResult) => {
            if (checkCampaignError) return errReturned(res, checkCampaignError);

            const campaign = checkCampaignResult[0];

            if (!campaign) return sendResponse(res, BADREQUEST, 'Campaign not found', []);

            sqlConnection.query(selectQuery('*', 'banners', 'campaignId'), [campaignId], (bannersError, bannersResult) => {
                if (bannersError) return errReturned(res, bannersError);
                if (!bannersResult || bannersResult.length <= 0) return sendResponse(res, BADREQUEST, 'Ads not found in this campaign', []);

                let updatePaymentPromise = bannersResult && bannersResult.map(banner => {
                    return new Promise((resolve, reject) => {
                        let updateBannerQuery = updateQuery('banners', ['isPaid', 'status'], 'id');
                        let updateBannerValues = [1, 'pending', banner.id];
                        sqlConnection.query(updateBannerQuery, updateBannerValues, (updateBannerError, updateBannerResult) => {
                            if (updateBannerError) reject(updateBannerError);

                            resolve();
                        });
                    });
                });

                Promise.all(updatePaymentPromise)
                    .then(() => {
                        let updateCampaignQuery = updateQuery('banner_campaigns', ['transactionId', 'remainingAmount', 'isPaid', 'status'], 'id');
                        let updateCampaignValues = [transactionId, 0, 1, 'pending', campaignId];
                        sqlConnection.query(updateCampaignQuery, updateCampaignValues, (updateCampaignError, updateCampaignResult) => {
                            if (updateCampaignError) return errReturned(res, updateCampaignError);

                            sqlConnection.query(selectQuery('*', 'banner_campaigns', 'id'), [campaignId], (campaignError, campaignResult) => {
                                if (campaignError) return errReturned(res, campaignError);

                                return sendResponse(res, SUCCESS, `Amount paid successfully`, campaignResult[0]);
                            });
                        });
                    })
                    .catch((error) => errReturned(res, error));
            });
        });
    } catch (error) { errReturned(res, error) }
};


// Get User Dashboard //
exports.getUserDashboard = async (req, res) => {
    try {
        let userId = req.user.id;
        let { startDate, endDate, campaigns } = req.body;
        let { impressionsBetweenDatesQuery, fromDate, toDate } = getImpressionsBetweenDatesQuery(startDate, endDate);
        let campaignIds;

        sqlConnection.query(selectQuery('*', 'banner_campaigns', 'userId'), [userId], (runCampaignsError, runCampaignsResult) => {
            if (runCampaignsError) return errReturned(res, runCampaignsError);
            if (!runCampaignsResult) return sendResponse(res, BADREQUEST, 'Run campaigns not found', []);

            let runCampaigns = runCampaignsResult?.map(campaign => campaign.id);

            if (campaigns === 'all' || campaigns === '' || !campaigns || campaigns === null || campaigns === undefined) campaignIds = runCampaigns.length > 0 ? runCampaigns : [1, 2];
            else campaignIds = campaigns.split(',');

            sqlConnection.query(impressionsBetweenDatesQuery, [userId, fromDate, toDate, campaignIds], (impressionsError, impressionsResult) => {
                if (impressionsError) return errReturned(res, impressionsError);

                sqlConnection.query(getOsDeviceBetweenDatesQuery, [userId, fromDate, toDate, campaignIds], (osDevicesError, osDeviceResult) => {
                    if (osDevicesError) return errReturned(res, osDevicesError);

                    const startDate = moment(fromDate);
                    const endDate = moment(toDate);

                    let dailyCostGraphLabels = [];
                    let dailyCostGraphData = [];

                    for (let date = startDate.clone(); date <= endDate; date.add(1, 'day')) {
                        const formattedDate = date.format('DD MMM YYYY');
                        const impressionsOnDate = impressionsResult.filter(impression => {
                            const impressionDate = moment(impression.createdAt);
                            return impressionDate.isSame(date, 'day');
                        });


                        let osDeviceCounts = impressionsOnDate.reduce((counts, item) => {
                            const { os, device } = item;

                            counts[os.toLowerCase()] = (counts[os.toLowerCase()] || 0) + 1;
                            counts[device.toLowerCase()] = (counts[device.toLowerCase()] || 0) + 1;

                            return counts;
                        }, {});

                        let osDeviceObj = {
                            android: ((osDeviceCounts?.android / 1000) * basicAdAmount) || 0,
                            vr: ((osDeviceCounts?.vr / 1000) * basicAdAmount) || 0,
                            oculus: ((osDeviceCounts?.oculus / 1000) * basicAdAmount) || 0,
                            samsung: ((osDeviceCounts?.samsung / 1000) * basicAdAmount) || 0,
                            oppo: ((osDeviceCounts?.oppo / 1000) * basicAdAmount) || 0,
                            xiaomi: ((osDeviceCounts?.xiaomi / 1000) * basicAdAmount) || 0,
                            vivo: ((osDeviceCounts?.vivo / 1000) * basicAdAmount) || 0,
                        };

                        dailyCostGraphLabels.push(formattedDate);
                        dailyCostGraphData.push(osDeviceObj);
                    };

                    let scorecardData = {
                        cost: osDeviceResult.reduce((acc, item) => acc + parseFloat(item.amount), 0),
                        interactions: (new Set(impressionsResult.map(item => item.bannerUserId))).size,
                        interactionRate: Number((impressionsResult.length / (new Set(impressionsResult.map(item => item.bannerUserId))).size).toFixed(2)),
                        impressions: impressionsResult.length
                    };

                    let osDeviceImpressions = osDeviceResult.reduce((counts, item) => {
                        for (const key in item) {
                            if (key !== 'campaignId' && key !== 'amount') {
                                counts[key] = (counts[key] || 0) + item[key];
                            }
                        }
                        return counts;
                    }, {});

                    let scorecard = {
                        scorecardData,
                        labels: ['Cost', 'Interactions', 'Interaction rate', 'Impressions'],
                        series: [scorecardData.cost, scorecardData.interactions, scorecardData.interactionRate, scorecardData.impressions],
                    };

                    let dailyCostGraph = {
                        labels: dailyCostGraphLabels,
                        series: {
                            os: {
                                android: dailyCostGraphData.map(el => el.android),
                                vr: dailyCostGraphData.map(el => el.vr),
                            },
                            device: {
                                oculus: dailyCostGraphData.map(el => el.oculus),
                                samsung: dailyCostGraphData.map(el => el.samsung),
                                oppo: dailyCostGraphData.map(el => el.oppo),
                                xiaomi: dailyCostGraphData.map(el => el.xiaomi),
                                vivo: dailyCostGraphData.map(el => el.vivo),
                            },
                        }
                    };

                    let interactionRateAndCostGraph = {
                        os: {
                            labels: ['Android', 'VR'],
                            series: {
                                interactionRate: [
                                    Number((osDeviceImpressions?.android / (new Set(impressionsResult.map(item => item.bannerUserId))).size).toFixed(2)),
                                    Number((osDeviceImpressions?.vr / (new Set(impressionsResult.map(item => item.bannerUserId))).size).toFixed(2)),
                                ],
                                cost: [
                                    Number(((osDeviceImpressions?.android / 1000) * basicAdAmount).toFixed(2)),
                                    Number(((osDeviceImpressions?.vr / 1000) * basicAdAmount).toFixed(2)),
                                ]
                            }
                        },
                        device: {
                            labels: ['Oculus', 'Samsung', 'Oppo', 'Xiaomi', 'Vivo'],
                            series: {
                                interactionRate: [
                                    Number((osDeviceImpressions?.oculus / (new Set(impressionsResult.map(item => item.bannerUserId))).size).toFixed(2)),
                                    Number((osDeviceImpressions?.samsung / (new Set(impressionsResult.map(item => item.bannerUserId))).size).toFixed(2)),
                                    Number((osDeviceImpressions?.oppo / (new Set(impressionsResult.map(item => item.bannerUserId))).size).toFixed(2)),
                                    Number((osDeviceImpressions?.xiaomi / (new Set(impressionsResult.map(item => item.bannerUserId))).size).toFixed(2)),
                                    Number((osDeviceImpressions?.vivo / (new Set(impressionsResult.map(item => item.bannerUserId))).size).toFixed(2)),
                                ],
                                cost: [
                                    Number(((osDeviceImpressions?.oculus / 1000) * basicAdAmount).toFixed(2)),
                                    Number(((osDeviceImpressions?.samsung / 1000) * basicAdAmount).toFixed(2)),
                                    Number(((osDeviceImpressions?.oppo / 1000) * basicAdAmount).toFixed(2)),
                                    Number(((osDeviceImpressions?.xiaomi / 1000) * basicAdAmount).toFixed(2)),
                                    Number(((osDeviceImpressions?.vivo / 1000) * basicAdAmount).toFixed(2)),
                                ]
                            }
                        },
                    };

                    let interactionsGraph = {
                        os: {
                            labels: ['Android', 'VR'],
                            series: [
                                (osDeviceImpressions?.android || 0),
                                (osDeviceImpressions?.vr || 0),
                            ],
                        },
                        device: {
                            labels: ['Oculus', 'Samsung', 'Oppo', 'Xiaomi', 'Vivo'],
                            series: [
                                (osDeviceImpressions?.oculus || 0),
                                (osDeviceImpressions?.samsung || 0),
                                (osDeviceImpressions?.oppo || 0),
                                (osDeviceImpressions?.xiaomi || 0),
                                (osDeviceImpressions?.vivo || 0),
                            ],
                        },
                    };

                    let campaignPerformanceTable = Object.values(impressionsResult.reduce((groups, item) => {
                        const { campaignId, campaignName, impressions, os, device } = item;

                        if (!groups[campaignId]) {
                            groups[campaignId] = {
                                campaignId,
                                campaignName,
                                impressions: 0,
                                android: 0,
                                vr: 0,
                                oculus: 0,
                                samsung: 0,
                                oppo: 0,
                                xiaomi: 0,
                                vivo: 0,
                            };
                        }

                        groups[campaignId].impressions += impressions;
                        groups[campaignId][os.toLowerCase()]++;
                        groups[campaignId][device.toLowerCase()]++;

                        return groups;
                    }, {}));

                    let response = {
                        scorecard,
                        dailyCostGraph,
                        interactionRateAndCostGraph,
                        interactionsGraph,
                        campaignPerformanceTable,
                    };

                    return sendResponse(res, SUCCESS, 'Dashboard', response);
                });
            });
        });
    } catch (error) { errReturned(res, error) }
};


// Get User Banners Graph //
exports.getUserBannersGraph = async (req, res) => {
    try {
        let userId = req.user.id;
        let { startDate, endDate, location } = req.body;
        const { bannersBetweenDatesQuery, fromDate, toDate } = getBannersBetweenDatesQuery(startDate, endDate);

        sqlConnection.query(bannersBetweenDatesQuery, [fromDate, toDate], (bannersError, bannersResult) => {
            if (bannersError) return errReturned(res, bannersError);

            const userBanners = bannersResult.filter(banner => banner.userId === userId);

            const userBannersGraph = getGraphResponse(location, userBanners);

            return sendResponse(res, SUCCESS, 'User Banners Graph', userBannersGraph);
        });
    } catch (error) { errReturned(res, error) }
};


// Get All Banners Graph //
exports.getAllBannersGraph = async (req, res) => {
    try {
        let { startDate, endDate, location } = req.body;
        const { bannersBetweenDatesQuery, fromDate, toDate } = getBannersBetweenDatesQuery(startDate, endDate);

        sqlConnection.query(bannersBetweenDatesQuery, [fromDate, toDate], (bannersError, bannersResult) => {
            if (bannersError) return errReturned(res, bannersError);

            const bannersGraph = getGraphResponse(location, bannersResult);

            return sendResponse(res, SUCCESS, 'Banners Graph', bannersGraph);
        });
    } catch (error) { errReturned(res, error) }
};


// Get Campaign Graphs //
exports.getCampaignGraphs = async (req, res) => {
    try {
        let { campaignId, startDate, endDate } = req.body;
        const { campaignImpressionsBetweenDatesQuery, fromDate, toDate } = getCampaignImpressionsBetweenDatesQuery(startDate, endDate);

        sqlConnection.query(campaignImpressionsBetweenDatesQuery, [campaignId, fromDate, toDate], (bannerImpressionsError, bannerImpressionsResult) => {
            if (bannerImpressionsError) return errReturned(res, bannerImpressionsError);

            sqlConnection.query(getCampaignBannersQuery, [campaignId, fromDate, toDate], (campaignBannersError, campaignBannersResult) => {
                if (campaignBannersError) return errReturned(res, campaignBannersError);

                const startDate = moment(fromDate);
                const endDate = moment(toDate);

                let impressionsGraphLabels = [];
                let impressionsGraphData = [];

                for (let date = startDate.clone(); date <= endDate; date.add(1, 'day')) {
                    const formattedDate = date.format('DD MMM YYYY');
                    const impressionsOnDate = bannerImpressionsResult.filter(impression => {
                        const impressionDate = moment(impression.createdAt);
                        return impressionDate.isSame(date, 'day');
                    });

                    const impressionsData = {
                        impressions: impressionsOnDate.reduce((sum, bannerUser) => sum + bannerUser.impressions, 0),
                        maleImpressions: impressionsOnDate.reduce((sum, bannerUser) => sum + bannerUser.maleImpressions, 0),
                        femaleImpressions: impressionsOnDate.reduce((sum, bannerUser) => sum + bannerUser.femaleImpressions, 0),
                    };

                    impressionsGraphLabels.push(formattedDate);
                    impressionsGraphData.push(impressionsData);
                }

                let slotTypeGraphData = bannerSlotTypes.map(type => {
                    const typeData = campaignBannersResult
                        .filter(obj => obj.type === type)
                        .reduce((acc, obj) => {
                            acc.impressions += obj.impressions ? Number(obj.impressions) : 0;
                            acc.maleImpressions += obj.maleImpressions ? Number(obj.maleImpressions) : 0;
                            acc.femaleImpressions += obj.femaleImpressions ? Number(obj.femaleImpressions) : 0;
                            acc.amount = obj.amount ? (parseFloat(obj.amount)) : 0;

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

                const totalImpressions = slotTypeGraphData.reduce((sum, item) => sum + item.impressions, 0);

                slotTypeGraphData = slotTypeGraphData.map((typeData) => ({
                    ...typeData,
                    amountRatio: ((typeData.amount * typeData.impressions) / totalImpressions)
                }));

                const graph = {
                    impressionsGraph: {
                        labels: impressionsGraphLabels,
                        series: {
                            impressions: impressionsGraphData?.map(data => data.impressions),
                            maleImpressions: impressionsGraphData?.map(data => data.maleImpressions),
                            femaleImpressions: impressionsGraphData?.map(data => data.femaleImpressions),
                        },
                    },
                    slotTypeGraph: {
                        labels: bannerSlotTypes,
                        series: {
                            impressions: slotTypeGraphData.map(el => el.impressions ? Number(el.impressions) : 0),
                            maleImpressions: slotTypeGraphData.map(el => el.maleImpressions ? Number(el.maleImpressions) : 0),
                            femaleImpressions: slotTypeGraphData.map(el => el.femaleImpressions ? Number(el.femaleImpressions) : 0),
                            amount: slotTypeGraphData.map(el => el.amountRatio ? Number(el.amountRatio) : 0),
                        },
                    },
                };

                return sendResponse(res, SUCCESS, 'Campaign Graphs', graph);
            });
        });
    } catch (error) { errReturned(res, error) }
};


// Save Data Protection Contact //
exports.saveDataProtectionContact = (req, res) => {
    try {
        let userId = req.user.id;
        let data = {};

        Object.keys(req.body).map(key => {
            if (req.body[key] == '' || req.body[key] === 'undefined' || req.body[key] === 'null') data[key] = null;
            else data[key] = req.body[key];

            return data;
        });

        let { pcName, pcEmail, dpcName, dpcEmail } = data;

        if (!pcName || !pcEmail) return sendResponse(res, BADREQUEST, 'Name and email cannot be null', []);

        const checkUserQuery = selectQuery('*', 'data_protection_contacts', 'userId');
        sqlConnection.query(checkUserQuery, [userId], (checkUserError, checkUserResult) => {
            if (checkUserError) return errReturned(res, checkUserError);

            if (checkUserResult.length > 0) {
                const updateQueryStr = updateQuery(
                    'data_protection_contacts',
                    ['pcName', 'pcEmail', 'pcPhoneNumber', 'pcAddress', 'dpcName', 'dpcEmail', 'dpcPhoneNumber', 'dpcAddress'],
                    'userId'
                );
                const updateValues = [pcName, pcEmail, data.pcPhoneNumber, data.pcAddress, dpcName, dpcEmail, data.dpcPhoneNumber, data.dpcAddress, userId];
                sqlConnection.query(updateQueryStr, updateValues, (updateError, updateResult) => {
                    if (updateError) return errReturned(res, updateError);

                    const updatedRecordQuery = selectQuery('*', 'data_protection_contacts', 'userId');
                    sqlConnection.query(updatedRecordQuery, [userId], (updatedRecordError, updatedRecordResult) => {
                        if (updatedRecordError) return errReturned(res, updatedRecordError);

                        return sendResponse(res, SUCCESS, 'Data Protection Contact updated successfully', updatedRecordResult);
                    });
                });
            } else {
                const insertQueryStr = insertQuery(
                    'data_protection_contacts',
                    ['userId', 'pcName', 'pcEmail', 'pcPhoneNumber', 'pcAddress', 'dpcName', 'dpcEmail', 'dpcPhoneNumber', 'dpcAddress']
                );
                const insertValues = [userId, pcName, pcEmail, data.pcPhoneNumber, data.pcAddress, dpcName, dpcEmail, data.dpcPhoneNumber, data.dpcAddress];
                sqlConnection.query(insertQueryStr, insertValues, (insertError, insertResult) => {
                    if (insertError) return errReturned(res, insertError);

                    const insertedRecordQuery = selectQuery('*', 'data_protection_contacts', 'userId');
                    sqlConnection.query(insertedRecordQuery, [userId], (insertedRecordError, insertedRecordResult) => {
                        if (insertedRecordError) return errReturned(res, insertedRecordError);

                        return sendResponse(res, SUCCESS, 'Data Protection Contact saved successfully', insertedRecordResult);
                    });
                });
            }
        });
    } catch (error) { errReturned(res, error) }
};


// Save Trade License //
exports.saveTradeLicense = async (req, res) => {
    try {
        let userId = req.user.id;
        let { tradeLicenseFile } = req.files;
        if (!tradeLicenseFile || tradeLicenseFile === null || tradeLicenseFile === undefined || tradeLicenseFile.length === 0) return sendResponse(res, BADREQUEST, 'Please upload trade license file', []);

        const checkUserQuery = selectQuery('*', 'data_protection_contacts', 'userId');
        sqlConnection.query(checkUserQuery, [userId], (checkUserError, checkUserResult) => {
            if (checkUserError) return errReturned(res, checkUserError);

            if (checkUserResult.length > 0) {
                const updateQueryStr = updateQuery('data_protection_contacts', ['tradeLicense'], 'userId');
                const updateValues = [tradeLicenseFile[0]?.location, userId];
                sqlConnection.query(updateQueryStr, updateValues, (updateError, updateResult) => {
                    if (updateError) return errReturned(res, updateError);

                    return sendResponse(res, SUCCESS, 'Trade license saved successfully', tradeLicenseFile[0]?.location);
                });
            } else {
                const insertQueryStr = insertQuery('data_protection_contacts', ['userId', 'tradeLicense']);
                const insertValues = [userId, tradeLicenseFile[0]?.location];
                sqlConnection.query(insertQueryStr, insertValues, (insertError, insertResult) => {
                    if (insertError) return errReturned(res, insertError);

                    return sendResponse(res, SUCCESS, 'Trade license saved successfully', tradeLicenseFile[0]?.location);
                });
            }
        });
    } catch (error) { errReturned(res, error) }
};


// Get Campaign by Id //
exports.getCampaign = async (req, res) => {
    try {
        let { campaignId } = req.params;

        if (!campaignId || campaignId == '' || campaignId == undefined || campaignId == null) return sendResponse(res, BADREQUEST, `Please provide campaign id`, []);

        sqlConnection.query(selectQuery('*', 'banner_campaigns', 'id'), [campaignId], (checkCampaignError, checkCampaignResult) => {
            if (checkCampaignError) return errReturned(res, checkCampaignError);

            const campaign = checkCampaignResult[0];

            if (!campaign) return sendResponse(res, BADREQUEST, 'Campaign not found', []);

            sqlConnection.query(selectQuery('*', 'banners', 'campaignId'), [campaignId], (bannersError, bannersResult) => {
                if (bannersError) return errReturned(res, bannersError);

                return sendResponse(res, SUCCESS, 'Here is found campaign', { ...campaign, banners: bannersResult });
            });
        });
    } catch (error) { errReturned(res, error) }
};


// Get Run Campaigns //
exports.getRunCampaigns = async (req, res) => {
    try {
        let userId = req.user.id;

        sqlConnection.query(selectQuery('*', 'banner_campaigns', 'userId'), [userId], (runCampaignsError, runCampaignsResult) => {
            if (runCampaignsError) return errReturned(res, runCampaignsError);
            if (!runCampaignsResult) return sendResponse(res, BADREQUEST, 'Run campaigns not found', []);

            let runCampaigns = runCampaignsResult?.map(campaign => {
                return {
                    id: campaign.id,
                    campaignName: campaign.adName,
                };
            });

            return sendResponse(res, SUCCESS, 'Run campaigns', runCampaigns);
        });
    } catch (error) { errReturned(res, error); }
};


// Get Banner Locations //
exports.getBannerLocations = async (req, res) => {
    try {
        sqlConnection.query(selectBannerLocationsQuery, (locationsError, locationsResult) => {
            if (locationsError) return errReturned(res, locationsError);

            const locations = locationsResult.map(el => el?.location);

            return sendResponse(res, SUCCESS, 'Banner locations', locations);
        });
    } catch (error) { errReturned(res, error) }
};


// Get User Banners //
exports.getUserBanners = async (req, res) => {
    try {
        const userId = req.user.id;

        sqlConnection.query(getUserCampaignsQuery, [userId], (bannersError, bannersResult) => {
            if (bannersError) return errReturned(res, bannersError);
            return sendResponse(res, SUCCESS, 'Here are found banners', bannersResult);
        });
    } catch (error) { errReturned(res, error) }
};


// Get User Draft Campaigns //
exports.getUserDraftCampaigns = async (req, res) => {
    try {
        const userId = req.user.id;

        sqlConnection.query(getUserDraftCampaignsQuery, [userId], (campaignsError, campaignsResult) => {
            if (campaignsError) return errReturned(res, campaignsError);
            return sendResponse(res, SUCCESS, 'Here are found draft campaigns', campaignsResult);
        });
    } catch (error) { errReturned(res, error) }
};


// Get All Banners //
exports.getAllBanners = async (req, res) => {
    try {
        sqlConnection.query(getAllCampaignsQuery, (bannersError, bannersResult) => {
            if (bannersError) return errReturned(res, bannersError);

            return sendResponse(res, SUCCESS, 'Here are found banners', bannersResult);
        });
    } catch (error) { errReturned(res, error) }
};


// Mark Notification as Read //
exports.markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        sqlConnection.query(selectQuery('*', 'banner_notifications', 'id'), [notificationId], (checkBannerNotificationError, checkBannerNotificationResult) => {
            if (checkBannerNotificationError) return errReturned(res, checkBannerNotificationError);
            if (!checkBannerNotificationResult[0]) return sendResponse(res, BADREQUEST, 'Banner notification not found', []);

            sqlConnection.query(updateQuery('banner_notifications', ['isRead'], 'id'), [1, notificationId], (markError, markResult) => {
                if (markError) return errReturned(res, markError);

                sqlConnection.query(selectQuery('*', 'banner_notifications', 'id'), [notificationId], (bannerNotificationError, bannerNotificationResult) => {
                    if (bannerNotificationError) return errReturned(res, bannerNotificationError);

                    return sendResponse(res, SUCCESS, `Notification marked as read`, bannerNotificationResult[0]);
                });
            });
        });
    } catch (error) { errReturned(res, error) }
}


// Set Status //
exports.setStatus = async (req, res) => {
    try {
        let userId = req.user.id;
        const { campaignId, status, message } = req.body;
        let data = req.body;

        let required = ['campaignId', 'status'];
        for (let key of required) {
            if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null) return sendResponse(res, BADREQUEST, `Please provide ${key}`, []);
        }

        sqlConnection.query(selectQuery('*', 'banner_campaigns', 'id'), [campaignId], (checkCampaignError, checkCampaignResult) => {
            if (checkCampaignError) return errReturned(res, checkCampaignError);

            const campaign = checkCampaignResult[0];

            if (!campaign) return sendResponse(res, BADREQUEST, 'Campaign not found', []);

            sqlConnection.query(selectQuery('*', 'banners', 'campaignId'), [campaignId], (bannersError, bannersResult) => {
                if (bannersError) return errReturned(res, bannersError);
                if (!bannersResult || bannersResult.length <= 0) return sendResponse(res, BADREQUEST, 'Ads not found in this campaign', []);

                let updateBannerQuery = updateQuery('banners', ['status'], 'campaignId');
                let updateBannerValues = [status, campaignId];
                sqlConnection.query(updateBannerQuery, updateBannerValues, (updateBannerError, updateBannerResult) => {
                    if (updateBannerError) reject(updateBannerError);

                    let updateCampaignQuery = updateQuery('banner_campaigns', ['status'], 'id');
                    let updateCampaignValues = [status, campaignId];
                    sqlConnection.query(updateCampaignQuery, updateCampaignValues, (updateCampaignError, updateCampaignResult) => {
                        if (updateCampaignError) return errReturned(res, updateCampaignError);

                        sqlConnection.query(selectQuery('email', 'users', 'id'), [campaign.userId], (receiverEmailError, receiverEmailResult) => {
                            if (receiverEmailError) reject(receiverEmailError);

                            const receiverEmail = receiverEmailResult[0].email;

                            if (status === 'approved' || status === 'suspended' || status === 'rejected') {
                                const insertNotificationQuery = insertQuery('banner_notifications', ['campaignId', 'bannerName', 'status', 'message', 'senderId', 'receiverId', 'isRead']);
                                const insertNotificationValues = [campaignId, campaign.adName, status, message, userId, campaign.userId, 0];
                                sqlConnection.query(insertNotificationQuery, insertNotificationValues, (insertNotificationError, insertNotificationResult) => {
                                    if (insertNotificationError) return errReturned(res, insertNotificationError);

                                    sendEmail(receiverEmail, `${campaign.adName} Ad ${formatWord(status)}`, message);

                                    sqlConnection.query(selectQuery('*', 'banner_campaigns', 'id'), [campaignId], (campaignError, campaignResult) => {
                                        if (campaignError) return errReturned(res, campaignError);

                                        if (status === 'approved') {
                                            sqlConnection.query(selectQuery('*', 'user_devices'), (fcmTokenError, fcmTokenResult) => {
                                                if (fcmTokenError) return errReturned(res, fcmTokenError);

                                                fcmTokenResult.map(async ({ fcmToken }) => {
                                                    await sendFirebaseNotification(fcmToken);
                                                });

                                                return sendResponse(res, SUCCESS, `Campaign status changed to "${status}" successfully`, campaignResult[0]);
                                            });
                                        } else return sendResponse(res, SUCCESS, `Campaign status changed to "${status}" successfully`, campaignResult[0]);
                                    });
                                });
                            } else {
                                sqlConnection.query(selectQuery('*', 'banner_campaigns', 'id'), [campaignId], (campaignError, campaignResult) => {
                                    if (campaignError) return errReturned(res, campaignError);

                                    return sendResponse(res, SUCCESS, `Campaign status changed to "${status}" successfully`, campaignResult[0]);
                                });
                            }
                        });
                    });
                });
            });
        });
    } catch (error) { errReturned(res, error) }
};


// Detach Expired Banners //
exports.detachExpiredTimeBanners = async (req, res) => {
    try {
        removeExpiredTimeBanners();

        return sendResponse(res, SUCCESS, 'Expired banners removed successfully');
    } catch (error) { errReturned(res, error) }
};


// Interact //
exports.interact = async (req, res) => {
    try {
        let userId = req.user.id;
        const { bannerId, os, device } = req.params;

        sqlConnection.query(selectQuery('*', 'banners', 'id'), [bannerId], (findbannerError, findbannerResult) => {
            if (findbannerError) return errReturned(res, findbannerError);

            let banner = findbannerResult[0];

            if (!banner) return sendResponse(res, BADREQUEST, 'Banner not found', []);

            sqlConnection.query(selectQuery('gender', 'users', 'id'), [userId], (userGenderError, userGenderResult) => {
                if (userGenderError) return errReturned(res, userGenderError);

                const userGender = userGenderResult[0]?.gender;

                if (!userGender) return sendResponse(res, BADREQUEST, 'Gender not found', []);

                let insertBannerUserValues;
                if (userGender === 'male') insertBannerUserValues = [bannerId, userId, userGender, 1, 1, 0, banner.campaignId, os, device];
                else if (userGender === 'female') insertBannerUserValues = [bannerId, userId, userGender, 1, 0, 1, banner.campaignId, os, device];
                else insertBannerUserValues = [bannerId, userId, 'unknown', 1, 0, 0, banner.campaignId, os, device];
                sqlConnection.query(insertBannerUserQuery, insertBannerUserValues, (insertBannerUserError, insertBannerUserResult) => {
                    if (insertBannerUserError) return errReturned(res, insertBannerUserError);

                    removeExpiredImpressionBanner(bannerId);

                    return sendResponse(res, SUCCESS, 'User interacted successfully', []);
                });
            });
        });
    } catch (error) { errReturned(res, error) }
};


// Delete Banner //
exports.deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || id === undefined || id === null) return sendResponse(res, BADREQUEST, 'Please provide banner id');

        sqlConnection.query(selectQuery('*', 'banners', 'id'), [id], (bannerError, bannerResult) => {
            if (bannerError) return errReturned(res, bannerError);
            if (!bannerResult[0]) return sendResponse(res, BADREQUEST, 'Banner not found', []);

            const updateBannerSlotQuery = updateQuery('banner_slots', ['isFilled', 'bannerId'], 'bannerId');
            const updateBannerSlotValues = [0, null, id];
            sqlConnection.query(updateBannerSlotQuery, updateBannerSlotValues, (updateBannerSlotError, updateBannerSlotResult) => {
                if (updateBannerSlotError) return errReturned(res, updateBannerSlotError);

                sqlConnection.query(deleteQuery('banner_users', 'bannerId'), [id], (deleteBannerUserError, deleteBannerUserResult) => {
                    if (deleteBannerUserError) return errReturned(res, deleteBannerUserError);

                    sqlConnection.query(deleteQuery('banners', 'id'), [id], (deleteBannerError, deleteBannerResult) => {
                        if (deleteBannerError) return errReturned(res, deleteBannerError);
                        if (deleteBannerResult.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to delete the banner', []);

                        return sendResponse(res, SUCCESS, 'Banner deleted successfully', []);
                    });
                });
            });
        });
    } catch (error) { errReturned(res, error) }
};


// Discard Draft Campaign //
exports.discardDraftCampaign = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || id === undefined || id === null) return sendResponse(res, BADREQUEST, 'Please provide banner id');

        sqlConnection.query(deleteQuery('banners', 'campaignId'), [id], (deleteBannersError, deleteBannersResult) => {
            if (deleteBannersError) return errReturned(res, deleteBannersError);
            if (deleteBannersResult.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to delete the campaign', []);

            sqlConnection.query(deleteQuery('banner_campaigns', 'id'), [id], (deleteCampaignError, deleteCampaignResult) => {
                if (deleteCampaignError) return errReturned(res, deleteCampaignError);
                if (deleteCampaignResult.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to delete the campaign', []);

                return sendResponse(res, SUCCESS, 'Campaign draft discarded successfully', []);
            });
        });
    } catch (error) { errReturned(res, error) }
};