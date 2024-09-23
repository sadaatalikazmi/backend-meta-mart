'use strict';

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

exports.dataClient = () => {
    const serviceAccount = {
        "type": process.env.GOOGLE_ANALYTICS_TYPE,
        "project_id": process.env.GOOGLE_ANALYTICS_PROJECT_ID,
        "private_key_id": process.env.GOOGLE_ANALYTICS_PRIVATE_KEY_ID,
        "private_key": process.env.GOOGLE_ANALYTICS_PRIVATE_KEY,
        "client_email": process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL,
        "client_id": process.env.GOOGLE_ANALYTICS_CLIENT_ID,
        "auth_uri": process.env.GOOGLE_ANALYTICS_AUTH_URI,
        "token_uri": process.env.GOOGLE_ANALYTICS_TOKEN_URI,
        "auth_provider_x509_cert_url": process.env.GOOGLE_ANALYTICS_AUTH_PROVIDER_X509_CERT_URL,
        "client_x509_cert_url": process.env.GOOGLE_ANALYTICS_CLIENT_X509_CERT_URL,
        "universe_domain": process.env.GOOGLE_ANALYTICS_UNIVERSITY_DOMAIN
    };

    const analyticsDataClient = new BetaAnalyticsDataClient({ credentials: serviceAccount });

    return analyticsDataClient;
};

exports.formatToFromDates = (dates) => {
    let fromDate = new Date();
    let toDate = new Date();

    if (dates && dates !== null && Object.keys(dates).length > 0 && dates?.fromDate !== null && dates?.toDate !== null) {
        fromDate = new Date(dates.fromDate);
        toDate = new Date(dates.toDate);
    } else {
        fromDate.setDate(toDate.getDate() - 30);
    }

    const formattedFromDate = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
    const formattedToDate = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;

    return { formattedFromDate, formattedToDate };
};

exports.formatDate = (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const year = date.slice(0, 4);
    const month = months[Number(date.slice(4, 6)) - 1];
    const day = date.slice(6, 8);

    const formattedDate = `${day} ${month} ${year}`;

    return formattedDate;
};

exports.getDatesBetweenRange = (startDate, endDate) => {
    const dates = [];
    let currentDate = new Date(startDate);
    endDate = new Date(endDate);

    while (currentDate <= endDate) {
        dates.push(this.formatDate(new Date(currentDate).toISOString().slice(0, 10).replace(/-/g, '')));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
};

exports.formatGraphResponse = (graphResponse, formattedFromDate, formattedToDate) => {
    let datesArray = this.getDatesBetweenRange(formattedFromDate, formattedToDate);
    let dataArray = Array(datesArray.length).fill(0);

    graphResponse.rows.forEach(row => {
        if (datesArray.includes(this.formatDate(row.dimensionValues[0].value))) {
            const dateIndex = datesArray.indexOf(this.formatDate(row.dimensionValues[0].value));
            dataArray[dateIndex] = Number(row.metricValues[0].value);
        }
    });

    return { datesArray, dataArray };
};