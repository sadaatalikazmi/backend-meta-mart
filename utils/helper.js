'use strict';

const nodemailer = require('nodemailer');
const FCM = require('fcm-node');
const fcm = new FCM(process.env.FIREBASE_SEVER_KEY);


const insertQuery = (table, columns) => {
    if (!table || !columns || !columns.length) return new Error('Invalid query parameters');

    const columnsClause = columns.map(column => `${column}`).join(', ');
    const valuesClause = columns.map(column => '?').join(', ');

    const insertQuery = `INSERT INTO ${table} (${columnsClause}) VALUES (${valuesClause})`;

    return insertQuery;
};

const selectQuery = (selection, table, reference = '') => {
    if (!selection || !table) return new Error('Invalid query parameters');

    const selectQuery = reference === ''
        ? `SELECT ${selection} FROM ${table}`
        : `SELECT ${selection} FROM ${table} WHERE ${reference} = ?`;

    return selectQuery;
};

const updateQuery = (table, columns, reference) => {
    if (!table || !columns || !columns.length || !reference) return new Error('Invalid query parameters');

    const setClause = columns.map(column => `${column} = ?`).join(', ');

    const updateQuery = `UPDATE ${table} SET ${setClause} WHERE ${reference} = ?`;

    return updateQuery;
};

const deleteQuery = (table, reference) => {
    if (!table || !reference) return new Error('Invalid query parameters');

    const deleteQuery = `DELETE FROM ${table} WHERE ${reference} = ?`;

    return deleteQuery;
};

const sendEmail = (emailAddress, subject, body) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.NODEMAILER_USER,
            pass: process.env.NODEMAILER_PASSWORD,
        }
    });

    const mailOptions = {
        from: `"Admin Meta-Mart" <${process.env.NODEMAILER_USER}>`,
        to: emailAddress,
        subject: subject,
        text: body,
        html: `<p>${body}</p>`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.error('Error:', error);
        }
        console.log('Email sent:', info.response);
    });
};

const formatWord = (str) => str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

const sendFirebaseNotification = (fcmToken, title = "Coca Cola", body = "Add is Placed") => {
    let message = {
        to: fcmToken,
        notification: {
            title: title,
            body: body
        },

        // data: {  //you can send only notification or only data(or include both)
        //     my_key: 'my value',
        //     my_another_key: 'my another value'
        // }
    };

    fcm.send(message, function (err, response) {
        if (err) console.log("Something has gone wrong!");
        else console.log("Successfully sent with response: ", response);
    });
};

module.exports = {
    insertQuery,
    selectQuery,
    updateQuery,
    deleteQuery,
    sendEmail,
    formatWord,
    sendFirebaseNotification,
}