/**
 * Created by avnee on 20-07-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');
var paytm_server_url = envconfig.get('paytm-server-url');

var uuidGen = require('uuid');
var httprequest = require('request');

var docClient = new AWS.DynamoDB.DocumentClient();

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

var paytmchecksum = require('../../paytmutils/checksum');
var paytmMerchantKey = 'SY#F6vL_Yke1ey&w';  //Provided by Paytm

var orderId;

router.post('/', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var amount = request.body.amount;
    var userpaytmcontact = request.body.userpaytmcontact;

    console.log("request is " + JSON.stringify(request.body, null, 3));

    orderId = uuidGen.v4();

    console.log("orderId is " + JSON.stringify(orderId, null, 3));

    _auth.authValid(uuid, authkey)
        .then(function () {
            return generatePaytmChecksumHash(paytmMerchantKey, userpaytmcontact, amount, "VERIFY");
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (checksumhash) {
            return checkIfUserPaytmAccExists(amount, userpaytmcontact, checksumhash);
        })
        .then(function (status) {

            if (status == "SUCCESS") {
                return generatePaytmChecksumHash(paytmMerchantKey, userpaytmcontact, amount, null);
            }
            else {  //status == "NOT-FOUND"
                response.send({
                    tokenstatus: 'valid',
                    data: {
                        status: 'invalid-user'
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
        })
        .then(function (checksumhash) {
            return transactToPaytm(uuid, amount, userpaytmcontact, checksumhash);
        })
        .then(function (status) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: status
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {

            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                });
                response.end();
            }

        });

});

/**
 * Formulate request parameters to send to paytm servers
 * */
function getPaytmParams(userpaytmcontact, amount, requestType) {
    return paytm_params = {
        request: {
            requestType: requestType,
            merchantGuid: "52cd743e-2f83-41b8-8468-ea83daf909e7",
            merchantOrderId: orderId/*uuid.v4()*/,
            salesWalletName: null,
            salesWalletGuid: "05d92f1a-e603-4df4-9034-000c8363dd7b",
            payeeEmailId: null,
            payeePhoneNumber: userpaytmcontact,
            payeeSsoId: null,
            appliedToNewUsers: "Y",
            amount: JSON.stringify(amount),
            currencyCode: "INR"
        },
        metadata: "Testing Data",
        ipAddress: "127.0.0.1",     //TODO: Check to change
        platformName: "PayTM",
        operationType: "SALES_TO_USER_CREDIT"
    };
}

/**
 * Function to check if user's paytm
 * */
function checkIfUserPaytmAccExists(amount, userpaytmcontact, checksumhash) {
    console.log("checkIfUserPaytmAccExists called");
    return new Promise(function (resolve, reject) {

        // Set the headers
        var headers = {
            'checksumhash': checksumhash,
            'Content-Type': 'application/json',
            'mid': '52cd743e-2f83-41b8-8468-ea83daf909e7'
        };

        // Configure the request
        var options = {
            url: paytm_server_url + "/wallet-web/salesToUserCredit",
            method: 'POST',
            headers: headers,
            body: JSON.stringify(getPaytmParams(userpaytmcontact, amount, "VERIFY"))  //Body parameter is required to be Sring or Buffer type
        };

        httprequest(options, function (err, res, body) {

            if (err) {
                reject(err);
            }
            else {
                if (body.status == "PENDING") {   //Payee wallet could not be found
                    resolve("NOT-FOUND");
                }
                else if (body.status == "FAILURE") {  //Invalid merchantOrderId, systemTxnRequest with given merchantOrderId already exist
                    reject(err);
                }
                else {  //status == "SUCCESS"
                    resolve("SUCCESS");
                }
            }

        });

    });
}

function generatePaytmChecksumHash(aesKey, userpaytmcontact, amount, requestType) {
    return new Promise(function (resolve, reject) {

        paytmchecksum.genchecksumbystring(JSON.stringify(getPaytmParams(userpaytmcontact, amount, requestType)), aesKey, function (err, hash) {
            if (err) {
                reject(err);
            }
            else {
                console.log('checksum hash is ' + hash);
                resolve(hash);
            }
        });
    });
}

/**
 * Function to transact amount to user's paytm wallet
 * */
function transactToPaytm(uuid, amount, userpaytmcontact, checksumhash) {
    console.log("transactToPaytm called");
    return new Promise(function (resolve, reject) {

        connection.beginTransaction(function (err) {
            if (err) {
                connection.rollback(function () {
                    console.log('Transaction rollbacked');
                    reject(err);
                });
            }
            else {

                var usrtransparams = {
                    transid: uuidGen.v4(),
                    uuid: uuid,
                    paytmOrderId: orderId,
                    amount: amount
                };

                //Adding transaction to UserWalletTransaction table
                connection.query('INSERT INTO UsersWalletTransaction SET ?', [usrtransparams], function (err, row) {

                    if (err) {
                        connection.rollback(function () {
                            console.log('Transaction rollbacked');
                            reject(err);
                        });
                    }
                    else {

                        //Updating Share table
                        connection.query('UPDATE Share ' +
                            'JOIN Checks ' +
                            'ON Share.shareid = Checks.shareid ' +
                            'SET Share.cashed_in = ?, Share.transid = ? ' +
                            'WHERE Checks.responses = ? AND Share.UUID = ?', [1, usrtransparams.transid, 'verified', uuid], function (err, row) {

                            if (err) {
                                connection.rollback(function () {
                                    console.log('Transaction rollbacked');
                                    reject(err);
                                });
                            }
                            else {

                                //Updating Checks table
                                connection.query('UPDATE Checks ' +
                                    'SET Checks.cashed_in = 1, Checks.transid = ? ' +
                                    'WHERE Checks.UUID = ?', [usrtransparams.transid, uuid], function (err, data) {

                                    if (err) {
                                        connection.rollback(function () {
                                            console.log('Transaction rollbacked');
                                            reject(err);
                                        });
                                    }
                                    else {

                                        /*var paytm_params = {
                                         request: {
                                         requestType: "VERIFY",
                                         merchantGuid: "52cd743e-2f83-41b8-8468-ea83daf909e7",
                                         merchantOrderId: "123112q",
                                         salesWalletName: null,
                                         salesWalletGuid: "05d92f1a-e603-4df4-9034-000c8363dd7b",
                                         payeeEmailId: null,
                                         payeePhoneNumber: userpaytmcontact,
                                         payeeSsoId: null,
                                         appliedToNewUsers: "Y",
                                         amount: "10",
                                         currencyCode: "INR"
                                         },
                                         metadata: "Testing Data",
                                         ipAddress: "122.161.164.208",
                                         platformName: "PayTM",
                                         operationType: "SALES_TO_USER_CREDIT"
                                         };*/

                                        // Set the headers
                                        var headers = {
                                            'checksumhash': checksumhash,
                                            'Content-Type': 'application/json',
                                            'mid': '52cd743e-2f83-41b8-8468-ea83daf909e7'   //Provided by Paytm
                                        };

                                        // Configure the request
                                        var options = {
                                            url: paytm_server_url + "/wallet-web/salesToUserCredit",
                                            method: 'POST',
                                            headers: headers,
                                            body: JSON.stringify(getPaytmParams(userpaytmcontact, amount, null))  //Body parameter is required to be Sring or Buffer type
                                        };

                                        httprequest(options, function (err, res, body) {

                                            if (err) {
                                                connection.rollback(function () {
                                                    console.log('Transaction rollbacked');
                                                    reject(err);
                                                });
                                            }
                                            else {

                                                var resbody = JSON.parse(body);
                                                console.log("paytm response resbody is " + JSON.stringify(resbody, null, 3));

                                                if (resbody.status == "SUCCESS") {
                                                    connection.commit(function (err) {
                                                        if (err) {
                                                            connection.rollback(function () {
                                                                console.log('Transaction rollbacked');
                                                                reject(err);
                                                            });
                                                        }
                                                        else {
                                                            console.log('Transaction committed');
                                                            resolve("success");
                                                        }
                                                    });
                                                }
                                                else if (resbody.status == "FAILURE") {
                                                    connection.rollback(function () {
                                                        console.log('Transaction rollbacked');

                                                        if (resbody.statusCode == 'GE_1032') {    //Case of invalid mobile number
                                                            resolve('invalid-contact');
                                                        }
                                                        else {
                                                            reject(new Error(resbody.statusMessage));
                                                        }
                                                    });
                                                }
                                                else {   //resbody.status == "PENDING"
                                                    connection.rollback(function () {
                                                        console.log('Transaction rollbacked');
                                                        resolve("invalid-user");
                                                    });
                                                }

                                            }

                                        });

                                    }

                                });

                            }

                        });

                    }

                })

            }
        });
    });

}

module.exports = router;