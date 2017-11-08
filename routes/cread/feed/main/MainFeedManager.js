/**
 * Created by avnee on 07-06-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');
var consts = require('../../utils/Constants');
var utils = require('../../utils/Utils');
var campaignutils = require('../../campaign/CampaignUtils');

/*router.post('/load/', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;

    console.log("request is " + JSON.stringify(request.body, null, 3));

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
                'Campaign.imagepath, Campaign.regdate, COUNT(DISTINCT CASE WHEN(Share.checkstatus = "COMPLETE") THEN Share.shareid END) AS sharescount, ' +
                'Client.name AS clientname, Client.bio AS clientbio, ' +
                'COUNT (DISTINCT HatsOff.hoid) AS hatsoffcount, ' +
                'COUNT (DISTINCT Comment.commid) AS commentcount ' +
                'FROM Campaign ' +
                'JOIN Client ' +
                'ON Campaign.clientid = Client.clientid ' +
                'LEFT JOIN HatsOff ' +
                'ON Campaign.cmid = HatsOff.cmid ' +
                'LEFT JOIN Share ' +
                'ON Campaign.cmid = Share.cmid ' +
                'LEFT JOIN Comment ' +
                'ON Comment.entityid = Campaign.entityid ' +
                'WHERE Campaign.cmpstatus = ? ' +
                'AND Campaign.budget > 0 ' +
                'AND Campaign.main_feed = ? ' +
                'GROUP BY Campaign.cmid', ['ACTIVE', true], function (err, rows) {

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

                        var activeCmpns = rows.map(function (element) {
                            return element.cmid;
                        });

                        connection.query('SELECT cmid, uuid ' +
                            'FROM HatsOff ' +
                            'WHERE uuid = ? ' +
                            'AND cmid IN (?) ' +
                            'GROUP BY cmid', [uuid, activeCmpns], function (err, data) {

                            if (err) {
                                console.error(err);
                                throw err;
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
                    }
                });

            });
        }
    });

});*/

router.post('/load', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var page = request.body.page;

    var limit = 5;  //TODO: Change to 15
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
            console.log("result in response is " + JSON.stringify(result, null, 3));
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
                    message: 'Some error occurred at the server'
                }).end();
            }
        })
});

function loadFeed(connection, uuid, limit, page) {

    var offset = page * limit;

    return new Promise(function (resolve, reject) {

        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Entity ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'JOIN User ' +
            'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
            'JOIN Follow ' +
            'ON Follow.followee = User.uuid ' +
            'WHERE Follow.follower = ? ', [uuid], function (err, data) {

            if(err){
                reject(err);
            }
            else{

                var totalcount = data[0].totalcount;
                console.log("totalcount is " + JSON.stringify(totalcount, null, 3));

                if(totalcount > 0){
                    connection.query('SELECT Entity.entityid, Entity.type, Short.shoid, ' +
                        'Capture.capid AS captureid, COUNT(DISTINCT HatsOff.hoid) AS hatsoffcount, COUNT(DISTINCT Comment.commid) AS commentcount, ' +
                        'User.uuid, User.firstname, User.lastname ' +
                        'FROM Entity ' +
                        'LEFT JOIN Short ' +
                        'ON Short.entityid = Entity.entityid ' +
                        'LEFT JOIN Capture ' +
                        'ON Capture.entityid = Entity.entityid ' +
                        'JOIN User ' +
                        'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
                        'LEFT JOIN Comment ' +
                        'ON Comment.entityid = Entity.entityid ' +
                        'LEFT JOIN HatsOff ' +
                        'ON HatsOff.entityid = Entity.entityid ' +
                        'LEFT JOIN Follow ' +
                        'ON Follow.followee = User.uuid ' +
                        'WHERE Follow.follower = ? ' +
                        'GROUP BY Entity.entityid ' +
                        'ORDER BY Entity.regdate DESC ' +
                        'LIMIT ? OFFSET ?', [uuid, limit, offset], function (err, rows) {
                        if (err) {
                            reject(err);
                        }
                        else {

                            console.log("rows from SELECT Entity.entityid ... query is " + JSON.stringify(rows, null, 3));

                            var feedEntities = rows.map(function (elem) {
                                return elem.entityid;
                            });

                            connection.query('SELECT entityid, uuid ' +
                                'FROM HatsOff ' +
                                'WHERE uuid = ? ' +
                                'AND entityid IN (?) ' +
                                'GROUP BY entityid', [uuid, feedEntities], function (err, hdata) {

                                if (err) {
                                    reject(err);
                                }
                                else {

                                    rows.map(function (element) {
                                        var thisEntityIndex = hdata.map(function (el) {
                                            return el.entityid;
                                        }).indexOf(element.entityid);

                                        element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);

                                        if(element.type === 'CAPTURE'){
                                            element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                                        }
                                        else{
                                            element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                                        }

                                        element.hatsoffstatus = thisEntityIndex !== -1;
                                        // element.hatsoffcount = (thisEntityIndex !== -1 ? hdata[thisEntityIndex].hatsoffcount : 0);

                                        element.creatorname = element.firstname + ' ' + element.lastname;

                                        /*if(element.capid) {
                                            delete element.capid;
                                        }*/

                                        if(element.shoid) {
                                            delete element.shoid;
                                        }

                                        if(element.firstname) {
                                            delete element.firstname;
                                        }

                                        if(element.lastname) {
                                            delete element.lastname;
                                        }

                                        return element;
                                    });

                                    resolve({
                                        requestmore: totalcount > (offset + limit),
                                        feed: rows
                                    });
                                }

                            });
                        }
                    });
                }
                else {  //Case of no data
                    resolve({
                        requestmore: totalcount > (offset + limit),
                        feed: []
                    });
                }
            }

        });
    });
}

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

                connection.query('SELECT users.fbusername, HatsOff.cmid ' +
                    'FROM users ' +
                    'LEFT JOIN HatsOff ' +
                    'ON users.UUID = HatsOff.uuid ' +
                    'WHERE users.UUID = ? ' +
                    'AND HatsOff.cmid = ? ', [uuid, cmid], function (err, user) {
                    if (err) {
                        throw err;
                    }
                    else {
                        console.log("row after querying is " + JSON.stringify(user, null, 3));

                        response.send({
                            tokenstatus: 'valid',
                            data: {
                                campaign: row[0],
                                fbidstatus: user[0].fbusername !== null,
                                hatsoffstatus: (user[0].cmid !== null)
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
    var page = (request.body.page !== undefined) ? request.body.page : -1;

    var limit = 30;
    var connection;

    console.log("request is " + JSON.stringify(request.body, null, 3));

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
            return campaignutils.getCampaignShares(connection, cmid, 'COMPLETE', limit, page);
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

module.exports = router;