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

var utils = require('../utils/Utils');

var _auth = require('../../auth-token-management/AuthTokenManager');

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

            if(err){
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
    var donation = request.body.donation;
    var cause_id = request.body.cause_id;

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

            if (cause_id) {
                params.cause_id = cause_id;
            }

            return saveShareToDb(params);

        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
        })
        .then(function () {
            return getCausesData();
        }, function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Some error occurred at the server'
            }).end();
        })
        .then(function (rows) {

            var resdata = {
                tokenstatus: 'valid',
                data: rows
            };

            response.send(resdata);
            response.end();

        }, function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Some error occurred at the server'
            }).end();
        })
        .catch(function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Some error occurred at the server'
            }).end();
        });

});

/**
 * Function to add a user's share's details to the database
 * */
function saveShareToDb(params) {

    return new Promise(function (resolve, reject) {

        connection.query('INSERT INTO Share SET ?', params, function (error, data) {

            if (error) {
                throw error;
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
        connection.query('SELECT * FROM SocialCause', null, function (err, rows) {
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
            return getCampaignBaseLink(cmid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
        })
        .then(function (campaign) {

            console.log("ulinkkey is " + JSON.stringify(ulinkkey, null, 3));
            console.log("ulinkvalue is " + JSON.stringify(ulinkvalue, null, 3));

            var data = {
                budgetavailable: true,
                campaignlink: utils.updateQueryStringParameter(campaign.contentbaseurl, ulinkkey, ulinkvalue),
                ulinkkey: ulinkkey,
                ulinkvalue: ulinkvalue
            };

            response.send({
                tokenstatus: 'valid',
                data: data
            });
            response.end();

        }, function () { //Case where budget of the Campaign has been exhausted

            response.send({
                tokenstatus: 'valid',
                data: {
                    budgetavailable: false
                }
            });
            response.end();

        });

});

/**
 * Queries 'contentbaseurl' of a given Campaign
 * */
function getCampaignBaseLink(cmid) {

    return new Promise(function (resolve, reject) {

        connection.query('SELECT budget, contentbaseurl FROM Campaign WHERE cmid = ?', [cmid], function (err, rows) {

            if (err) {
                console.error(err);
                throw err;
            }
            else if (rows[0].budget <= 0) {   //Case where budget of the 'Campaign' has been exhausted
                reject();
            }
            else {
                console.log("rows after querying getCampaignBaseLink is " + JSON.stringify(rows, null, 3));
                resolve(rows[0]);
            }

        });

    });

}

module.exports = router;