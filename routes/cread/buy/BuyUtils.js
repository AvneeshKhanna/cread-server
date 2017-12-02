/**
 * Created by avnee on 27-10-2017.
 */
'use-strict';

var Razorpay = require('razorpay');
var envconfig = require('config');

var razorpay_creds = envconfig.get("razorpay-creds");
var envtype = envconfig.get("type");

var rzrinstance = new Razorpay({
    key_id: razorpay_creds.key_id,
    key_secret: razorpay_creds.key_secret
});


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

module.exports = {
    loadAllProducts: loadAllProducts,
    saveOrderDetails: saveOrderDetails,
    captureRazorpayPayment: captureRazorpayPayment,
    convertINRtoPaise: convertINRtoPaise,
    convertPaiseToINR: convertPaiseToINR
};