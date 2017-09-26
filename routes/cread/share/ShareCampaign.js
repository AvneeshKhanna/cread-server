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

// console.log("diff is " + moment.utc(moment(regdate, "YYYY-MM-DD HH:mm:ss").diff(lowerlimittime, "YYYY-MM-DD HH:mm:ss")).format("HH:mm:ss"));

var utils = require('../utils/Utils');
var consts = require('../utils/Constants');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var share_utils = require('./ShareUtils');

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
    var sharerate = consts.sharerate; //TODO: Make sharerate dynamic
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
                channel: 'Facebook',    //TODO: Make channel dynamic
                ulinkkey: ulinkkey,
                ulinkvalue: ulinkvalue,
                donation: donation
            };

            shareid = params.shareid;

            if (cause_id) {
                params.causeid = cause_id;
            }

            return share_utils.saveShareToDb(params);
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

    var keygen = uuidGenerator.v4();

    var ulinkkey = new Hashids(keygen, 10).encode(1);
    var ulinkvalue = new Hashids(keygen, 10).encode(2);

    _auth.authValid(uuid, authkey)
        .then(function () {
            return checkUserShareCount(cmid, uuid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (result) {
            if(result.toProceed){
                return checkUserLastShare(cmid, uuid);
            }
            else{
                response.send({
                    tokenstatus: 'valid',
                    data: {
                        status: 'multiple-shares',   //to restruct user if he/she has shared a campaign multiple times
                        sharecount: result.sharecount,
                        contentbaseurl: result.contentbaseurl
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
        })
        .then(function (result) {

            if (result["to-share-this-more"]) {   //A Share doesn't exists within the last 24 hours whose cmid is the same as in the request
                console.log("result when restricting user is " + JSON.stringify(result, null, 3));

                if(result["to-share-other-more"]){
                    return getCampaignBaseLink(cmid);
                }
                else {
                    console.log('!result["to-share-other-more"] block called');
                    response.send({
                        tokenstatus: 'valid',
                        data: {
                            status: 'proceed',
                            canusershare: false,
                            wait_time: result["wait_time"]
                        }
                    });
                    response.end();
                    throw new BreakPromiseChainError();
                }
            }
            else {
                response.send({
                    tokenstatus: 'valid',
                    data: {
                        status: 'stop', //for restriction on a single campaign shared multiple times within 24 hour
                        canusershare: false,    //for restriction on any campaign shared multiple times within 30 min
                        wait_time: result["wait_time"]
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
        })
        .then(function (campaign) {

            if (campaign) { //Case where budget of the Campaign is available
                console.log("ulinkkey is " + JSON.stringify(ulinkkey, null, 3));
                console.log("ulinkvalue is " + JSON.stringify(ulinkvalue, null, 3));

                var data = {
                    status: 'proceed',
                    canusershare: true,
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
            else {   //Case where budget of the Campaign has been exhausted
                console.log("unavailable budget case is called");

                response.send({
                    tokenstatus: 'valid',
                    data: {
                        status: 'proceed',
                        can_user_share: true,
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

function checkUserShareCount(cmid, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS sharecount, Campaign.contentbaseurl ' +
            'FROM Share ' +
            'JOIN Campaign ' +
            'ON Campaign.cmid = Share.cmid ' +
            'WHERE Share.cmid = ? ' +
            'AND Share.uuid = ? ' +
            'AND Share.checkstatus = "COMPLETE"', [cmid, uuid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {
                if (row[0].sharecount >= 3) {
                    resolve({
                        toProceed: false,
                        sharecount: row[0].sharecount,
                        contentbaseurl: row[0].contentbaseurl
                    });
                }
                else{
                    resolve({
                        toProceed: true,
                        sharecount: row[0].sharecount
                    });
                }
            }
        });
    });
}

function checkUserLastShare(cmid, uuid) {
    return new Promise(function (resolve, reject) {

        var same_share_interval = consts.share_time_interval.same_share;
        var diff_share_interval = consts.share_time_interval.diff_share;

        var lowerlimittime_24 = moment.utc().subtract(same_share_interval.time_diff, same_share_interval.time_diff_unit).format('YYYY-MM-DD HH:mm:ss');
        var lowerlimittime_30 = moment.utc().subtract(diff_share_interval.time_diff, diff_share_interval.time_diff_unit).format('YYYY-MM-DD HH:mm:ss');

        console.log("lowerlimittime_24 is " + JSON.stringify(lowerlimittime_24, null, 3));
        console.log("lowerlimittime_30 is " + JSON.stringify(lowerlimittime_30, null, 3));

        connection.query('SELECT Share.cmid, Share.shareid, Share.regdate ' +
            'FROM Share ' +
            'JOIN Campaign ' +
            'ON Share.cmid = Campaign.cmid ' +
            'WHERE Share.UUID = ? ' +
            'AND Share.regdate > ? ' +
            'AND Campaign.main_feed = ? ' +
            'ORDER BY Share.regdate DESC', [/*cmid, */uuid, lowerlimittime_24, true], function (err, rows) {

            console.log("rows after checkUserLastShare query is " + JSON.stringify(rows, null, 3));

            if (err) {
                reject(err);
            }
            else {
                var result = {};

                /*if(rows.map(function (element) {
                 return moment(element.regdate).isBefore(lowerlimittime_24);
                 }).indexOf(false) != -1){
                 console.log('one such share exists');
                 result["to-share-more"] = true;
                 resolve(result);
                 }
                 else{
                 result["to-share-more"] = true;
                 resolve(result);
                 }*/

                if (rows.length !== 0) {    //One or more shares exist within the last 24 hours

                    var thisCmidShareIndex = rows.map(function (element) {
                        return element.cmid;
                    }).indexOf(cmid);

                    console.log('thisCmidShareIndex is ' + thisCmidShareIndex);

                    if (thisCmidShareIndex !== -1) { //Case where a share exists whose cmid is the same as the one requested to the server

                        console.log('(thisCmidShareIndex != -1) block called');

                        result["to-share-this-more"] = false;    //For 24 hr restriction
                        result["to-share-other-more"] = false;    //For 30 min restriction
                        result["wait_time"] = timeDiff(moment.utc(moment(rows[thisCmidShareIndex].regdate)).format("YYYY-MM-DD HH:mm:ss"), lowerlimittime_24);
                        resolve(result);
                    }
                    else if(consts.restrict_every_share) {

                        //Case where all the shares have a cmid different than that requested to the server

                        if (moment(moment.utc(moment(rows[0].regdate)).format('YYYY-MM-DD HH:mm:ss')).isAfter(lowerlimittime_30)) { //Case where a share exists within previous 30 minutes of this server request
                            result["to-share-this-more"] = true;
                            result["to-share-other-more"] = false;
                            result["wait_time"] = timeDiff(moment.utc(moment(rows[0].regdate)).format("YYYY-MM-DD HH:mm:ss"), lowerlimittime_30);
                            resolve(result);
                        }
                        else {  //Case to proceed
                            result["to-share-this-more"] = true;
                            result["to-share-other-more"] = true;
                            resolve(result);
                        }
                    }
                    else{   //Case to proceed
                        result["to-share-this-more"] = true;
                        result["to-share-other-more"] = true;
                        resolve(result);
                    }

                    /*var regdate = moment.utc(rows[0].regdate).format("YYYY-MM-DD HH:mm:ss");

                    console.log("wait time is " + moment.utc(moment(regdate, "YYYY-MM-DD HH:mm:ss").diff(lowerlimittime, "YYYY-MM-DD HH:mm:ss")).format("HH:mm:ss"));

                    result["to-share-more"] = false;
                    result["wait_time"] = moment.utc(moment(regdate, "YYYY-MM-DD HH:mm:ss").diff(lowerlimittime, "YYYY-MM-DD HH:mm:ss")).format("HH:mm:ss");//moment(moment(rows[0].regdate, "DD-MM-YYYY hh:mm:ss").diff(moment(moment(), "DD-MM-YYYY hh:mm:ss"))).format("hh:mm:ss");

                    resolve(result);*/
                }
                else {  //Case to proceed
                    result["to-share-this-more"] = true;
                    result["to-share-other-more"] = true;
                    resolve(result);
                }
            }
        });
    });
}

/*
 * Returns the time difference between currenttime and limittime in HH:mm:ss
 * */
function timeDiff(sharetime, limittime) {

    console.log('sharetime is ' + sharetime);
    console.log('limittime is ' + limittime);

    if (limittime > sharetime) {
        throw new RangeError('limittime cannot be greater than sharetime');
    }

    return moment.utc(moment(sharetime, "YYYY-MM-DD HH:mm:ss").diff(limittime, "YYYY-MM-DD HH:mm:ss")).format(/*"x"*/"HH:mm:ss");
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