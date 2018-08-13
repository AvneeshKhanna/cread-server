/**
 * Created by avnee on 01-12-2017.
 */
'use-strict';

const envconfig = require('config');
const userstbl_ddb = envconfig.get('dynamoDB.users_table');
const paytmCreds = envconfig.get('paytm-creds');

const paytm_server_url = paytmCreds.get('server-url');
const saleswalletguid = paytmCreds.get('sales-wallet-guid');
const merchantGuid = paytmCreds.get("merchant-guid");
const paytmMerchantKey = paytmCreds.get('merchant-key');

const uuidGen = require('uuid');
const httprequest = require('request');

const paytmchecksum = require('../../paytmutils/checksum');
const utils = require('../../utils/Utils');

/**
 * Sends a confirmation SMS to the user that the amount has been successfully transacted to Paytm
 * */
function informUserViaRegisteredContact(name, phone, amount, userpaytmcontact){
    return new Promise(function (resolve, reject) {
        let msg = 'Hi ' +
            name +
            ',\nYour Cread earnings amounting to Rs. ' +
            amount +
            ' have been successfully transferred to the Paytm wallet attached to ' +
            userpaytmcontact;

        utils.sendAWSSMS(msg, phone, function (err, data) {
            if(err){
                reject(err);
            }
            else{
                resolve();
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

function updateRDS(connection, uuid, orderId, amount, entityids) {
    return new Promise(function (resolve, reject) {

        let usrtransparams = {
            transacid: uuidGen.v4(),
            uuid: uuid,
            paytmOrderId: orderId,
            amount: amount
        };

        connection.query('INSERT INTO UserWalletTransaction SET ?', [usrtransparams], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                //Updating Orders table
                connection.query('UPDATE Orders ' +
                    'SET sroyaltytransacid = CASE WHEN(shortuuid = ? AND sroyaltytransacid IS NULL) THEN ? ELSE sroyaltytransacid END, ' +
                    'croyaltytransacid = CASE WHEN(captureuuid = ? AND croyaltytransacid IS NULL) THEN ? ELSE croyaltytransacid END '
                    , [uuid, usrtransparams.transacid, uuid, usrtransparams.transacid], function (err, updated) {
                    if(err){
                        reject(err);
                    }
                    else{
                        resolve();
                    }
                });
            }
        });
    });
}

/**
 * Function to transact amount to user's paytm wallet
 * */
function transactToPaytm(/*uuid, */amount, userpaytmcontact, orderId, checksumhash) {
    console.log("transactToPaytm called");
    return new Promise(function (resolve, reject) {
        // Set the headers
        let headers = {
            'checksumhash': checksumhash,
            'Content-Type': 'application/json',
            'mid': merchantGuid   //Provided by Paytm
        };

        // Configure the request
        let options = {
            url: paytm_server_url + "/wallet-web/salesToUserCredit",
            method: 'POST',
            headers: headers,
            body: JSON.stringify(getPaytmParams(userpaytmcontact, amount, orderId, null))  //Body parameter is required to be Sring or Buffer type
        };

        console.log("request to paytm is " + JSON.stringify(options, null, 3));

        httprequest(options, function (err, res, body) {

            if (err) {
                reject(err);
            }
            else {

                let resbody = JSON.parse(body);
                console.log("paytm response resbody is " + JSON.stringify(resbody, null, 3));

                if (resbody.status === "SUCCESS") {
                    resolve("success");
                }
                else if (resbody.status === "FAILURE") {
                    if (resbody.statusCode === 'GE_1032') {    //Case of invalid mobile number
                        resolve('invalid-contact');
                    }
                    else if(resbody.statusCode === 'STUC_1002'){ //Payee record not found, please verify emailId/ssoId.
                        resolve("invalid-user");
                    }
                    else {
                        reject(new Error(resbody.statusMessage));
                    }
                }
                else {   //resbody.status == "PENDING"
                    resolve("invalid-user");
                }

            }

        });

    });

}

module.exports = {
    informUserViaRegisteredContact: informUserViaRegisteredContact,
    generatePaytmChecksumHash: generatePaytmChecksumHash,
    transactToPaytm: transactToPaytm,
    updateRDS: updateRDS
};