const { sendResponse, errReturned } = require('../../config/dto');
const { SUCCESS } = require('../../config/ResponseCodes');
const { dataClient, formatToFromDates, formatGraphResponse } = require('../../utils/analytics.helper');
const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;

exports.getUsersData = async (req, res) => {
    try {
        const { formattedFromDate, formattedToDate } = formatToFromDates(req.body.dates);
        const graphArray = ['activeUsers', 'newUsers', 'totalUsers'];

        let usersData = {
            activeUsers: {},
            newUsers: {},
            totalUsers: {},
            countries: [],
            cities: []
        };

        const [countriesResponse] = await dataClient().runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{
                startDate: formattedFromDate,
                endDate: formattedToDate,
            }],
            dimensions: [{ name: 'country' }],
            metrics: [{ name: 'totalUsers' }],
        });

        countriesResponse.rows.forEach(row => {
            let country = row.dimensionValues[0].value;
            let users = Number(row.metricValues[0].value);

            country !== '(not set)' && usersData.countries.push({
                country,
                users,
            });
        });

        const [citiesResponse] = await dataClient().runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{
                startDate: formattedFromDate,
                endDate: formattedToDate,
            }],
            dimensions: [{ name: 'city' }],
            metrics: [{ name: 'totalUsers' }],
        });

        citiesResponse.rows.forEach(row => {
            let city = row.dimensionValues[0].value;
            let users = Number(row.metricValues[0].value);

            city !== '(not set)' && usersData.cities.push({
                city,
                users,
            });
        });

        if (graphArray && graphArray.length > 0) {
            for (const [index, graph] of graphArray.entries()) {
                const [graphResponse] = await dataClient().runReport({
                    property: `properties/${propertyId}`,
                    dateRanges: [{
                        startDate: formattedFromDate,
                        endDate: formattedToDate,
                    }],
                    dimensions: [{ name: 'date' }],
                    metrics: [{ name: graph }],
                    granularity: { timeGranularity: 'DAY' },
                });

                let { datesArray, dataArray } = formatGraphResponse(graphResponse, formattedFromDate, formattedToDate);

                usersData[graph] = {
                    labels: datesArray,
                    data: dataArray,
                };

                if (graphArray.length === (index + 1)) return sendResponse(res, SUCCESS, "Users Data", usersData);
            };
        }
    } catch (error) {
        return errReturned(res, error);
    }
};

exports.getEventsData = async (req, res) => {
    try {
        const { formattedFromDate, formattedToDate } = formatToFromDates(req.body.dates);
        const eventNames = ['user_engagement', 'Grocery', 'Beef', 'FriutsAndVegs', 'Cheese', 'Drinks', 'Flowers', 'CheckOut'];

        let eventsData = {
            graph: {},
            table: []
        };

        const [tableResponse] = await dataClient().runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{
                startDate: formattedFromDate,
                endDate: formattedToDate,
            }],
            dimensions: [{ name: 'eventName' }],
            metrics: [
                { name: 'eventCount' },
                { name: 'totalUsers' },
                { name: 'eventCountPerUser' },
            ],
        });

        tableResponse.rows.forEach(row => {
            let eventName = row.dimensionValues[0].value;
            let eventCount = Number(row.metricValues[0].value);
            let totalUsers = Number(row.metricValues[1].value);
            let eventCountPerUser = Number(Number(row.metricValues[2].value).toFixed(2));

            eventsData.table.push({
                eventName,
                eventCount,
                totalUsers,
                eventCountPerUser,
            });
        });

        if (eventNames && eventNames.length > 0) {
            for (const [index, eventName] of eventNames.entries()) {
                const [graphResponse] = await dataClient().runReport({
                    property: `properties/${propertyId}`,
                    dateRanges: [{
                        startDate: formattedFromDate,
                        endDate: formattedToDate,
                    }],
                    dimensions: [{ name: 'date' }],
                    metrics: [{ name: 'eventCount' }],
                    dimensionFilter: {
                        filter: {
                            fieldName: 'eventName',
                            stringFilter: { value: eventName },
                        },
                    },
                    granularity: { timeGranularity: 'DAY' },
                });

                let { datesArray, dataArray } = formatGraphResponse(graphResponse, formattedFromDate, formattedToDate);

                eventsData.graph[eventName] = {
                    labels: datesArray,
                    data: dataArray,
                };

                if (eventNames.length === (index + 1)) return sendResponse(res, SUCCESS, "Events Data", eventsData);
            };
        }
    } catch (error) {
        return errReturned(res, error);
    }
};

exports.getConversionsData = async (req, res) => {
    try {
        const { formattedFromDate, formattedToDate } = formatToFromDates(req.body.dates);
        const eventNames = ['first_open', 'Grocery', 'Beef', 'FriutsAndVegs', 'Cheese', 'Drinks', 'Flowers', 'CheckOut'];

        let conversionsData = {
            graph: {},
            table: [],
        };

        const [graphResponse] = await dataClient().runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{
                startDate: formattedFromDate,
                endDate: formattedToDate,
            }],
            dimensions: [{ name: 'date' }],
            metrics: [{ name: 'conversions' }],
            dimensionFilter: {
                filter: {
                    fieldName: 'eventName',
                    stringFilter: { value: 'first_open' },
                },
            },
            granularity: { timeGranularity: 'DAY' },
        });

        let { datesArray, dataArray } = formatGraphResponse(graphResponse, formattedFromDate, formattedToDate);

        conversionsData.graph['first_open'] = {
            labels: datesArray,
            data: dataArray,
        };

        const [tableResponse] = await dataClient().runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{
                startDate: formattedFromDate,
                endDate: formattedToDate,
            }],
            dimensions: [{ name: 'eventName' }],
            metrics: [
                { name: 'conversions' },
                { name: 'totalUsers' },
            ],
        });

        tableResponse.rows.forEach(row => {
            let eventName = row.dimensionValues[0].value;
            let conversions = Number(row.metricValues[0].value);
            let totalUsers = Number(row.metricValues[1].value);

            eventNames.includes(eventName) && conversionsData.table.push({
                eventName,
                conversions,
                totalUsers
            });
        });

        return sendResponse(res, SUCCESS, "Conversions Data", conversionsData);
    } catch (error) {
        return errReturned(res, error);
    }
};