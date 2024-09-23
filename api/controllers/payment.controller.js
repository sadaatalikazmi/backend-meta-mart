'use strict';

const moment = require("moment");
const stripe = require('stripe')(process?.env?.STRIPE_SECRET_KEY);
const { sendResponse, errReturned } = require('../../config/dto');
const { SUCCESS, BADREQUEST, NOTFOUND } = require('../../config/ResponseCodes');
const sqlConnection = require("../../config/sqlConnection");
const { insertQuery, selectQuery, updateQuery, deleteQuery, sendEmail, formatWord } = require('../../utils/helper');



// Create Payment Profile //
exports.createPaymentProfile = async (req, res) => {
    try {
        let userId = req.user.id;
        let { profileType, organizationName, legalName, suite, suburb, city, postalCode } = req.body;
        let data = req.body;

        let required = ['profileType', 'organizationName', 'legalName', 'suburb', 'city', 'postalCode'];
        for (let key of required) {
            if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null) return sendResponse(res, BADREQUEST, `Please provide ${key}`, []);
        }

        let insertPaymentProfileQuery = insertQuery('payment_profiles', ['userId', 'profileType', 'organizationName', 'legalName', 'suite', 'suburb', 'city', 'postalCode']);
        let insertPaymentProfileValues = [userId, profileType, organizationName, legalName, suite, suburb, city, postalCode];
        sqlConnection.query(insertPaymentProfileQuery, insertPaymentProfileValues, (insertProfileError, inserProfileResult) => {
            if (insertProfileError) return errReturned(res, insertProfileError);

            sqlConnection.query(selectQuery('*', 'payment_profiles', 'id'), [inserProfileResult.insertId], (profileError, profileResult) => {
                if (profileError) return errReturned(res, profileError);

                return sendResponse(res, SUCCESS, 'Payment profile created successfully', profileResult[0]);
            })
        })
    } catch (error) { errReturned(res, error) }
};


// Save Card //
exports.saveCard = async (req, res) => {
    try {
        let userId = req.user.id;
        let { paymentMethodId } = req.body;
        let required = ['paymentMethodId'];
        for (const field of required) {
            if (!req.body[field]) return sendResponse(res, BADREQUEST, `Please provide ${field}`, []);
        }

        sqlConnection.query(selectQuery('*', 'users', 'id'), [userId], async (userError, userResult) => {
            if (userError) return errReturned(res, userError);
            if (!userResult || userResult.length === 0) return sendResponse(res, NOTFOUND, 'User not found');

            let user = userResult[0];

            let paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, { customer: user.stripeId });

            let card = {
                paymentMethodId: paymentMethod?.id,
                brand: paymentMethod?.card?.brand,
                last4Digits: paymentMethod?.card?.last4,
                expiryMonth: paymentMethod?.card?.exp_month,
                expiryYear: paymentMethod?.card?.exp_year,
                zipCode: paymentMethod?.billing_details?.address?.postal_code,
            };

            return sendResponse(res, SUCCESS, 'Card saved successfully', card);
        });
    } catch (error) { errReturned(res, error) }
};


// Pay //
exports.pay = async (req, res) => {
    try {
        let userId = req.user.id;
        let { paymentMethodId, amount } = req.body;
        let required = ['paymentMethodId', 'amount'];
        for (const field of required) {
            if (!req.body[field]) return sendResponse(res, BADREQUEST, `Please provide ${field}`, []);
        }

        sqlConnection.query(selectQuery('*', 'users', 'id'), [userId], async (userError, userResult) => {
            if (userError) return errReturned(res, userError);
            if (!userResult || userResult.length === 0) return sendResponse(res, NOTFOUND, 'User not found');

            let user = userResult[0];

            let paymentIntent = await stripe.paymentIntents.create({
                amount: Math.floor(amount * 100),
                currency: 'usd',
                payment_method: paymentMethodId,
                customer: user.stripeId,
                confirmation_method: 'manual',
                confirm: true,
                return_url: 'http://localhost:3000/#/home',
            });

            return sendResponse(res, SUCCESS, 'Amount paid successfully', paymentIntent);
        });
    } catch (error) { errReturned(res, error) }
};


// Refund //
exports.refund = async (req, res) => {
    try {
        let userId = req.user.id;
        let { paymentMethodId, amount } = req.body;
        let required = ['paymentMethodId', 'amount'];
        for (const field of required) {
            if (!req.body[field]) return sendResponse(res, BADREQUEST, `Please provide ${field}`, []);
        }

        sqlConnection.query(selectQuery('*', 'users', 'id'), [userId], async (userError, userResult) => {
            if (userError) return errReturned(res, userError);
            if (!userResult || userResult.length === 0) return sendResponse(res, NOTFOUND, 'User not found');

            let user = userResult[0];

            let paymentIntent = await stripe.paymentIntents.create({
                amount: Math.floor(amount * 100),
                currency: 'usd',
                payment_method: paymentMethodId,
                customer: user.stripeId,
                confirmation_method: 'manual',
                confirm: true,
                return_url: 'http://localhost:3000/#/home',
            });

            let refund = await stripe.refunds.create({ payment_intent: paymentIntent.id });

            return sendResponse(res, SUCCESS, 'Amount refunded successfully', refund);
        });
    } catch (error) { errReturned(res, error) }
};


// Get User Payment Profile //
exports.getPaymentProfiles = async (req, res) => {
    try {
        let userId = req.user.id;

        sqlConnection.query(selectQuery('*', 'payment_profiles', 'userId'), [userId], (profilesError, profilesResult) => {
            if (profilesError) return errReturned(res, profilesError);
            if (profilesResult.length === 0) return sendResponse(res, SUCCESS, 'Payment profiles not found', []);

            return sendResponse(res, SUCCESS, 'Payment Profiles', profilesResult);
        })
    } catch (error) { errReturned(res, error) }
};


// Get User Cards //
exports.getUserCards = async (req, res) => {
    try {
        let userId = req.user.id;

        sqlConnection.query(selectQuery('*', 'users', 'id'), [userId], async (userError, userResult) => {
            if (userError) return errReturned(res, userError);
            if (!userResult || userResult.length === 0) return sendResponse(res, NOTFOUND, 'User not found');

            let user = userResult[0];

            const paymentMethods = await stripe.paymentMethods.list({
                customer: user.stripeId,
                type: 'card',
            });

            const userCards = paymentMethods.data.map(paymentMethod => {
                let card = {
                    paymentMethodId: paymentMethod?.id,
                    brand: paymentMethod?.card?.brand,
                    last4Digits: paymentMethod?.card?.last4,
                    expiryMonth: paymentMethod?.card?.exp_month,
                    expiryYear: paymentMethod?.card?.exp_year,
                    zipCode: paymentMethod?.billing_details?.address?.postal_code,
                };

                return card;
            });

            return sendResponse(res, SUCCESS, 'User cards', userCards);
        });
    } catch (error) { errReturned(res, error) }
};


// Update Payment Profile //
exports.updatePaymentProfile = async (req, res) => {
    try {
        let { id, profileType, organizationName, legalName, suite, suburb, city, postalCode } = req.body;
        let data = req.body;

        let required = ['id', 'profileType', 'organizationName', 'legalName', 'suburb', 'city', 'postalCode'];
        for (let key of required) {
            if (!data[key] || data[key] == '' || data[key] == undefined || data[key] == null) return sendResponse(res, BADREQUEST, `Please provide ${key}`, []);
        }

        sqlConnection.query(selectQuery('*', 'payment_profiles', 'id'), [id], (paymentProfileError, paymentProfileResult) => {
            if (paymentProfileError) return errReturned(res, paymentProfileError);
            if (!paymentProfileResult || paymentProfileResult.length === 0) return sendResponse(res, BADREQUEST, 'Payment profile not found', []);

            let updatePaymentProfileQuery = updateQuery('payment_profiles', ['profileType', 'organizationName', 'legalName', 'suite', 'suburb', 'city', 'postalCode'], 'id');
            const updatePaymentProfileValues = [profileType, organizationName, legalName, suite, suburb, city, postalCode, id];
            sqlConnection.query(updatePaymentProfileQuery, updatePaymentProfileValues, (updateProfileError, updateProfileResult) => {
                if (updateProfileError) return errReturned(res, updateProfileError);
                if (updateProfileResult.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to update payment profile', []);

                sqlConnection.query(selectQuery('*', 'payment_profiles', 'id'), [id], (profileError, profileResult) => {
                    if (profileError) return errReturned(res, profileError);
                    if (!profileResult || profileResult.length === 0) return sendResponse(res, BADREQUEST, 'Payment profile not found', []);

                    return sendResponse(res, SUCCESS, 'Payment profile updated successfully', profileResult[0]);
                });
            });
        });
    } catch (error) { errReturned(res, error) }
};


// Delete Payment Profile //
exports.deletePaymentProfile = async (req, res) => {
    try {
        let { profileId } = req.params;

        if (!profileId || profileId == '' || profileId == undefined || profileId == null) return sendResponse(res, BADREQUEST, `Please provide payment profile id`, []);

        sqlConnection.query(deleteQuery('payment_profiles', 'id'), [profileId], (deleteProfileError, deleteProfileResult) => {
            if (deleteProfileError) return errReturned(res, deleteProfileError);
            if (deleteProfileResult.affectedRows === 0) return sendResponse(res, BADREQUEST, 'Failed to delete the payment profile', []);

            return sendResponse(res, SUCCESS, 'Payment profile deleted successfully', []);
        });
    } catch (error) { errReturned(res, error) }
};