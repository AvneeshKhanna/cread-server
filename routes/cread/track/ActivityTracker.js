/**
 * Created by avnee on 12-06-2017.
 */
'use-strict';

/*
 * Returns the details of the campaigns to the app which were shared by the given user
 * */

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var consts = require('../utils/Constants');

router.post('/', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;

    var resdata = {};

    _auth.checkToken(uuid, authkey, function (err, datasize) {

        if (err) {
            throw err;
        }
        else if (datasize == 0) {
            resdata.tokenstatus = 'invalid';
            response.send(resdata);
            response.end();
        }
        else {
            resdata.tokenstatus = 'valid';

            var resarray = [];

            connection.query('SELECT Campaign.title, Share.shareid, Share.donation, Share.regdate, Share.sharerate, Share.checkstatus, Share.causeid, Share.cashed_in ' +
                'FROM Share ' +
                'INNER JOIN Campaign ' +
                'ON Share.cmid = Campaign.cmid ' +
                'WHERE Share.UUID = ?', [uuid], function (err, data) {

                if (err) {
                    console.error(err);
                    throw err;
                }

                /*for (var i = 0; i < data.length; i++) {
                    data[i].type = 0;   //Share Code
                }*/

                connection.query('SELECT Campaign.title, Checks.responses, Checks.regdate, Checks.cashed_in, Checks.checkrate ' +
                    'FROM Checks ' +
                    'INNER JOIN Campaign ' +
                    'ON Checks.cmid = Campaign.cmid ' +
                    'WHERE Checks.UUID = ?', [uuid], function (err, rows) {

                    if (err) {
                        console.error(err);
                        throw err;
                    }
                    else {

                        resarray = data.concat(rows);

                        console.log("Data after concat is " + JSON.stringify(resarray, null, 3));

                        /*for (var i = 0; i < rows.length; i++) {
                            rows[i].type = 1;   //Check Code
                        }*/

                        connection.query('SELECT users.firstname, users.lastname, users.phoneNo AS contact, users.email, users.fbusername ' +
                            'FROM users ' +
                            'WHERE users.UUID = ?', [uuid], function (err, userdata) {

                            if (err) {
                                throw err;
                            }
                            else {

                                console.log("userdata is " + JSON.stringify(userdata, null, 3));

                                //Calculate availableAmount
                                var availableAmt = resarray.map(function (element) {

                                        element.cashed_in = (element.cashed_in == 1);

                                        if (element.hasOwnProperty('sharerate')) {
                                            element.donation = (element.donation == 1);
                                            element.type = 0; //Share Code
                                        }
                                        else {
                                            /*if (element.responses == 'verified'){
                                                element.checkrate = consts.checkrate_verified;  //TODO: Make checkrate dynamic
                                            }
                                            else {
                                                element.checkrate = consts.checkrate_not_verified;  //TODO: Make checkrate dynamic
                                            }*/
                                            element.type = 1;   //Checks Code
                                        }

                                        return element;
                                    })
                                    .filter(function (element) {
                                        return (element.cashed_in == false)
                                            && (!element.hasOwnProperty('sharerate')
                                            || element.checkstatus == 'COMPLETE');
                                    })
                                    .reduce(function (accumulator, element) {
                                        if (element.hasOwnProperty('sharerate')) {
                                            if (!element.donation) {
                                                return accumulator + parseFloat(element.sharerate);
                                            }
                                            else {
                                                return accumulator;
                                            }
                                        }
                                        else {

                                            return accumulator + element.checkrate;

                                            /*if (element.responses == 'verified') {
                                                return accumulator + consts.checkrate_verified; //TODO: Make the checkrate dynamic
                                            }
                                            else {
                                                return accumulator + consts.checkrate_not_verified; //TODO: Make the checkrate dynamic
                                            }*/
                                        }
                                    }, 0);

                                var validactivityarray = resarray.filter(function (element) {
                                    if(element.hasOwnProperty('sharerate')){
                                        return (element.checkstatus != "CANCELLED");
                                    }
                                    else {
                                        return true;
                                    }
                                });

                                var no_of_shares = validactivityarray.filter(function (element) {
                                    return element.hasOwnProperty('sharerate');
                                }).length;

                                var no_of_checks = validactivityarray.length - no_of_shares;

                                var donatedAmt = validactivityarray.filter(function (element) {
                                    return element.hasOwnProperty('sharerate')
                                        && (element.donation == true)
                                        && (element.checkstatus == "COMPLETE");
                                }).reduce(function (accumuator, element) {
                                    accumuator += element.sharerate;
                                    return accumuator;
                                }, 0);

                                //Sort according to 'regdate'
                                resarray.sort(function (a, b) {

                                    if (a.regdate > b.regdate) {
                                        return -1;
                                    }
                                    else {
                                        return 1;
                                    }

                                });

                                console.log("resarray is " + JSON.stringify(resarray, null, 3));
                                console.log("validactivityarray is " + JSON.stringify(validactivityarray, null, 3));

                                // resdata.data = {};

                                resdata.data = {
                                    activityList: resarray,
                                    //pendingAmt : pendingAmt,
                                    userProfile: {
                                        firstname: userdata[0].firstname,
                                        lastname: userdata[0].lastname,
                                        email: userdata[0].email,
                                        contact: userdata[0].contact,
                                        fbusername: userdata[0].fbusername,
                                        shared: no_of_shares ? no_of_shares : 0,
                                        measured: no_of_checks ? no_of_checks : 0,
                                        donated: donatedAmt ? donatedAmt : 0,
                                        minCashInAmt: consts.min_cash_in_amt,
                                        creditAmt: availableAmt
                                    }
                                };

                                console.log("resdata is" + JSON.stringify(resdata, null, 3));

                                response.send(resdata);
                                response.end();

                            }

                        });

                    }

                });

            });
        }

    });

});

module.exports = router;