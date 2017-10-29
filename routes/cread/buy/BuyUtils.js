/**
 * Created by avnee on 27-10-2017.
 */
'use-strict';

function loadAllProducts(connection){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Product.productid, Product.type, Product.imageurl as productimgurl ' +
            'FROM Product', null, function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

function saveOrderDetails(connection, sqlparams) {
    return new Promise(function (resolve, reject) {
        connection.query('INSERT INTO Order SET ?', [sqlparams], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

module.exports = {
    loadAllProducts: loadAllProducts,
    saveOrderDetails: saveOrderDetails
};