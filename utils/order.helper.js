'use strict';

exports.getOrdersBetweenDatesQuery = (filters) => {
    const fetchOrdersQuery = `
        SELECT o.orderNumber, o.status, o.id AS orderId,
            u.gender AS userGender, u.id AS userId, u.name AS userName, u.country AS userCountry,
            o.totalAmount, o.currency, o.reciptUrl, o.transactionId, o.createdAt, o.updatedAt,
            i.id AS itemId, i.quantity AS itemQuantity,
            p.currency AS productCurrency, p.id AS productId, p.name AS productName,
            p.description AS productDescription, p.quantity AS productQuantity, p.createdAt AS productCreatedAt, p.updatedAt AS productUpdatedAt,
            p.file AS productFile, p.price AS productPrice, p.productSize, p.type AS productType,
            p.imageUrl AS productImageUrl, p.currency AS productCurrency
        FROM orders o
        INNER JOIN users u ON o.userId = u.id
        LEFT JOIN order_items oi ON oi.orderId = o.id
        LEFT JOIN products p ON p.id = oi.productId
        LEFT JOIN order_items i ON i.id = oi.id
        WHERE o.createdAt BETWEEN ? AND ?
    `;

    let fromDate = new Date();
    let toDate = new Date();

    if (Object.keys(filters).length > 0 && filters?.fromDate !== null && filters?.toDate !== null) {
        fromDate = new Date(filters.fromDate);
        toDate = new Date(filters.toDate);
    } else {
        fromDate.setDate(toDate.getDate() - 30);
    }

    return { fetchOrdersQuery, fromDate, toDate };    
};