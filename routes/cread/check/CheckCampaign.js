/**
 * Created by avnee on 15-06-2017.
 */
'use strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var AWS = config.AWS;

var _auth = require('../../auth-token-management/AuthTokenManager');
var notify = require('../../notification-system/notificationFramework');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var uuidGenerator = require('uuid');

var utils = require('../utils/Utils');
var consts = require('../utils/Constants');

var VERIFIED = 'verified';
var ABSENT_PROFILE = 'absent-profile';
var WRONG_PERSON = 'wrong-person';
var ABSENT_SHARE = 'absent-share';

/**
 * To serve user's request to check another user's share
 * */
router.post('/request', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
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
            return getDataForCheck(uuid, connection);
        })
        .then(function (result) {

            var row = result.row;

            if (row === undefined) {    //Case of no data
                console.log("row before response " + JSON.stringify(row, null, 3));
                response.send({
                    tokenstatus: 'valid',
                    data: {}
                });
                response.end();
                throw new BreakPromiseChainError();
            }
            else {
                row.accountstatus = result.accountstatus;
                row.verificationurl = utils.updateQueryStringParameter(row.verificationurl, row.ulinkkey, row.ulinkvalue);

                /*if(row.hasOwnProperty("ulinkkey")){
                 delete row.ulinkkey;
                 }
                 if(row.hasOwnProperty("ulinkvalue")){
                 delete row.ulinkvalue;
                 }*/

                row.fbuserlink = "https://www.facebook.com/login.php?next=" + encodeURIComponent("https://www.facebook.com/" + row.fbusername);

                if (row.hasOwnProperty("fbusername")) {
                    delete row.fbusername;
                }

                //TODO: Make the check rate dynamic
                row.checkrate_verified = consts.checkrate_verified;
                row.checkrate_not_verified = consts.checkrate_not_verified;

                console.log("row is " + JSON.stringify(row, null, 3));

                response.send({
                    tokenstatus: 'valid',
                    data: row
                });
                response.end();
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
                response.status(500).send({
                    error: 'Some error occurred at the server'
                });
                response.end();
            }
        });

});

/**
 * Function to retrieve a random user's data from the profile who has shared a given campaign
 * */
function getDataForCheck(uuid, connection) {

    return new Promise(function (resolve, reject) {

        //Here, SQL's TRANSACTION functions are used because between the 'SELECT...FOR UPDATE' and 'UPDATE' query, we would
        // not want any other session to update that specific record. connection.beginTransaction() ensures so.
        // NOTE: calling connection.commit() or connection.rollback() is necessary after calling connection.beginTransaction()
        // in the same session
        connection.beginTransaction(function (err) {
            if (err) {
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {
                connection.query('SELECT accountstatus FROM users WHERE UUID = ?', [uuid], function (err, userdata) {
                    if(err){
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else if(userdata[0].accountstatus === "DISABLED"){
                        connection.commit(function (err) {
                            if(err){
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else{
                                resolve({
                                    accountstatus: (userdata[0].accountstatus === "DISABLED") //true for account-suspension, false otherwise
                                });
                            }
                        });
                    }
                    else{
                        //Retrieve a user's share data for a given cmid who has shared within the last 24 hours and has not been verified
                        connection.query('SELECT Share.sharerate, Share.regdate AS sharetime, Share.shareid, Share.ulinkkey, Share.ulinkvalue, ' +
                            '(CASE WHEN(Checks.UUID IS NULL) THEN "INVALID" ELSE Checks.UUID END) AS checkerid, ' + //Since NULL values in SQL cannot be compared with <>, it has to be converted into a NON-NULL value like 'INVALID' in this case
                            'Campaign.cmid, Campaign.contentbaseurl AS verificationurl, Campaign.title, Campaign.description, Campaign.imagepath, ' +
                            'users.firstname, users.UUID AS sharerid, users.fbusername ' +
                            'FROM Share ' +
                            'JOIN users ' +
                            'ON Share.UUID = users.UUID ' +
                            'JOIN Campaign ' +
                            'ON Campaign.cmid = Share.cmid ' +
                            'LEFT JOIN Checks ' +
                            'ON Share.shareid = Checks.shareid ' +
                            'WHERE Share.checkstatus = "PENDING" ' +
                            'AND Share.regdate < DATE_SUB(NOW(), INTERVAL 90 MINUTE) ' +    //To get only those shares which have been live for 90 minutes
                            'AND Share.UUID <> ? ' +    //To get shares other than those done by this user
                            'AND Share.locked = ? ' +   //To get unlocked shares TODO: toggle comment
                            'HAVING checkerid <> ? ' +  //To get only those shares which haven't been checked by this user even once
                            'ORDER BY RAND() ' +        //To randomise
                            'LIMIT 1 ' +
                            'FOR UPDATE', [uuid, /*null*/false, uuid], function (err, rows) {   //TODO: toggle comment

                            console.log('SELECT...FOR UPDATE query response ' + JSON.stringify(rows, null, 3));

                            if (err) {
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else if (rows.length == 0) {

                                connection.commit(function (err) {
                                    if (err) {
                                        connection.rollback(function () {
                                            reject(err);
                                        });
                                    }
                                    else {
                                        console.log('NO DATA: TRANSACTION committed');
                                        resolve({
                                            accountstatus: (userdata[0].accountstatus === "DISABLED") //true for account-suspension, false otherwise
                                        });
                                    }
                                });
                            }
                            else {
                                //Update the 'locked' and 'locked_at' columns for the 'shareid' retrieved in the previous query
                                connection.query('UPDATE Share SET locked = ?, locked_at = NOW() WHERE shareid = ?', [true, rows[0].shareid], function (err, qdata) {

                                    console.log("UPDATE query executed");

                                    if (err) {
                                        connection.rollback(function () {
                                            reject(err);
                                        });
                                    }
                                    else {

                                        connection.commit(function (err) {
                                            if (err) {
                                                connection.rollback(function () {
                                                    reject(err);
                                                });
                                            }
                                            else {
                                                console.log('TRANSACTION committed successfully');
                                                resolve({
                                                    row: rows[0],
                                                    accountstatus: (userdata[0].accountstatus === "DISABLED") //true for account-suspension, false otherwise
                                                });
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

/**
 * Function to register the check of a share
 * */
router.post('/register', function (request, response) {

    console.log("Request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;   //UUID of the person who has checked
    var sharerid = request.body.sharerid;   //UUID of the person who is being checked
    var authkey = request.body.authkey;
    var shareid = request.body.shareid;
    var cmid = request.body.cmid;
    var sharerate = request.body.sharerate;

    var connection;

    var checkdata = {
        checkresponse: validateCheckResponse(request.body.checkresponse), //Should be one of the following constants: VERIFIED, ABSENT_PROFILE, WRONG_PERSON, ABSENT_SHARE
        fblikes: request.body.fblikes,
        fbcomments: request.body.fbcomments,
        fbshares: request.body.fbshares
    };

    _auth.authValid(uuid, authkey)
        .then(function () {
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
            return registerCheckResponse(checkdata, shareid, cmid, uuid, sharerid, connection);
        })
        .then(function (checkstatus) {

            if(checkstatus){
                return updateShareForCheck(connection, shareid, checkstatus);   //If the checkresponse was 'verified'. If not, then it was the 2nd for the Share
            }
            else{
                return updateShareForCheck(connection, shareid);    //If the checkresponse was not 'verified' and was the 1st for the Share
            }
        })
        .then(function (result) {
            if(result.toUpdateBudget){
                return updateCampaignBudget(connection, sharerate, result.checkrate, cmid);
            }
            else{
                connection.commit(function (err) {
                    if(err){
                        connection.rollback(function () {
                            throw err;
                        });
                    }
                });
            }
        })
        .then(function () {
            console.log('Sending back response');
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'completed'
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                });
                response.end();
            }
        });

});

function validateCheckResponse(res) {

    switch (res) {

        case VERIFIED:
        case ABSENT_PROFILE:
        case WRONG_PERSON:
        case ABSENT_SHARE:
            return res;
        default:
            console.error('validateCheckResponse: Invalid check response');
            throw new Error('validateCheckResponse: Invalid check response');
    }

}

/**
 * Update the 'checkstatus' column of 'Share' table after the check has been registered
 * */
function updateShareForCheck(connection, shareid, checkstatus) {

    console.log('updateShareForCheck called');

    return new Promise(function (resolve, reject) {

        var result = {
            toUpdateBudget: false
        };

        var params = {
            locked: false,
            locked_at: null
        };

        if(checkstatus){    //Case where checkresponse is either 'verified' or 2nd for the Share
            params.checkstatus = checkstatus;

            //TODO: Make the checkrate dynamic
            if(checkstatus == "COMPLETE"){
                result.checkrate = consts.checkrate_verified;
                result.toUpdateBudget = true;
            }
            else {  //Case where checkstatus = "CANCELLED"
                result.checkrate = consts.checkrate_not_verified;
            }

        }

        connection.query('UPDATE Share SET ? WHERE shareid = ?', [params, shareid], function (err, rows) {

            if (err) {
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {
                resolve(result);
            }

        })

    });

}

/**
 * Function to update the budget of a campaign based on whether the share was valid or not
 * */
function updateCampaignBudget(connection, sharerate, checkrate, cmid) {

    console.log('updateCampaignBudget called');

    return new Promise(function (resolve, reject) {

        var calculatedMarkup = parseFloat(parseFloat(sharerate) + parseFloat(checkrate)) * parseFloat(consts.markup/100);
        var amount = parseFloat(parseFloat(sharerate) + parseFloat(checkrate) + calculatedMarkup);
        var calculatedTax = parseFloat(parseFloat(amount) * parseFloat(18/100));    //18%
        var grossAmount = parseFloat(amount + calculatedTax);

        console.log('markup subtracted from budget ' + calculatedMarkup);
        console.log('amount subtracted from budget ' + amount);

        connection.query('UPDATE Campaign SET budget = (budget - ?) WHERE cmid = ?', [grossAmount, cmid], function (err, row) {

            if (err) {
               connection.rollback(function () {
                   reject(err);
               })
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
                })
            }

        });

    });

}

/**
 * Insert a row into 'Checks' table and calls resolve OR reject based on whether
 * this is the second time a check is being registered or first time for a given 'shareid'
 * */
function registerCheckResponse(checkdata, shareid, cmid, uuid, sharerid, connection) {

    console.log('registerCheckResponse called');

    return new Promise(function (resolve, reject) {

        var params = {
            checkid: uuidGenerator.v4(),
            shareid: shareid,
            UUID: uuid,
            cmid: cmid,
            responses: checkdata.checkresponse,
            fblikes: checkdata.fblikes,
            fbcomments: checkdata.fbcomments,
            fbshares: checkdata.fbshares,
            checkrate: (checkdata.checkresponse == "verified" ? consts.checkrate_verified : consts.checkrate_not_verified)
        };

        var cmptitle;

        console.log("shareid is " + JSON.stringify(shareid, null, 3));

        connection.beginTransaction(function (err) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else{
                connection.query('SELECT title FROM Campaign WHERE cmid = ?', [cmid], function (err, cmp) {
                    if(err){
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else {

                        cmptitle = cmp[0].title;

                        /*
                         The logic table for below callback statements is

                         Condition 1 (C1) : res == 'verified'
                         Condition 2 (C2) : checkcount > 1

                         C1   C2    Update Share Table
                         0    0              0
                         0    1              1
                         1    0              1
                         1    1              1

                         */

                        //Register the check into 'Checks' table
                        connection.query('INSERT INTO Checks SET ?', params, function (err, rows) {

                            if (err) {
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            //If the response is 'verified', then update the 'Share' table
                            else if (checkdata.checkresponse == 'verified') {

                                var notifData = {
                                    AppModel: "2.0",
                                    Category: 'share_status',
                                    // Status: 'verified',
                                    Message: 'Your share for ' + cmptitle + ' has been reviewed',
                                    Shareid: shareid,
                                    Cmid: cmid,
                                    Persist: "Yes"
                                };

                                var notifUser = new Array(sharerid);

                                notify.notification(notifUser, notifData, function (err) {

                                    console.log('notification sent');

                                    resolve("COMPLETE");  //As this action is independent of whether the notification to the user was a success or not

                                    if (err) {
                                        console.error(err);
                                        //throw err;    //TODO: toggle uncomment
                                    }
                                });
                            }
                            //If the response is NOT 'verified', then count the no of checks this share has received,
                            // if the count == 1 then do not update the 'Share' table otherwise do.
                            else {

                                connection.query('SELECT * FROM Checks WHERE shareid = ?', [shareid], function (err, row) {

                                    console.log("row is " + JSON.stringify(row, null, 3));
                                    var checkcount = row.length;

                                    if (err) {
                                        connection.rollback(function () {
                                            reject(err);
                                        });
                                    }
                                    //Only one check, do not update the share table
                                    else if (checkcount == 1) {
                                        resolve();
                                    }
                                    //Two checks, update the share table
                                    else {

                                        var notifData = {
                                            AppModel: "2.0",
                                            Category: 'share_status',
                                            Shareid: shareid,
                                            // Status: 'verified',
                                            Message: 'Your share for ' + cmptitle + ' has been reviewed',
                                            Cmid: cmid,
                                            Persist: "Yes"
                                        };

                                        var notifUser = new Array(sharerid);

                                        notify.notification(notifUser, notifData, function (err) {

                                            console.log('notification sent');

                                            resolve("CANCELLED");   //As this action is independent whether the notification to the user was a success or not

                                            if (err) {
                                                console.error(err);
                                                //throw err; //TODO: toggle uncomment
                                            }
                                        });
                                    }

                                });

                            }

                        });
                    }
                });
            }
        })

    });

}

module.exports = router;