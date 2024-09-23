'use strict';

const { sendResponse, errReturned } = require('../../config/dto');
const { SUCCESS, BADREQUEST } = require('../../config/ResponseCodes');
const sqlConnection = require("../../config/sqlConnection");
const { lifeEvents } = require('../../config/environment/const');
const { insertQuery, selectQuery, deleteQuery } = require('../../utils/helper');
const {
    getCurrentCampaignSlotsQuery,
    getAllBannerSlotsQuery,
    getUserProductCategoriesQuery,
    getLocationFromIP,
    getTimeMetrics,
    getRamadanDates,
} = require('../../utils/bannerSlot.helper');


// Create Banner Slot //
exports.createBannerSlot = async (req, res) => {
    try {
        const { name, type, bannerSize, thumbnail } = req.body;

        let data = req.body;
        let required = ['name', 'type', 'bannerSize', 'thumbnail'];
        for (let key of required)
            if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null)
                return sendResponse(res, BADREQUEST, `Please provide ${key}`, []);

        sqlConnection.query(selectQuery('*', 'banner_slots', 'name'), [name], (checkBannerSlotError, checkBannerSlotResult) => {
            if (checkBannerSlotError) return errReturned(res, checkBannerSlotError);

            let checkBannerSlot = checkBannerSlotResult[0];
            if (checkBannerSlot) return sendResponse(res, BADREQUEST, 'Banner slot already exists');

            const insertBannerSlotQuery = insertQuery('banner_slots', ['name', 'type', 'bannerSize', 'thumbnail']);
            const insertBannerSlotValues = [name, type, bannerSize, thumbnail];
            sqlConnection.query(insertBannerSlotQuery, insertBannerSlotValues, (insertBannerSlotError, insertBannerSlotResult) => {
                if (insertBannerSlotError) return errReturned(res, insertBannerSlotError);

                sqlConnection.query(selectQuery('*', 'banner_slots', 'id'), [insertBannerSlotResult.insertId], (bannerSlotError, bannerSlotResult) => {
                    if (bannerSlotError) return errReturned(res, bannerSlotError);

                    let bannerSlot = bannerSlotResult[0];

                    return sendResponse(res, SUCCESS, 'Banner slot created successfully', bannerSlot);
                });
            });
        });
    } catch (error) { errReturned(res, error) }
};

// Get Available Banner Slots by Type //
exports.getAvailableBannerSlots = async (req, res) => {
    try {
        let { types } = req.body;

        if (!types || types == '' || types == undefined || types == null) return sendResponse(res, BADREQUEST, `Please provide banner slot types`, []);

        let slotTypes = types.split(',');
        let bannerSlots = [];

        let bannerSlotsPromise = slotTypes && slotTypes.map(type => {
            return new Promise((resolve, reject) => {
                sqlConnection.query(selectQuery('*', 'banner_slots', 'type'), [type], (availableBannerSlotsError, availableBannerSlotsResult) => {
                    if (availableBannerSlotsError) reject(availableBannerSlotsError);
                    else {
                        bannerSlots.push(availableBannerSlotsResult);
                        resolve();
                    }
                });
            });
        });

        Promise.all(bannerSlotsPromise)
            .then(() => {
                const flattenedBannerSlots = bannerSlots.flat();
                sendResponse(res, SUCCESS, 'Here are the available banner slots', flattenedBannerSlots, flattenedBannerSlots.length);
            })
            .catch(error => errReturned(res, error));
    } catch (error) { errReturned(res, error) }
};

// Get Banner Slot by Id //
exports.getBannerSlot = async (req, res) => {
    try {
        let { id } = req.params;
        if (!id || id == '' || id == undefined || id == null) return sendResponse(res, BADREQUEST, `Please provide banner slot id`, []);

        sqlConnection.query(selectQuery('*', 'banner_slots', 'id'), [id], (checkBannerSlotError, checkBannerSlotResult) => {
            if (checkBannerSlotError) return errReturned(res, checkBannerSlotError);

            const bannerSlot = checkBannerSlotResult[0];

            if (!bannerSlot) return sendResponse(res, BADREQUEST, 'Banner slot not found', []);

            return sendResponse(res, SUCCESS, 'Here is found banner slot', bannerSlot);
        });
    } catch (error) { errReturned(res, error) }
};

// Get Current Banner Slot //
exports.getCurrentCampaignSlots = async (req, res) => {
    try {
        let { campaignId } = req.params;

        if (!campaignId || campaignId == '' || campaignId == undefined || campaignId == null) return sendResponse(res, BADREQUEST, `Please provide banner id`, []);

        sqlConnection.query(selectQuery('*', 'banner_campaigns', 'id'), [campaignId], (campaignError, campaignResult) => {
            if (campaignError) return errReturned(res, campaignError);
            if (!campaignResult || campaignResult.length <= 0) return sendResponse(res, BADREQUEST, 'Ad campaign not found');

            sqlConnection.query(getCurrentCampaignSlotsQuery, [campaignId], (currentBannerSlotError, currentBannerSlotResult) => {
                if (currentBannerSlotError) return errReturned(res, currentBannerSlotError);
                if (!currentBannerSlotResult) return errReturned(res, BADREQUEST, 'Current banner slot not found', []);

                return sendResponse(res, SUCCESS, 'Current Banner Slot', currentBannerSlotResult);
            });
        });
    } catch (error) { errReturned(res, error) }
};

// Get All Banner Slots //
exports.getAllBannerSlots = async (req, res) => {
    try {
        const { ip, device, os } = req.params;
        const userId = req.user.id;

        const location = getLocationFromIP(ip);
        const { currentDate, currentHour, currentDay, lifeEventDate } = getTimeMetrics();

        sqlConnection.query(getUserProductCategoriesQuery, [userId], (getuserProductCategoriesError, getuserProductCategoriesResult) => {
            if (getuserProductCategoriesError) return errReturned(res, getuserProductCategoriesError);

            const userProductCategories = getuserProductCategoriesResult.map(category => category.type);

            sqlConnection.query(selectQuery('*', 'users', 'id'), [userId], (userError, userResult) => {
                if (userError) return errReturned(res, userError);

                const user = userResult[0];

                if (!user) return sendResponse(res, BADREQUEST, 'User not found', []);

                sqlConnection.query(getAllBannerSlotsQuery, [userId], (bannerSlotsError, bannerSlotsResult) => {
                    if (bannerSlotsError) return errReturned(res, bannerSlotsError);

                    const bannerSlots = {};
                    
                    const groupedBanners = bannerSlotsResult.reduce((groups, bannerSlot) => {
                        const slotName = bannerSlot.name;
                        groups[slotName] = groups[slotName] || [];
                        groups[slotName].push(bannerSlot);
                        return groups;
                    }, {});

                    Object.keys(groupedBanners).forEach(slotName => {
                        const banners = groupedBanners[slotName];

                        const eligibleBanners = banners.filter(bannerSlot => {
                            let showBanner = true;

                            if (bannerSlot.status !== 'approved') showBanner = false;
                            if (bannerSlot.location && bannerSlot.location != null && !bannerSlot.location.includes(location)) showBanner = false;
                            if (bannerSlot.gender && bannerSlot.gender != null && !bannerSlot.gender.includes(user.gender)) showBanner = false;
                            if (bannerSlot.fromAge && bannerSlot.toAge && bannerSlot.fromAge != null && bannerSlot.toAge != null && user.age && user.age != null && ((bannerSlot.fromAge > user.age && user.age < bannerSlot.toAge) || (bannerSlot.fromAge < user.age && user.age > bannerSlot.toAge))) showBanner = false;
                            if (bannerSlot.productCategory && bannerSlot.productCategory != null && userProductCategories && userProductCategories.length != 0 && !userProductCategories.includes(bannerSlot.productCategory)) showBanner = false;
                            if (bannerSlot.fromHour && bannerSlot.toHour && bannerSlot.fromHour != null && bannerSlot.toHour != null && ((bannerSlot.fromHour > currentHour && currentHour < bannerSlot.toHour) || (bannerSlot.fromHour < currentHour && currentHour > bannerSlot.toHour))) showBanner = false;
                            if (bannerSlot.dayOfWeek && bannerSlot.dayOfWeek != null && !bannerSlot.dayOfWeek.includes(currentDay)) showBanner = false;

                            if (bannerSlot.category === 'target') {
                                if (bannerSlot.os && bannerSlot.os != null && !bannerSlot.os.toLowerCase().includes(os.toLowerCase())) showBanner = false;
                                if (bannerSlot.device && bannerSlot.device != null && !bannerSlot.device.toLowerCase().includes(device.toLowerCase())) showBanner = false;
                            } else if (bannerSlot.category === 'awareness') {
                                if (bannerSlot.frequencyCap && bannerSlot.frequencyCap != null && bannerSlot.userFrequency && bannerSlot.userFrequency != null && bannerSlot.frequencyCap <= bannerSlot.userFrequency) showBanner = false;
                                if (bannerSlot.lifeEvent && bannerSlot.lifeEvent != null) {
                                    const Ramadan = getRamadanDates();
                                    if (bannerSlot.lifeEvent === 'Ramadan') {
                                        if (currentDate < (new Date(Ramadan.startDate)) || currentDate > (new Date(Ramadan.endDate))) showBanner = false;
                                    } else {
                                        let lifeEvent = lifeEvents.filter(event => event.day == bannerSlot.lifeEvent);
                                        if (lifeEvent.length != 0 && lifeEvent[0].date != lifeEventDate) showBanner = false;
                                    }
                                }
                            }

                            return showBanner;
                        });

                        if (eligibleBanners.length >= 1) {
                            const randomBanner = eligibleBanners[Math.floor(Math.random() * eligibleBanners.length)];
                            
                            bannerSlots[slotName] = {
                                banner: {
                                    id: randomBanner.bannerId,
                                    bannerUrl: randomBanner.bannerUrl,
                                }
                            };
                        } else {
                            bannerSlots[slotName] = {
                                banner: {
                                    id: 0,
                                    bannerUrl: banners[0].thumbnail,
                                }
                            };
                        }
                    });

                    return sendResponse(res, SUCCESS, 'Here are found banner slots', bannerSlots);
                });
            });
        });
    } catch (error) { errReturned(res, error) }
};

// Delete Banner Slot //
exports.deleteBannerSlot = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || id === undefined || id === null) return sendResponse(res, BADREQUEST, 'Please provide banner slot id');

        sqlConnection.query(selectQuery('*', 'banner_slots', 'id'), [id], (checkBannerSlotError, checkBannerSlotResult) => {
            if (checkBannerSlotError) return errReturned(res, checkBannerSlotError);

            const bannerSlot = checkBannerSlotResult[0];
            if (!bannerSlot) return sendResponse(res, BADREQUEST, 'Banner slot not found', []);

            sqlConnection.query(deleteQuery('banner_slots', 'id'), [id], (deleteBannerSlotError, deleteBannerSlotResult) => {
                if (deleteBannerSlotError) return errReturned(res, deleteBannerSlotError);
                if (deleteBannerSlotResult.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to delete the banner slot', []);

                return sendResponse(res, SUCCESS, 'Banner slot deleted successfully', []);
            });
        });
    } catch (error) { errReturned(res, error) }
};

// Push Banner Slots //
exports.pushBannerSlots = async (req, res) => {
    const insertBannerSlot = (i) => {
        if (i <= 4) {
            let name = `wall${i}`;
            const type = 'wall';
            const bannerSize = 1;
            // const thumbnail = 'https://nifty-temp-bucket.s3.us-east-2.amazonaws.com/Banners_Thumbnails/1.jpg';
            // const thumbnail = 'https://nifty-temp-bucket.s3.us-east-2.amazonaws.com/Banners_Thumbnails/2.jpg';
            const thumbnail = 'https://nifty-temp-bucket.s3.us-east-2.amazonaws.com/Banners_Thumbnails/3.mp4';

            sqlConnection.query(selectQuery('*', 'banner_slots', 'name'), [name], (checkBannerSlotError, checkBannerSlotResult) => {
                if (checkBannerSlotError) return errReturned(res, checkBannerSlotError);

                let checkBannerSlot = checkBannerSlotResult[0];
                if (checkBannerSlot) return sendResponse(res, BADREQUEST, 'Banner slot already exists');

                const insertBannerSlotQuery = insertQuery('banner_slots', ['name', 'type', 'bannerSize', 'thumbnail']);
                const insertBannerSlotValues = [name, type, bannerSize, thumbnail];
                sqlConnection.query(insertBannerSlotQuery, insertBannerSlotValues, (insertBannerSlotError, insertBannerSlotResult) => {
                    if (insertBannerSlotError) return errReturned(res, insertBannerSlotError);

                    insertBannerSlot(i + 1);
                });
            });
        } else return sendResponse(res, SUCCESS, 'Banner slots created successfully');
    };

    try { insertBannerSlot(1) }
    catch (error) { errReturned(res, error) }
};