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
var moment = require('moment');

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
            return checkPermissionForFind(connection, uuid);
        })
        .then(function (result) {

            if (result.restrictfind) {
                response.send({
                    tokenstatus: 'valid',
                    restrictfind: result.restrictfind,
                    restrictfindtime: result.restrictfindtime,
                    data: result
                });
                response.end();
                throw new BreakPromiseChainError();
            }
            else {
                return getDataForCheck(uuid, connection);
            }
        })
        .then(function (result) {

            var row = result.row;

            if (row === undefined) {    //Case of no data
                console.log("row before response " + JSON.stringify(row, null, 3));
                response.send({
                    tokenstatus: 'valid',
                    restrictfind: false,
                    restrictfindtime: null,
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

                return checkToRateUser(connection, row.sh_uuid, uuid, row)

                /*response.send({
                    tokenstatus: 'valid',
                    restrictfind: false,
                    restrictfindtime: null,
                    data: row
                });
                response.end();
                throw new BreakPromiseChainError();*/
            }

        })
        .then(function (row) {
            response.send({
                tokenstatus: 'valid',
                restrictfind: false,
                restrictfindtime: null,
                data: row
            });
            response.end();
            throw new BreakPromiseChainError();
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

function checkPermissionForFind(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT last_find_restrict FROM users WHERE uuid = ? AND last_find_restrict > DATE_SUB(NOW(), INTERVAL 3 HOUR)', [uuid], function (err, rows) {
            console.log("response from checkPermission is " + JSON.stringify(rows, null, 3));
            if (err) {
                reject(err);
            }
            else if (rows[0]) {   //Restriction exists
                resolve({
                    restrictfind: true,
                    restrictfindtime: 3 * 60 * 60 - (moment().diff(moment(rows[0].last_find_restrict)) / 1000)    //time left for find to be activated in seconds
                });
            }
            else {   //Restriction does not exists
                resolve({
                    restrictfind: false
                });
            }
        });
    });
}

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
                    if (err) {
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else if (userdata[0].accountstatus === "DISABLED") {
                        connection.commit(function (err) {
                            if (err) {
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else {
                                console.log('Account disabled: TRANSACTION COMMITTED');
                                resolve({
                                    accountstatus: (userdata[0].accountstatus === "DISABLED") //true for account-suspension, false otherwise
                                });
                            }
                        });
                    }
                    else {
                        //Retrieve a user's share data for a given cmid who has shared within the last 24 hours and has not been verified
                        connection.query('SELECT Share.UUID AS sh_uuid, Share.cmid AS sh_cmid, Share.sharerate, Share.regdate AS sharetime, Share.shareid, Share.ulinkkey, Share.ulinkvalue ' +
                            /*'(CASE WHEN(Checks.UUID IS NULL) THEN "INVALID" ELSE Checks.UUID END) AS checkerid ' + //Since NULL values in SQL cannot be compared with <>, it has to be converted into a NON-NULL value like 'INVALID' in this case
                            */'FROM Share ' +
                            /*'LEFT JOIN Checks ' +
                            'ON Share.shareid = Checks.shareid ' +
                            */'WHERE Share.checkstatus = "PENDING" ' +
                            'AND Share.regdate < DATE_SUB(NOW(), INTERVAL 90 MINUTE) ' +    //To get only those shares which have been live for 90 minutes
                            'AND Share.UUID <> ? ' +    //To get shares other than those done by this user
                            'AND Share.locked = ? ' +   //To get unlocked shares
                            'AND Share.shareid NOT IN (SELECT shareid FROM Checks WHERE uuid = ?) ' +  //To get only those shares which haven't been checked by this user even once
                            'ORDER BY RAND() ' +        //To randomise
                            'LIMIT 1 ' +
                            'FOR UPDATE', [uuid, false, uuid], function (err, rows) {

                            console.log('SELECT...FOR UPDATE query response ' + JSON.stringify(rows, null, 3));

                            if (err) {
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else if (rows.length === 0) {

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
                                //This query is not JOINED to the above query because the data being fetched is for read-only. Including it in a
                                //SELECT...FOR UPDATE would lock the rows corresponding to Campaign and users table as well which can increase chances
                                //of DEADLOCKS
                                connection.query('SELECT Campaign.cmid, Campaign.contentbaseurl AS verificationurl, Campaign.title, Campaign.description, Campaign.imagepath, ' +
                                    'users.firstname, users.UUID AS sharerid, users.fbusername ' +
                                    'FROM users, Campaign ' +
                                    'WHERE users.uuid = ? ' +
                                    'AND Campaign.cmid = ?', [rows[0].sh_uuid, rows[0].sh_cmid], function (err, cm_usr_data) {

                                    if (err) {
                                        connection.rollback(function () {
                                            reject(err);
                                        });
                                    }
                                    else {

                                        console.log("before: cm_usr_data is " + JSON.stringify(cm_usr_data, null, 3));
                                        console.log("before:  rows is " + JSON.stringify(rows, null, 3));

                                        //Concatenate 'cm_usr_data' and 'rows'
                                        rows[0] = Object.assign({}, cm_usr_data[0], rows[0]);

                                        /*if (rows[0].hasOwnProperty('sh_uuid')) {
                                            delete rows[0].sh_uuid;
                                        }*/

                                        if (rows[0].hasOwnProperty('sh_cmid')) {
                                            delete rows[0].sh_cmid;
                                        }

                                        console.log("after: rows is " + JSON.stringify(rows, null, 3));

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
            }
        });

    });

}

/**
 * Checks whether the sharer's profile has been rated atleast once by the checker
 * */
function checkToRateUser(connection, sharerid, checkerid, row) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Share.shareid ' +
            'FROM Share ' +
            'JOIN Checks ' +
            'ON Share.shareid = Checks.shareid ' +
            'WHERE Share.uuid = ? ' +
            'AND Checks.uuid = ? ' +
            'AND Checks.profilerating <> -1', [sharerid, checkerid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else if (rows.length === 0) { //The checker is reviewing sharer's profile for the first time

                row.torate = true;
                resolve(row);
            }
            else {
                row.torate = false;
                resolve(row);
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

    var retrycount = 0;     //For deadlock errors
    var connection;

    var checkdata = {
        checkresponse: validateCheckResponse(request.body.checkresponse), //Should be one of the following constants: VERIFIED, ABSENT_PROFILE, WRONG_PERSON, ABSENT_SHARE
        fblikes: request.body.fblikes,
        fbcomments: request.body.fbcomments,
        fbshares: request.body.fbshares,
        profilereviewscore: request.body.profilereviewscore
    };

    //A recursive approach is used in case of deadlock aversion. This would ensure that the functions are executed at least thrice
    // before being subject to an error and a failed SQL Transaction
    function recurrent(retrycount) {

        console.log('retry no - ' + retrycount);
        var toNotify = false;

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
                return registerCheckResponse(checkdata, shareid, cmid, uuid, connection);
            })
            .then(function (checkstatus) {

                if (checkstatus) {
                    toNotify = true;
                    return updateShareForCheck(connection, shareid, checkstatus);   //If the checkresponse was 'verified'. If not, then it was the 2nd for the Share
                }
                else {
                    return updateShareForCheck(connection, shareid);    //If the checkresponse was not 'verified' and was the 1st for the Share
                }
            })
            .then(function (result) {
                if (result.toUpdateBudget) {
                    return updateCampaignBudget(connection, sharerate, result.checkrate, cmid);
                }
                else {
                    connection.commit(function (err) {
                        if (err) {
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

                if (toNotify) {
                    notifyUserForCheck(cmid, shareid, sharerid);
                }

                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                config.disconnect(connection);
                if (err instanceof BreakPromiseChainError) {
                    //Do nothing
                }
                else if (err.code === 'ER_LOCK_DEADLOCK') {   //To add 2 retries if a transaction fails due to deadlock error
                    retrycount++;
                    if (retrycount < 3) {
                        recurrent(retrycount);  //Recursion
                    }
                    else {
                        console.error(err);
                        response.status(500).send({
                            error: 'Some error occurred at the server'
                        });
                        response.end();
                    }
                }
                else {
                    console.error(err);
                    response.status(500).send({
                        error: 'Some error occurred at the server'
                    });
                    response.end();
                }
            });
    }
    recurrent(retrycount);

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

        if (checkstatus) {    //Case where checkresponse is either 'verified' or 2nd for the Share
            params.checkstatus = checkstatus;

            //TODO: Make the checkrate dynamic
            if (checkstatus === "COMPLETE") {
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
        });
    });
}

/**
 * Function to update the budget of a campaign based on whether the share was valid or not
 * */
function updateCampaignBudget(connection, sharerate, checkrate, cmid) {

    console.log('updateCampaignBudget called');

    return new Promise(function (resolve, reject) {

        var calculatedMarkup = parseFloat(parseFloat(sharerate) + (parseFloat(checkrate) * consts.required_verified_checks)) * parseFloat(consts.markup / 100);
        var amount = parseFloat(parseFloat(sharerate) + (parseFloat(checkrate) * consts.required_verified_checks) + calculatedMarkup);
        var calculatedTax = parseFloat(parseFloat(amount) * parseFloat(18 / 100));    //18%
        var grossAmount = parseFloat(amount + calculatedTax);

        console.log('markup subtracted from budget ' + calculatedMarkup);
        console.log('amount subtracted from budget ' + grossAmount);

        connection.query('UPDATE Campaign SET budget = (budget - ?) WHERE cmid = ?', [grossAmount, cmid], function (err, row) {

            if (err) {
                connection.rollback(function () {
                    reject(err);
                })
            }
            else {
                connection.commit(function (err) {
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
 * Insert a row into 'Checks' table and calls resolve OR reject based on whether
 * this is the second time a check is being registered or first time for a given 'shareid'
 * */
function registerCheckResponse(checkdata, shareid, cmid, uuid, connection) {

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
            profilerating: checkdata.profilereviewscore,
            checkrate: (checkdata.checkresponse === "verified" ? consts.checkrate_verified : consts.checkrate_not_verified)
        };

        var cmptitle;

        console.log("shareid is " + JSON.stringify(shareid, null, 3));

        connection.beginTransaction(function (err) {
            if (err) {
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {
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
                    /*else if (checkdata.checkresponse === 'verified') {
                        resolve("COMPLETE");  //As this action is independent of whether the notification to the user was a success or not
                    }*/
                    //If the response is NOT 'verified', then count the no of checks this share has received,
                    // if the count == 1 then do not update the 'Share' table otherwise do.
                    else {

                        connection.query('SELECT SUM(CASE WHEN(responses = "verified") THEN 1 ELSE 0 END) AS verifiedCount, ' +
                            'SUM(CASE WHEN(responses <> "verified") THEN 1 ELSE 0 END) AS unverifiedCount ' +
                            'FROM Checks ' +
                            'WHERE shareid = ?', [shareid], function (err, row) {

                            console.log("checks are " + JSON.stringify(row, null, 3));
                            var checkcount = row.length;

                            var isVerified = row[0].verifiedCount >= consts.required_verified_checks;
                            var isCancelled = row[0].unverifiedCount >= consts.required_unverified_checks;

                            if (err) {
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else if (isVerified) {    //Case when the no of verified checks >= 3, update Share.checkstatus
                                resolve("COMPLETE");
                            }
                            else if (isCancelled) {  //Case when the no of unverified checks >= 5, update Share.checkstatus
                                resolve("CANCELLED");
                            }
                            else {   //Case when the no of verified checks < 3 and unverified checks < 5, don't update Share.checkstatus
                                resolve();
                            }
                            //Only one check, do not update the share table
                            /*else if (checkcount === 1) {
                                resolve();
                            }
                            //Two checks, update the share table
                            else {
                                resolve("CANCELLED");
                            }*/
                        });
                    }
                });
            }
        })

    });

}

/**
 * To send a notification to the user that his/her share has been checked
 * */
function notifyUserForCheck(cmid, shareid, sharerid) {
    config.getNewConnection()
        .then(function (connection) {
            connection.query('SELECT title FROM Campaign WHERE cmid = ?', [cmid], function (err, row) {
                config.disconnect(connection);
                if (err) {
                    console.error(err);
                }
                else {

                    var notifData = {
                        AppModel: "2.0",
                        Category: 'share_status',
                        // Status: 'verified',
                        Message: 'Your share for ' + row[0].title + ' has been reviewed',
                        Shareid: shareid,
                        Cmid: cmid,
                        Persist: "Yes"
                    };

                    var user = new Array(sharerid);

                    notify.notification(user, notifData, function (err, data) {
                        if (err) {
                            console.error(err);
                        }
                    });
                }
            });
        });
}

/**
 * Used to restrict the find action of a person if he clicks too many times on the 'Find' button on the app within a minute
 * */
router.post('/restrict-find', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;

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
            return restrictFind(connection, uuid);
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
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });
});

function restrictFind(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE users SET last_find_restrict = NOW() WHERE uuid = ?', [uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

module.exports = router;