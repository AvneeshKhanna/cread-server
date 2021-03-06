/**
 * Created by avnee on 20-07-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');

//TODO: Need to make it a local variable. If another router-endpoint in the same module uses the same var concurrently in future, it can lead to problems
var connection /*= config.createConnection*/;
var AWS = config.AWS;

var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');
var paytmCreds = envconfig.get('paytm-creds');

var paytm_server_url = paytmCreds.get('server-url');
var saleswalletguid = paytmCreds.get('sales-wallet-guid');
var merchantGuid = paytmCreds.get("merchant-guid");
var paytmMerchantKey = paytmCreds.get('merchant-key');

var uuidGen = require('uuid');
var httprequest = require('request');

var docClient = new AWS.DynamoDB.DocumentClient();

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');
var utils = require('../../utils/Utils');

var paytmchecksum = require('../../paytmutils/checksum');
var redeemutils = require('./RedeemUtils');

router.post('/', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var amount = request.body.amount;
    var userpaytmcontact = request.body.userpaytmcontact;
    var entityids = request.body.entityids;

    //TODO: Toggle comment
    //This has been done due to insufficient Paytm wallet balance but server records being updated nonetheless
    /*response.status(500).send({
        error: 'Some error occurred at the server'
    });
    response.end();
    return;*/

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var orderId = uuidGen.v4();
    var userdetails;
    var toInformViaContact;
    var commitTransaction;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
            userdetails = details;
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return utils.beginTransaction(connection);
        })
        .then(function () {
            return redeemutils.updateRDS(connection, uuid, orderId, amount, entityids);
        })
        /*
        .then(function (checksumhash) {
            return checkIfUserPaytmAccExists(amount, userpaytmcontact, orderId, checksumhash);
        })
        .then(function (status) {

            if (status == "SUCCESS") {
                return generatePaytmChecksumHash(paytmMerchantKey, userpaytmcontact, amount, orderId, null);
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
        })*/
        .then(function () {
            return redeemutils.generatePaytmChecksumHash(paytmMerchantKey, userpaytmcontact, amount, orderId, null);
        })
        .then(function (checksumhash) {
            return redeemutils.transactToPaytm(/*uuid, */amount, userpaytmcontact, orderId, checksumhash);
        })
        .then(function (status) {

            toInformViaContact = status === 'success';
            commitTransaction = status === 'success';

            response.send({
                tokenstatus: 'valid',
                data: {
                    status: status
                }
            });
            response.end();
        })
        .then(function () {
            if(commitTransaction){
                return utils.commitTransaction(connection);
            }
            else{
                return utils.rollbackTransaction(connection, undefined, new Error('Transaction could not go through due to an error'));
            }
        })
        .then(function () {
            if (toInformViaContact) {
                return redeemutils.informUserViaRegisteredContact(userdetails.firstname, userdetails.phone, amount, userpaytmcontact);
            }
            else {
                throw new BreakPromiseChainError();
            }
        })
        .catch(function (err) {

            config.disconnect(connection);

            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                if (!response.headersSent) {  //Because a case can arrive where informUserViaRegisteredContact() throws an error
                    response.status(500).send({
                        error: 'Some error occurred at the server'
                    });
                    response.end();
                }
            }

        });

});

/**
 * Sends a confirmation SMS to the user that the amount has been successfully transacted to Paytm
 * */
function informUserViaRegisteredContact(uuid, amount, userpaytmcontact) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT firstname, phoneNo FROM users WHERE uuid = ?', [uuid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {

                var msg = 'Hi ' +
                    row[0].firstname +
                    ',\nYour Cread earnings amounting to Rs. ' +
                    amount +
                    ' have been successfully transferred to the Paytm wallet attached to +91' +
                    userpaytmcontact;

                utils.sendAWSSMS(msg, row[0].phoneNo, function (err, data) {
                    if (err) {
                        reject(err);
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
 * Formulate request parameters to send to paytm servers
 * */
function getPaytmParams(userpaytmcontact, amount, orderId, requestType) {
    return paytm_params = {
        request: {
            requestType: requestType,
            merchantGuid: merchantGuid,//"52cd743e-2f83-41b8-8468-ea83daf909e7",
            merchantOrderId: orderId,
            salesWalletName: 'PaytmSubWallet',
            salesWalletGuid: saleswalletguid,
            payeeEmailId: null,
            payeePhoneNumber: userpaytmcontact,
            payeeSsoId: null,
            appliedToNewUsers: "N",     //Whether is would be applicable to users who do not have a paytm account attached to this phone
            amount: JSON.stringify(amount),
            currencyCode: "INR"
        },
        metadata: "Cread",
        ipAddress: "127.0.0.1",     //TODO: Check to change
        platformName: "PayTM",
        operationType: "SALES_TO_USER_CREDIT"
    };
}

/**
 * Function to check if user's paytm
 * */

/*
function checkIfUserPaytmAccExists(amount, userpaytmcontact, orderId, checksumhash) {
    console.log("checkIfUserPaytmAccExists called");
    return new Promise(function (resolve, reject) {

        // Set the headers
        var headers = {
            'checksumhash': checksumhash,
            'Content-Type': 'application/json',
            'mid': merchantGuid//'52cd743e-2f83-41b8-8468-ea83daf909e7'
        };

        // Configure the request
        var options = {
            url: paytm_server_url + "/wallet-web/salesToUserCredit",
            method: 'POST',
            headers: headers,
            body: JSON.stringify(getPaytmParams(userpaytmcontact, amount, orderId, "VERIFY"))  //Body parameter is required to be Sring or Buffer type
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
*/

function generatePaytmChecksumHash(aesKey, userpaytmcontact, amount, orderId, requestType) {
    return new Promise(function (resolve, reject) {

        paytmchecksum.genchecksumbystring(JSON.stringify(getPaytmParams(userpaytmcontact, amount, orderId, requestType)), aesKey, function (err, hash) {
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
function transactToPaytm(uuid, amount, userpaytmcontact, orderId, checksumhash) {
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
                            'JOIN Campaign ' +
                            'ON Share.cmid = Campaign.cmid ' +
                            'SET Share.cashed_in = ?, Share.transid = ? ' +
                            'WHERE Share.checkstatus = ? ' +
                            'AND Share.UUID = ? ' +
                            'AND Campaign.main_feed = ?', [true, usrtransparams.transid, 'COMPLETE', uuid, true], function (err, row) {

                            if (err) {
                                connection.rollback(function () {
                                    console.log('Transaction rollbacked');
                                    reject(err);
                                });
                            }
                            else {

                                //Updating Checks table
                                connection.query('UPDATE Checks ' +
                                    'SET cashed_in = 1, transid = ? ' +
                                    'WHERE UUID = ? ' +
                                    'AND cashed_in = 0', [usrtransparams.transid, uuid], function (err, data) {

                                    if (err) {
                                        connection.rollback(function () {
                                            console.log('Transaction rollbacked');
                                            reject(err);
                                        });
                                    }
                                    else {

                                        // Set the headers
                                        var headers = {
                                            'checksumhash': checksumhash,
                                            'Content-Type': 'application/json',
                                            'mid': merchantGuid   //Provided by Paytm
                                        };

                                        // Configure the request
                                        var options = {
                                            url: paytm_server_url + "/wallet-web/salesToUserCredit",
                                            method: 'POST',
                                            headers: headers,
                                            body: JSON.stringify(getPaytmParams(userpaytmcontact, amount, orderId, null))  //Body parameter is required to be Sring or Buffer type
                                        };

                                        console.log("request to paytm is " + JSON.stringify(options, null, 3));

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

                                                if (resbody.status === "SUCCESS") {
                                                    connection.commit(function (err) {
                                                        if (err) {  //Could be a caveat, if this happens, paytm transactions would go through but our records won't be updated
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
                                                else if (resbody.status === "FAILURE") {
                                                    connection.rollback(function () {
                                                        console.log('Transaction rollbacked');

                                                        if (resbody.statusCode === 'GE_1032') {    //Case of invalid mobile number
                                                            resolve('invalid-contact');
                                                        }
                                                        else if (resbody.statusCode === 'STUC_1002') { //Payee record not found, please verify emailId/ssoId.
                                                            resolve("invalid-user");
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

                });

            }
        });
    });

}

module.exports = router;