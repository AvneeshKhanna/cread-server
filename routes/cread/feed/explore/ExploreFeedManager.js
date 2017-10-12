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
var utils = require('../../utils/Utils');

/*router.post('/load', function (request, response) {

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
            'Campaign.imagepath, Campaign.regdate, COUNT(DISTINCT Share.shareid) AS sharescount, ' +
            'Client.name AS clientname, Client.bio AS clientbio, ' +
            'COUNT (DISTINCT HatsOff.hoid) AS hatsoffcount, ' +
            'COUNT (DISTINCT Comment.commid) AS commentcount ' +
            'FROM Campaign ' +
            'JOIN Client ' +
            'ON Campaign.clientid = Client.clientid ' +
            'JOIN users ' +
            'ON users.clientid = Client.clientid ' +
            'LEFT JOIN HatsOff ' +
            'ON Campaign.cmid = HatsOff.cmid ' +
            'LEFT JOIN Share ' +
            'ON Campaign.cmid = Share.cmid ' +
            'LEFT JOIN Comment ' +
            'ON Campaign.entityid = Comment.entityid ' +
            'WHERE Campaign.cmpstatus = ? ' +
            'AND Campaign.main_feed = ? ' +
            'GROUP BY Campaign.cmid', ['ACTIVE', false], function (err, rows) {

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
                    element.clientprofilepath = utils.createProfilePicUrl(element.uuid);
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

                        var activeCmpns = rows.map(function (element) {
                            return element.cmid;
                        });

                        connection.query('SELECT cmid, uuid ' +
                            'FROM HatsOff ' +
                            'WHERE uuid = ? ' +
                            'AND cmid IN (?) ' +
                            'GROUP BY cmid', [uuid, activeCmpns], function (err, data) {

                            if (err) {
                                reject(err);
                            }
                            else {

                                rows.map(function (element) {

                                    var thisCampaignIndex = data.map(function (el) {
                                        return el.cmid;
                                    }).indexOf(element.cmid);

                                    element.hatsoffstatus = thisCampaignIndex !== -1;
                                    // element.hatsoffcount = (thisCampaignIndex !== -1 ? data[thisCampaignIndex].hatsoffcount : 0);

                                    return element;
                                });

                                console.log("response rows are " + JSON.stringify(rows, null, 3));

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
            }

        });
    });
}*/

router.post('/load', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var page = request.body.page;

    var limit = 15;
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
            return loadFeed(connection, uuid, limit, page);
        })
        .then(function (result) {
            response.send({
                tokenstatus: 'valid',
                data: result
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

function loadFeed(connection, uuid, limit, page){
    var offset = limit * page;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Entity ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'JOIN User ' +
            'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ', [null], function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                var totalcount = data[0].totalcount;

                connection.query('SELECT COUNT(*) AS totalcount ' +
                    'FROM Entity ' +
                    'LEFT JOIN Short ' +
                    'ON Short.entityid = Entity.entityid ' +
                    'LEFT JOIN Capture ' +
                    'ON Capture.entityid = Entity.entityid ' +
                    'JOIN User ' +
                    'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
                    'ORDER BY Entity.regdate DESC ' +
                    'LIMIT ? ' +
                    'OFFSET ?', [limit, offset], function (err, rows) {
                    if(err){
                        reject(err);
                    }
                    else{

                        var feedEntities = rows.map(function (elem) {
                            return elem.entityid;
                        });

                        connection.query('SELECT entityid, uuid ' +
                            'FROM HatsOff ' +
                            'WHERE uuid = ? ' +
                            'AND entityid IN (?) ' +
                            'GROUP BY entityid', [uuid, feedEntities], function(err, hdata){
                            if(err){
                                reject(err);
                            }
                            else{

                                rows.map(function (element) {
                                    var thisEntityIndex = hdata.map(function (el) {
                                        return el.entityid;
                                    }).indexOf(element.entityid);

                                    element.hatsoffstatus = thisEntityIndex !== -1;
                                    // element.hatsoffcount = (thisEntityIndex !== -1 ? hdata[thisEntityIndex].hatsoffcount : 0);

                                    return element;
                                });

                                resolve({
                                    requestmore: totalcount > (offset + limit),
                                    rows: rows
                                });

                            }
                        });
                    }
                })

            }
        });
    });

}

router.post('/campaign-shares', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;
    var page = (request.body.page !== undefined) ? request.body.page : -1;

    var limit = 30;
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
            return campaignutils.getCampaignShares(connection, cmid, 'NA', limit, page);
        })
        .then(function (result) {
            console.log("rows from getCampaignShares is " + JSON.stringify(result.rows, null, 3));
            response.send({
                tokenstatus: 'valid',
                data: {
                    shares: result.rows,
                    requestmore: result.requestmore
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

router.post('/campaign-hatsoffs', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;
    var page = request.body.page;

    var limit = 30;
    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        })
        .then(function (conn) {
            connection = conn;
            return campaignutils.getCampaignHatsOffs(connection, cmid, limit, page);
        })
        .then(function (result) {
            console.log("rows from getCampaignHatsOffs is " + JSON.stringify(result.rows, null, 3));
            response.send({
                tokenstatus: 'valid',
                data: {
                    hatsoffs: result.rows,
                    requestmore: result.requestmore
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