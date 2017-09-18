/**
 * Created by avnee on 29-08-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var AWS = config.AWS;

var envconfig = require('config');

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');
var consts = require('../../utils/Constants');
var campaignutils = require('../../campaign/CampaignUtils');

router.post('/load', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;

    var connection;

    console.log("authkey is " + JSON.stringify(authkey, null, 3));

    var resdata = {};

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
            return loadExploreFeed(connection, uuid);
        })
        .then(function (data) {
            response.send({
                tokenstatus: 'valid',
                data: data
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

function loadExploreFeed(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT users.uuid, Campaign.cmid, Campaign.title, Campaign.description, Campaign.mission, Campaign.type, Campaign.contentbaseurl, ' +
            'Campaign.imagepath, Campaign.regdate, SUM(!ISNULL(Share.shareid)) AS sharescount, ' +
            'Client.name AS clientname, Client.bio AS clientbio ' +
            'FROM Campaign ' +
            'JOIN Client ' +
            'ON Campaign.clientid = Client.clientid ' +
            'JOIN users ' +
            'ON users.clientid = Client.clientid ' +
            'LEFT JOIN Share ' +
            'ON Campaign.cmid = Share.cmid ' +
            'WHERE Campaign.cmpstatus = ? ' +
            'AND Campaign.main_feed = ? ' +
            'GROUP BY Campaign.regdate', ['ACTIVE', false], function (err, rows) {

            if (err) {
                reject(err);
            }
            else {
                //Sorting according to last created
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
                    element.clientprofilepath = "https://s3-ap-northeast-1.amazonaws.com/" +
                        envconfig.get("s3").get("bucket") +
                        "/Users/" +
                        element.uuid +
                        "/Profile/display-pic.jpg";
                });

                connection.query('SELECT Client.bio ' +
                    'FROM Client ' +
                    'JOIN users ' +
                    'ON users.clientid = Client.clientid ' +
                    'WHERE users.uuid = ? ', [uuid], function (err, row) {

                    if (err) {
                        reject(err);
                    }
                    else {
                        console.log("rows after querying is " + JSON.stringify(rows, null, 3));

                        if(row[0]){
                            resolve({
                                explorefeed: rows,
                                biostatus: !!row[0].bio
                            });
                        }
                        else{
                            resolve({
                                explorefeed: rows,
                                biostatus: false
                            });
                        }

                    }
                });
            }

        });
    });
}

router.post('/campaign-shares', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

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
            return campaignutils.getCampaignShares(connection, cmid, 'NA');
        })
        .then(function (rows) {
            console.log("rows from getCampaignShares is " + JSON.stringify(rows, null, 3));
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
            return campaignutils.getTopCampaignShares(connection, cmid, 'NA');
        })
        .then(function (rows) {
            console.log("rows from getTopCampaignShares is " + JSON.stringify(rows, null, 3));
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