/**
 * Created by avnee on 15-06-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var _auth = require('../../authtokenValidation');
var uuidGenerator = require('uuid');

var utils = require('../utils/Utils');

var VERIFIED = 'verified';
var ABSENT_PROFILE = 'absent-profile';
var WRONG_PERSON = 'wrong-person';
var ABSENT_SHARE = 'absent-share';

//TODO: Add budget consumption system

/**
* To serve user's request to check another user's share
* */
router.post('/request', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;

    _auth.authValid(uuid, authkey)
        .then(getCheckData, function () {

            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            
        })
        .then(function (row) {

            if(row === undefined){    //Case of no data
                response.send({
                    tokenstatus: 'valid',
                    data: []
                });
                response.end();
            }
            else {
                row.verificationurl = utils.updateQueryStringParameter(row.verificationurl, row.ulinkkey, row.ulinkvalue);

                /*if(row.hasOwnProperty("ulinkkey")){
                 delete row.ulinkkey;
                 }
                 if(row.hasOwnProperty("ulinkvalue")){
                 delete row.ulinkvalue;
                 }*/

                row.fbuserlink = "https://www.facebook.com/login.php?next=" + encodeURIComponent("https://www.facebook.com/" + row.fbusername);

                if(row.hasOwnProperty("fbusername")){
                    delete row.fbusername;
                }

                console.log("row is " + JSON.stringify(row, null, 3));

                response.send({
                    tokenstatus: 'valid',
                    data: row
                });
                response.end();
            }

        });


});

//DATE_SUB(NOW(), INTERVAL 60 MINUTE);

/**
 * Function to retrieve a random user's data from the profile who has shared a given campaign
 * */
function getCheckData() {

    return new Promise(function (resolve, reject) {

        //Here, SQL's TRANSACTION functions are used because between the 'SELECT...FOR UPDATE' and 'UPDATE' query, we would
        // not want any other session to update that specific record. connection.beginTransaction() ensures so.
        // NOTE: calling connection.commit() is necessary after calling connection.beginTransaction() in the same session
        connection.beginTransaction(function (err) {
            if(err){
                console.error(err);
                throw err;
            }
            else {

                //TODO: Randomise the retrieval
                //Retrieve a user's share data for a given cmid who has shared within the last 24 hours and has not been verified
                connection.query('SELECT Share.shareid, Share.regdate AS sharetime, Share.shareid, Share.ulinkkey, Share.ulinkvalue, ' +
                    'Campaign.cmid, Campaign.contentbaseurl AS verificationurl, Campaign.title, Campaign.description, Campaign.imagepath, ' +
                    'users.firstname, users.lastname, users.fbusername ' +
                    'FROM Share ' +
                    'JOIN users ' +
                    'ON Share.UUID = users.UUID ' +
                    'JOIN Campaign ' +
                    'ON Campaign.cmid = Share.cmid ' +
                    'WHERE Share.checkstatus = "PENDING" ' +
                    //'AND Share.locked = ? ' + TODO: Uncomment
                    'LIMIT 1 ' +
                    'FOR UPDATE', null/*[false]*/, function (err, rows) {

                    console.log('SELECT...FOR UPDATE query executed');

                    if(err){
                        console.error(err);
                        throw err;
                    }
                    else if(rows.length == 0){

                        connection.commit(function (err) {
                            if(err){
                                connection.rollback(function () {
                                    console.error(err);
                                    throw err;
                                });
                            }
                            else {
                                console.log('NO DATA: TRANSACTION committed');
                                resolve();
                            }

                        });

                    }
                    else {
                        //Update the 'locked' and 'locked_at' columns for the 'shareid' retrieved in the previous query
                        connection.query('UPDATE Share SET locked = ?, locked_at = NOW() WHERE shareid = ?', [true, rows[0].shareid], function (err, qdata) {

                            console.log("UPDATE query executed");

                            if(err){
                                connection.rollback(function () {
                                    console.error(err);
                                    throw err;
                                });
                            }
                            else {

                                connection.commit(function (err) {
                                    if(err){
                                        connection.rollback(function () {
                                            console.error(err);
                                            throw err;
                                        });
                                    }
                                    else {
                                        console.log('TRANSACTION committed successfully');
                                        resolve(rows[0]);
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
    var authkey = request.body.authkey;
    var shareid = request.body.shareid;
    var cmid = request.body.cmid;

    var checkdata = {
        checkresponse: validateCheckResponse(request.body.checkresponse), //Should be one of the following constants: VERIFIED, ABSENT_PROFILE, WRONG_PERSON, ABSENT_SHARE
        sharelikes: request.body.sharelikes,
        sharecomments: request.body.sharecomments
    };

    _auth.authValid(uuid, authkey)
        .then(function () {
            return registerCheckResponse(checkdata, shareid, cmid, uuid);
        }, function () {

            response.send({
                tokenstatus: 'invalid'
            });
            response.end();

        })
        .then(function () {
            return updateShareForCheck(shareid);
        }, function () {
            //Send response back to the client without updating 'Share' table
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'completed'
                }
            });
            response.end();
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'completed'
                }
            });
            response.end();
        });

});

function validateCheckResponse(res) {

    switch (res){

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
function updateShareForCheck(shareid) {

    return new Promise(function (resolve, reject) {

        connection.query('UPDATE Share SET checkstatus = ?, locked = ?, locked_at = ? WHERE shareid = ?', ["COMPLETE", false, null, shareid], function (err, rows) {

            if(err){
                console.error(err);
                throw err;
            }
            else {
                resolve(rows);
            }

        })

    });

}

/**
 * Insert a row into 'Checks' table and calls resolve OR reject based on whether
 * this is the second time a check is being registered or first time for a given 'shareid'
 * */
function registerCheckResponse(checkdata, shareid, cmid, uuid) {

    return new Promise(function (resolve, reject) {

        var params = {
            checkid : uuidGenerator.v4(),
            shareid: shareid,
            UUID: uuid,
            cmid: cmid,
            responses: checkdata.checkresponse,
            sharelikes: checkdata.sharelikes,
            sharecomments: checkdata.sharecomments
        };

        console.log("shareid is " + JSON.stringify(shareid, null, 3));

        /*
        The logic table for below callback statements is

        Condition 1 (C1) : res == 'verified'
        Condition 2 (C2) : checkcount == 1

        C1   C2    Update Share Table
        0    0              0
        0    1              1
        1    0              1
        1    1              1

        */

        //Register the check into 'Checks' table
        connection.query('INSERT INTO Checks SET ?', params, function (err, rows){

            if(err){
                console.error(err);
                throw err;
            }
            //If the response is 'verified', then update the 'Share' table
            else if(checkdata.checkresponse == 'verified'){
                resolve(rows);
            }
            //If the response is NOT 'verified', then count the no of checks this share has received,
            // if the count == 1 then do not update the 'Share' table otherwise do.
            else {

                connection.query('SELECT * FROM Checks WHERE shareid = ?', [shareid], function(err, row) {

                    console.log("row is " + JSON.stringify(row, null, 3));
                    var checkcount = row.length;

                    if(err){
                        console.error(err);
                        throw err;
                    }
                    //Only one check, do not update the share table
                    else if(checkcount == 1){
                        reject(row);
                    }
                    //Two checks, update the share table
                    else {
                        resolve(row);
                    }

                });

            }

        });

    });

}

module.exports = router;