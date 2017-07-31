/**
 * Created by avnee on 13-06-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var uuidGenerator = require('uuid');
var Hashids = require('hashids');
var moment = require('moment');

var lowerlimittime = moment.utc().subtract(1, "days").format('YYYY-MM-DD HH:mm:ss');
//console.log("lowerlimittime is " + JSON.stringify(lowerlimittime, null, 3));
var regdate = moment.utc("2017-07-31T11:06:46.000Z").format("YYYY-MM-DD HH:mm:ss");
//console.log("regdate is " + JSON.stringify(regdate, null, 3));

console.log("diff is " + moment.utc(moment(regdate, "YYYY-MM-DD HH:mm:ss").diff(lowerlimittime, "YYYY-MM-DD HH:mm:ss")).format("HH:mm:ss"));

var utils = require('../utils/Utils');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

router.post('/add-donation-cause', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var shareid = request.body.shareid;
    var causeid = request.body.causeid;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return addDonationCause(shareid, causeid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            }).end();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
        });

});

function addDonationCause(shareid, causeid) {
    return new Promise(function (resolve, reject) {

        var params = {
            donation: true,
            causeid: causeid
        };

        connection.query('UPDATE Share SET ? WHERE shareid = ?', [params, shareid], function (err, row) {

            if (err) {
                reject(err);
            }
            else {
                resolve();
            }

        });
    })
}

/**
 * Register's a user's share to the database
 * */
router.post('/save', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;
    var cmid = request.body.cmid;
    var ulinkkey = request.body.ulinkkey;
    var ulinkvalue = request.body.ulinkvalue;
    var sharerate = 50;
    var channel = 'Facebook';
    var donation = false;//request.body.donation;
    var cause_id = request.body.cause_id;
    var shareid;    //Is initialised after params for saveShareToDb() method are set

    var resdata = {};

    _auth.authValid(uuid, authkey)
        .then(function () {

            var params = {
                shareid: uuidGenerator.v4(),
                UUID: uuid,
                cmid: cmid,
                sharerate: sharerate,
                channel: 'Facebook',
                ulinkkey: ulinkkey,
                ulinkvalue: ulinkvalue,
                donation: donation
            };

            shareid = params.shareid;

            if (cause_id) {
                params.causeid = cause_id;
            }

            return saveShareToDb(params);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function () {
            return getCausesData();
        })
        .then(function (rows) {

            var resdata = {
                tokenstatus: 'valid',
                data: {
                    causes: rows,
                    shareid: shareid
                }
            };

            console.log("resdata before /share-campaign/save " + JSON.stringify(resdata, null, 3));

            response.send(resdata);
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
                }).end();
            }
        });

});

/**
 * Function to add a user's share's details to the database
 * */
function saveShareToDb(params) {

    return new Promise(function (resolve, reject) {

        connection.query('INSERT INTO Share SET ?', params, function (error, data) {

            if (error) {
                reject(error);
            }
            else {
                console.log('Query executed');
                resolve();
            }

        });

    });

}

/**
 * Return all the causes saved in the DB
 * */
function getCausesData() {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT causeid, title AS causetitle, description AS causedesc, imagepath AS causeimgpth, link AS causelink ' +
            'FROM SocialCause', null, function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        })
    })
}

/**
 * Generate unique link parameters and send back to the client
 * */
router.post('/request-unique-link', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;
    var cmid = request.body.cmid;

    var ulinkkey = new Hashids(uuid + cmid, 10).encode(1);
    var ulinkvalue = new Hashids(uuid + cmid, 10).encode(2);

    _auth.authValid(uuid, authkey)
        .then(function () {
            return checkUserLastShare(cmid, uuid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
        })
        .then(function (result) {

            if (result["to-share-more"]) {   //A Share doesn't exists within the last 24 hours, proceed the user to Share

                console.log("result when restricting user is " + JSON.stringify(result, null, 3));
                return getCampaignBaseLink(cmid);
            }
            else {  //A Share exists within the last 24 hours, restrict the user to Share any more

                console.log("result when restricting user is " + JSON.stringify(result, null, 3));

                response.send({
                    tokenstatus: 'valid',
                    data: {
                        status: 'stop',
                        wait_time: result["wait_time"]
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
        })
        .then(function (campaign) {

            if(campaign) {
                console.log("ulinkkey is " + JSON.stringify(ulinkkey, null, 3));
                console.log("ulinkvalue is " + JSON.stringify(ulinkvalue, null, 3));

                var data = {
                    status: 'proceed',
                    budgetavailable: true,
                    campaignlink: utils.updateQueryStringParameter(campaign.contentbaseurl, ulinkkey, ulinkvalue),
                    ulinkkey: ulinkkey,
                    ulinkvalue: ulinkvalue
                };

                console.log("response data available budget case is " + JSON.stringify(data, null, 3));

                response.send({
                    tokenstatus: 'valid',
                    data: data
                });
                response.end();
                throw new BreakPromiseChainError();
            }
            else{   //Case where budget of the Campaign has been exhausted
                console.log("unavailable budget case is called");

                response.send({
                    tokenstatus: 'valid',
                    data: {
                        budgetavailable: false
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }

        })
        .catch(function (err) {
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

function checkUserLastShare(cmid, uuid) {
    return new Promise(function (resolve, reject) {

        var lowerlimittime = moment.utc().subtract(1, "days").format('YYYY-MM-DD HH:mm:ss');
        console.log("lowerlimitime is " + JSON.stringify(lowerlimittime, null, 3));

        connection.query('SELECT shareid, regdate ' +
            'FROM Share ' +
            'WHERE cmid = ? AND UUID = ? AND regdate > ? ' +
            'ORDER BY regdate DESC', [cmid, uuid, lowerlimittime], function (err, rows) {

            console.log("rows after checkUserLastShare query is " + JSON.stringify(rows, null, 3));

            if (err) {
                reject(err);
            }
            else {

                var result = {};

                if (rows[0]) {    //A Share exists within the last 24 hours, restrict the user to Share any more

                    var regdate = moment.utc(rows[0].regdate).format("YYYY-MM-DD HH:mm:ss");

                    console.log("wait time is " + moment.utc(moment(regdate, "YYYY-MM-DD HH:mm:ss").diff(lowerlimittime, "YYYY-MM-DD HH:mm:ss")).format("HH:mm:ss"));

                    result["to-share-more"] = false;
                    result["wait_time"] = moment.utc(moment(regdate, "YYYY-MM-DD HH:mm:ss").diff(lowerlimittime, "YYYY-MM-DD HH:mm:ss")).format("HH:mm:ss");//moment(moment(rows[0].regdate, "DD-MM-YYYY hh:mm:ss").diff(moment(moment(), "DD-MM-YYYY hh:mm:ss"))).format("hh:mm:ss");

                    resolve(result);
                }
                else {
                    result["to-share-more"] = true;
                    resolve(result);
                }

            }

        });
    });
}

/**
 * Queries 'contentbaseurl' of a given Campaign
 * */
function getCampaignBaseLink(cmid) {

    return new Promise(function (resolve, reject) {

        connection.query('SELECT budget, contentbaseurl FROM Campaign WHERE cmid = ?', [cmid], function (err, rows) {

            if (err) {
                reject(err);
            }
            else if (rows[0].budget <= 0) {   //Case where budget of the 'Campaign' has been exhausted
                resolve();
            }
            else {
                console.log("rows after querying getCampaignBaseLink is " + JSON.stringify(rows, null, 3));
                resolve(rows[0]);
            }

        });

    });

}

module.exports = router;