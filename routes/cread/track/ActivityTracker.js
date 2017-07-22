/**
 * Created by avnee on 12-06-2017.
 */

/*
 * Returns the details of the campaigns to the app which were shared by the given user
 * */

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var _auth = require('../../auth-token-management/AuthTokenManager');

//TODO: Calculate shares, checks and donations
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

            connection.query('SELECT Campaign.title, Share.donation, Share.regdate, Share.sharerate, Share.checkstatus, Share.causeid, Share.cashed_in ' +
                'FROM Share ' +
                'INNER JOIN Campaign ' +
                'ON Share.cmid = Campaign.cmid ' +
                'WHERE Share.UUID = ?', [uuid], function (err, data) {

                if (err) {
                    console.error(err);
                    throw err;
                }

                console.log("Data from query is " + JSON.stringify(data, null, 3));

                for (var i = 0; i < data.length; i++) {
                    data[i].type = 0;   //Share Code
                }

                connection.query('SELECT Campaign.title, Checks.responses, Checks.regdate, Checks.cashed_in ' +
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

                        for (var i = 0; i < rows.length; i++) {
                            rows[i].type = 1;   //Check Code
                        }

                        connection.query('SELECT users.firstname, users.lastname, users.phoneNo AS contact, users.email, users.fbusername ' +
                            'FROM users ' +
                            'WHERE users.UUID = ?', [uuid], function (err, userdata) {

                            if (err) {
                                throw err;
                            }
                            else {

                                console.log("userdata is " + JSON.stringify(userdata, null, 3));


                                //Calculate pendingAmount
                                /*var pendingAmt = resarray.filter(function (element) {
                                 return element.hasOwnProperty('checkstatus') && element.checkstatus == 'PENDING' && element.causeid == null;
                                 }).reduce(function (accumulator, element) {
                                 return accumulator + element.sharerate;
                                 }, 0);*/

                                //TODO: Make the checkprice dynamic
                                //Calculate availableAmount
                                var availableAmt = resarray.map(function (element) {

                                    element.cashed_in = (element.cashed_in == 1);

                                    if (element.hasOwnProperty('sharerate')) {
                                        element.donation = (element.donation == 1);
                                    }
                                    else {
                                        element.checkrate = 4;
                                    }
                                    return element;
                                })
                                .filter(function (element) {
                                    return !element.hasOwnProperty('checkstatus') || element.checkstatus != 'PENDING';
                                })
                                .reduce(function (accumulator, element) {
                                    if (element.hasOwnProperty('sharerate')) {
                                        if (element.causeid == null) {
                                            return accumulator + parseInt(element.sharerate);
                                        }
                                        else {
                                            return accumulator;
                                        }
                                    }
                                    else {
                                        //TODO: Make the checkprice dynamic
                                        if (element.responses == 'verified') {
                                            return accumulator + 4;
                                        }
                                        else {
                                            return accumulator + 1;
                                        }
                                    }
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

                                resdata.data = {};

                                resdata.data = {
                                    activityList: resarray,
                                    //pendingAmt : pendingAmt,
                                    userProfile: {
                                        firstname: userdata[0].firstname,
                                        lastname: userdata[0].lastname,
                                        email: userdata[0].email,
                                        contact: userdata[0].contact,
                                        fbusername: userdata[0].fbusername,
                                        shared: 700,
                                        measured: 250,
                                        donated: 500,
                                        minCashInAmt: 100,
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