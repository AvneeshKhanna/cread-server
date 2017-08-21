/**
 * Created by avnee on 16-07-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;
var AWS = config.AWS;
var uuidGen = require('uuid');
var Razorpay = require('razorpay');

var rzrinstance = new Razorpay({
    key_id: 'rzp_test_Q09427lQA9Ol5g',
    key_secret: 'NWyy1f1z88NRXFbjGDpjxmXH'
});

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

router.post('/add-balance', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var amount = convertPaiseToINR(request.body.amount);    //Amount requested in paise
    var type = "ADD";   //Type of transaction. Values: 'ADD' or 'REMOVE'
    var paymentid = request.body.paymentid; //ID of the payment transacted through payment gateway portal

    _auth.clientAuthValid(clientid, authkey)
        .then(function (client) {
            return addTransactionToTable(clientid, amount, type, paymentid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function () {
            return updateClientWalletBalance(clientid, amount)
        })
        .then(function () {
            return captureRazorpayPayment(paymentid, convertINRtoPaise(amount));
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function () {
            return sendTranscDetailsToUser(email);
        })
        .catch(function (err) {
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });
});

function addTransactionToTable(clientid, amount, type, paymentid) {
    return new Promise(function (resolve, reject) {
        connection.beginTransaction(function (err) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {
                var params = {
                    amount: amount,
                    type: type,
                    gateway_paymentid: paymentid,
                    clientid: clientid,
                    transid: uuidGen.v4()
                };

                connection.query('INSERT INTO WalletTransaction SET ?', [params], function (err, row) {
                    if (err) {
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else {
                        resolve();
                    }
                });
            }
        });

    });
}

function updateClientWalletBalance(clientid, amount) {
    return new Promise(function (resolve, reject) {

        connection.query('SELECT clientid, walletbalance FROM Client WHERE clientid = ? FOR UPDATE', [clientid], function (err, rows) {

            console.log('SELECT...FOR UPDATE updateClientWalletBalance query executed');

            if (err) {
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {

                var newbalance = parseFloat(rows[0].walletbalance) + parseFloat(amount);

                /*if(type == 'ADD'){
                 newbalance = rows[0].walletbalance + amount;
                 }
                 else{   //Case when client issues for a  refund
                 newbalance = 0;
                 }*/

                connection.query('UPDATE Client SET walletbalance = ? WHERE clientid = ?', [newbalance, clientid], function (err, qdata) {

                    console.log("UPDATE query updateClientWalletBalance executed");

                    if (err) {
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else {
                        resolve();
                    }

                });
            }

        });

    });
}

/**
 * This method captures a pending (or authorized) payment from Razorpay.
 * For more info, read: <a href="https://docs.razorpay.com/docs">https://docs.razorpay.com/docs</a>
 * */
function captureRazorpayPayment(paymentid, amount) {
    return new Promise(function (resolve, reject) {
        rzrinstance.payments.capture(paymentid, amount, function (err, rzrresponse) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {
                connection.commit(function (err) {
                    if(err){
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else {
                        console.log("razorpay response " + JSON.stringify(rzrresponse, null, 3));
                        console.log('TRANSACTION committed successfully');
                        resolve(rzrresponse);
                    }
                })
            }
        });
    })
}

function convertINRtoPaise(amount) {
    return amount * 100;
}

function convertPaiseToINR(amount) {
    return parseFloat(amount/100);
}

//TODO: Implement
function sendTranscDetailsToUser(email) {
    return new Promise(function (resolve, reject) {
        resolve();
    });
}

router.post('/initiate-refund', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;

    _auth.clientAuthValid(clientid, authkey)
        .then(function (client) {
            return reduceWalletBalanceToZero(clientid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (result) {
            if(result.status === 'zero-balance'){
                response.send({
                    tokenstatus: 'valid',
                    data: {
                        status: result.status
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
            else{
                return addRefundToDB(clientid, 'REFUND', result.amount);
            }
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

/**
 * Function to register a record in WalletTransaction table to initiate a refund to the client
 * */
function addRefundToDB(clientid, type, amount) {
    return new Promise(function (resolve, reject) {

        var params = {
            amount: amount,
            type: type,
            gateway_paymentid: null,
            refundstatus: "PENDING",
            clientid: clientid,
            transid: uuidGen.v4()
        };

        connection.query('INSERT INTO WalletTransaction SET ?', [params], function (err, data) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {
                connection.commit(function (err) {
                    if(err){
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else {
                        resolve();
                    }
                });
            }
        });
    });
}

function reduceWalletBalanceToZero(clientid) {
    return new Promise(function (resolve, reject) {
        connection.beginTransaction(function (err) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else{
                connection.query('SELECT walletbalance FROM Client WHERE clientid = ? FOR UPDATE', [clientid], function (err, row) {
                    if(err){
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else{
                        if(row[0].walletbalance === 0){

                            connection.commit(function (err) {
                                if(err){
                                    connection.rollback(function () {
                                        reject(err);
                                    });
                                }
                                else{
                                    resolve({
                                        status: 'zero-balance'
                                    });
                                }
                            });
                        }
                        else {
                            connection.query('UPDATE Client SET walletbalance = ? WHERE clientid = ?', [0, clientid], function (err, data) {
                                if(err){
                                    connection.rollback(function () {
                                        reject(err);
                                    });
                                }
                                else{
                                    resolve({
                                        status: 'proceed',
                                        amount: row[0].walletbalance
                                    });
                                }
                            });
                        }
                    }
                });
            }
        });
    });
}

module.exports = router;