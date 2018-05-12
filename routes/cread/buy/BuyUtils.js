/**
 * Created by avnee on 27-10-2017.
 */
'use-strict';

var Razorpay = require('razorpay');
var envconfig = require('config');
var moment = require('moment');

var razorpay_creds = envconfig.get("razorpay-creds");
var envtype = envconfig.get("type");

var utils = require('../utils/Utils');
var entityutils = require('../entity/EntityUtils');
var updatesutils = require('../updates/UpdatesUtils');

var NotFoundError = require('../utils/NotFoundError');

var rzrinstance = new Razorpay({
    key_id: razorpay_creds.key_id,
    key_secret: razorpay_creds.key_secret
});

function loadOrdersForPrint(connection, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.entityid, Entity.type, Short.shoid, Capture.capid, UserS.uuid AS suuid, ' +
            'UserC.uuid AS cuuid, Orders.orderid, Orders.regdate ' +
            'FROM Orders ' +
            'JOIN Entity ' +
            'USING(entityid) ' +
            'LEFT JOIN Short ' +
            'ON Entity.entityid = Short.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Entity.entityid = Capture.entityid ' +
            'LEFT JOIN User AS UserS ' +
            'ON Short.uuid = UserS.uuid ' +
            'LEFT JOIN User AS UserC ' +
            'ON Capture.uuid = UserC.uuid ' +
            'WHERE Orders.regdate < ? ' +
            'ORDER BY Orders.regdate DESC ' +
            'LIMIT ?', [lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                if (rows.length > 0) {

                    rows.map(function (elem) {
                        if (elem.type === 'SHORT') {
                            elem.entityurl = utils.createSmallShortUrl(elem.suuid, elem.shoid);
                        }
                        else if (elem.type === 'CAPTURE') {
                            elem.entityurl = utils.createSmallCaptureUrl(elem.cuuid, elem.capid);
                        }

                        if (elem.hasOwnProperty('cuuid')) {
                            delete elem.cuuid;
                        }

                        if (elem.hasOwnProperty('suuid')) {
                            delete elem.suuid;
                        }

                        if (elem.hasOwnProperty('shoid')) {
                            delete elem.shoid;
                        }

                        if (elem.hasOwnProperty('capid')) {
                            delete elem.capid;
                        }

                    });

                    var feedEntityids = rows.map(function (e) {
                        return e.entityid;
                    });

                    entityutils.getEntityDetailsForPrint(connection, feedEntityids)
                        .then(function (items) {

                            items.forEach(function (item) {
                                var indexes = utils.getAllIndexes(feedEntityids, item.entityid); //feedEntityids.indexOf(item.entityid);
                                indexes.forEach(function (index) {
                                    for (var key in item) {
                                        rows[index][key] = item[key];
                                    }
                                })
                            });

                            resolve({
                                requestmore: rows.length >= limit,
                                lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                                items: rows
                            });

                        })
                        .catch(function (err) {
                            reject(err);
                        });
                }
                else {
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: null,
                        items: rows
                    });
                }
            }
        });
    });
}

function loadAllProducts(connection) {
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

function loadProduct(connection, productid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Product.productid, Product.type, Product.imageurl as productimgurl ' +
            'FROM Product ' +
            'WHERE productid = ?', [productid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                if(rows.length === 0){
                    reject(new NotFoundError("Invalid 'productid'"));
                    return;
                }

                resolve(rows);
            }
        });
    });
}

function saveOrderDetails(connection, sqlparams) {
    return new Promise(function (resolve, reject) {
        connection.query('INSERT INTO Orders SET ?', [sqlparams], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

/**
 * This method captures a pending (or authorized) payment from Razorpay.
 * For more info, read: <a href="https://docs.razorpay.com/docs">https://docs.razorpay.com/docs</a>
 * */
function captureRazorpayPayment(connection, paymentid, amount) {
    return new Promise(function (resolve, reject) {
        rzrinstance.payments.capture(paymentid, amount, function (err, rzrresponse) {
            if (err) {
                reject(err);
            }
            else {
                console.log("razorpay response " + JSON.stringify(rzrresponse, null, 3));
                resolve(rzrresponse);
            }
        });
    })
}

function convertINRtoPaise(amount) {
    return amount * 100;
}

function convertPaiseToINR(amount) {
    return parseFloat(amount / 100);
}

function updateBuyDataForUpdates(connection, uuid, actor_uuid, entityid, other_collaborator, productid) {
    return new Promise(function (resolve, reject) {

        var updateparams = {
            uuid: uuid,
            actor_uuid: actor_uuid,
            entityid: entityid,
            category: 'buy',
            other_collaborator: other_collaborator,
            productid: productid
        };

        updatesutils.addToUpdatesTable(connection, updateparams)
            .then(resolve)
            .catch(function (err) {
                reject(err);
            });
    });
}

module.exports = {
    loadAllProducts: loadAllProducts,
    loadProduct: loadProduct,
    saveOrderDetails: saveOrderDetails,
    loadOrdersForPrint: loadOrdersForPrint,
    captureRazorpayPayment: captureRazorpayPayment,
    updateBuyDataForUpdates: updateBuyDataForUpdates,
    convertINRtoPaise: convertINRtoPaise,
    convertPaiseToINR: convertPaiseToINR
};