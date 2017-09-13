/**
 * Created by avnee on 07-06-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');
var consts = require('../../utils/Constants');
var campaignutils = require('../../campaign/CampaignUtils');

router.post('/load/', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;

    console.log("authkey is " + JSON.stringify(authkey, null, 3));

    var resdata = {};

    _auth.checkToken(uuid, authkey, function (err, datasize) {

        if (err) {
            console.error(err);
            throw err;
        }
        else if (datasize === 0) {

            resdata.tokenstatus = 'invalid';
            response.send(resdata);
            response.end();

        }
        else {
            connection.query('SELECT Campaign.cmid, Campaign.title, Campaign.description, Campaign.mission, Campaign.type, Campaign.contentbaseurl, ' +
                'Campaign.imagepath, Campaign.regdate, SUM(!ISNULL(Share.shareid)) AS sharescount, ' +
                'Client.name AS clientname, Client.bio AS clientbio ' +
                'FROM Campaign ' +
                'JOIN Client ' +
                'ON Campaign.clientid = Client.clientid ' +
                'LEFT JOIN Share ' +
                'ON Campaign.cmid = Share.cmid ' +
                'WHERE Campaign.cmpstatus = ? ' +
                'AND Campaign.budget > 0 ' +
                'AND Campaign.main_feed = ? ' +
                'GROUP BY Campaign.regdate', ['ACTIVE', true], function (err, rows) {

                if (err) {
                    console.error(err);
                    throw err;
                }

                //Sorting according last created
                rows.sort(function (a, b) {
                    if (a.regdate < b.regdate) {
                        return 1;
                    }
                    else {
                        return -1;
                    }
                });

                rows.map(function (element) {
                    element.sharerate = consts.sharerate;     //TODO: Make sharerate dynamic
                });

                connection.query('SELECT users.accountstatus, users.fbusername, UserInterestsRel.UUID AS interestedUser ' +
                    'FROM users ' +
                    'LEFT JOIN UserInterestsRel ' +
                    'ON users.UUID = UserInterestsRel.UUID ' +
                    'WHERE users.UUID = ? ' +
                    'LIMIT 1', [uuid], function (err, row) {
                    if (err) {
                        throw err;
                    }
                    else {
                        console.log("user data after querying is " + JSON.stringify(row, null, 3));
                        console.log("rows after querying is " + JSON.stringify(rows, null, 3));

                        response.send({
                            tokenstatus: 'valid',
                            data: {
                                feed: rows,
                                fbidstatus: row[0].fbusername !== null,
                                accountstatus: (row[0].accountstatus === "DISABLED"), //true for account-suspension, false otherwise
                                intereststatus: row[0].interestedUser !== null,
                                restrictfindfrequency: consts.restrict_find_frequency
                            }
                        });
                        response.end();
                    }
                });

            });
        }
    });

});

router.post('/load/specific', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;
    var cmid = request.body.cmid;

    console.log("authkey is " + JSON.stringify(authkey, null, 3));

    var resdata = {};

    _auth.checkToken(uuid, authkey, function (err, datasize) {

        if (err) {
            console.error(err);
            throw err;
        }
        else if (datasize === 0) {

            resdata.tokenstatus = 'invalid';
            response.send(resdata);
            response.end();

        }
        else {
            connection.query('SELECT Campaign.title, Campaign.description, Campaign.mission, Campaign.type, Campaign.contentbaseurl, ' +
                'Campaign.imagepath, Campaign.regdate, ' +
                'Client.name AS clientname, Client.bio AS clientbio ' +
                'FROM Campaign ' +
                'JOIN Client ' +
                'ON Campaign.clientid = Client.clientid ' +
                'WHERE Campaign.cmid = ?', [cmid], function (err, row) {

                if (err) {
                    console.error(err);
                    throw err;
                }

                row.map(function (element) {
                    element.sharerate = consts.sharerate;     //TODO: Make sharerate dynamic
                });

                connection.query('SELECT fbusername FROM users WHERE UUID = ?', [uuid], function (err, user) {
                    if (err) {
                        throw err;
                    }
                    else {
                        console.log("row after querying is " + JSON.stringify(user, null, 3));

                        response.send({
                            tokenstatus: 'valid',
                            data: {
                                campaign: row[0],
                                fbidstatus: user[0].fbusername !== null
                            }
                        });
                        response.end();
                    }
                });

            });
        }
    });

});

router.post('/campaign-shares', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;
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
            return campaignutils.getCampaignShares(connection, cmid, 'COMPLETE');
        })
        .then(function (rows) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    shares: rows
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
                }).end();
            }
        });
});

router.post('/top-campaign-shares', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;

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
            return campaignutils.getTopCampaignShares(connection, cmid, 'COMPLETE');
        })
        .then(function (rows) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    shares: rows
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
                }).end();
            }
        });

});

module.exports = router;