/**
 * Created by avnee on 29-08-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var AWS = config.AWS;

var moment = require('moment');

var envconfig = require('config');
var feedutils = require('../FeedUtils');

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');
var consts = require('../../utils/Constants');
var campaignutils = require('../../campaign/CampaignUtils');
var utils = require('../../utils/Utils');

var exploredatahandler = require('./ExploreFeedDataHandler');

var cache_time = consts.cache_time;
var explore_algo_base_score = consts.explore_algo_base_score;

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

router.get('/load', function (request, response) {
    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : null;
    var platform = request.query.platform;

    var limit = (config.envtype === 'PRODUCTION') ? 16 : 8; //Keep the value even for cross pattern in grid view
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
            //return exploredatahandler.getEntityDataFromCache();
        })
        .then(function (/*edata*/) {
            return loadFeed(connection, uuid, limit, /*edata, */lastindexkey);
        })
        .then(function (result) {

            if (platform !== "android") {
                result.feed = utils.filterProfileMentions(result.feed, "caption");
            }

            console.log("result is " + JSON.stringify(result, null, 3));
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if (request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')) {
                response.status(304).send().end();
            }
            else {
                response.status(200).send({
                    tokenstatus: 'valid',
                    data: result
                });
                response.end();
            }

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
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

router.post('/load', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var page = request.body.page;
    var lastindexkey = request.body.lastindexkey;
    var platform = request.body.platform;

    var limit = (config.envtype === 'PRODUCTION') ? 10 : 8;
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
            return exploredatahandler.getEntityDataFromCache();
        })
        .then(function (edata) {
            if (page === 0 || page) {
                console.log("loadFeedLegacy called");
                return loadFeedLegacy(connection, uuid, limit, page);
            }
            else {
                return loadFeed(connection, uuid, limit, edata, lastindexkey);
            }
        })
        .then(function (result) {

            if (platform !== "android") {
                result.feed = utils.filterProfileMentions(result.feed, "caption");
            }

            console.log("result is " + JSON.stringify(result, null, 3));
            response.send({
                tokenstatus: 'valid',
                data: result
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
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

/**
 * Legacy code where OFFSET based pagination is active
 * */
function loadFeedLegacy(connection, uuid, limit, page) {
    var offset = limit * page;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Entity ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'JOIN User ' +
            'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
            'WHERE Entity.status = "ACTIVE" ', null, function (err, data) {
            if (err) {
                reject(err);
            } 
            else {
                var totalcount = data[0].totalcount;

                if (totalcount > 0) {
                    connection.query('SELECT Entity.entityid, Entity.merchantable, Entity.type, Entity.caption, User.uuid, ' +
                        'User.firstname, User.lastname, Short.txt AS short, Capture.capid AS captureid, Short.shoid, ' +
                        'Short.capid AS shcaptureid, Capture.shoid AS cpshortid, ' +
                        'COUNT(DISTINCT HatsOff.hoid) AS hatsoffcount, COUNT(DISTINCT Comment.commid) AS commentcount, ' +
                        'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS binarycount, ' +
                        'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount ' +
                        'FROM Entity ' +
                        'LEFT JOIN Short ' +
                        'ON Short.entityid = Entity.entityid ' +
                        'LEFT JOIN Capture ' +
                        'ON Capture.entityid = Entity.entityid ' +
                        'JOIN User ' +
                        'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
                        'LEFT JOIN HatsOff ' +
                        'ON HatsOff.entityid = Entity.entityid ' +
                        'LEFT JOIN Comment ' +
                        'ON Comment.entityid = Entity.entityid ' +
                        'LEFT JOIN Follow ' +
                        'ON User.uuid = Follow.followee ' +
                        'WHERE Entity.status = "ACTIVE" ' +
                        'AND Entity.for_explore = 1 ' +
                        'GROUP BY Entity.entityid ' +
                        'ORDER BY Entity.regdate DESC ' +
                        'LIMIT ? ' +
                        'OFFSET ?', [uuid, uuid, limit, offset], function (err, rows) {
                        if (err) {
                            reject(err);
                        }
                        else {

                            if (rows.length > 0) {

                                var feedEntities = rows.map(function (elem) {
                                    return elem.entityid;
                                });

                                rows.map(function (element) {
                                    /*var thisEntityIndex = hdata.map(function (el) {
                                        return el.entityid;
                                    }).indexOf(element.entityid);*/

                                    if (element.type === 'CAPTURE') {
                                        element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                                    }
                                    else {
                                        element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                                    }

                                    element.creatorname = element.firstname + ' ' + element.lastname;

                                    element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                                    element.hatsoffstatus = element.hbinarycount > 0;
                                    element.followstatus = element.binarycount > 0;
                                    element.merchantable = (element.merchantable !== 0);

                                    if (element.hasOwnProperty('binarycount')) {
                                        delete element.binarycount;
                                    }

                                    if (element.hasOwnProperty('hbinarycount')) {
                                        delete element.hbinarycount;
                                    }

                                    if (element.firstname) {
                                        delete element.firstname;
                                    }

                                    if (element.lastname) {
                                        delete element.lastname;
                                    }
                                    // element.hatsoffcount = (thisEntityIndex !== -1 ? hdata[thisEntityIndex].hatsoffcount : 0);

                                    return element;
                                });

                                feedutils.getCollaborationData(connection, rows)
                                    .then(function (rows) {
                                        return feedutils.getCollaborationCounts(connection, rows, feedEntities);
                                    })
                                    .then(function (rows) {
                                        resolve({
                                            requestmore: totalcount > (offset + limit),
                                            feed: rows
                                        });
                                    })
                                    .catch(function (err) {
                                        reject(err);
                                    });
                            }
                            else {
                                resolve({
                                    requestmore: totalcount > (offset + limit),
                                    feed: []
                                });
                            }

                            /*connection.query('SELECT entityid, uuid ' +
                                'FROM HatsOff ' +
                                'WHERE uuid = ? ' +
                                'AND entityid IN (?) ' +
                                'GROUP BY entityid', [uuid, feedEntities], function(err, hdata){
                                if(err){
                                    reject(err);
                                }
                                else{
                                }
                            });*/
                        }
                    });
                }
                else {
                    resolve({
                        requestmore: totalcount > (offset + limit),
                        feed: []
                    });
                }

            }
        });
    });
}

function loadFeed(connection, uuid, limit, lastindexkey) {
    return new Promise(function (resolve, reject) {

        //lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp
        console.log("lastindexkey is " + JSON.stringify(lastindexkey, null, 3));
        lastindexkey = (lastindexkey) ? Number(lastindexkey) : 0;

        connection.query('SELECT (@rownr := @rownr + 1) AS row_no, master.* ' +
            'FROM ' +
                '(SELECT Entity.caption, Entity.entityid, Entity.merchantable, Entity.type, Entity.regdate, Entity.for_explore, ' +
                'User.uuid, User.firstname, User.lastname, Short.txt AS short, Capture.capid AS captureid, ' +
                'Short.shoid, Short.capid AS shcaptureid, Capture.shoid AS cpshortid, ' +
                '(CASE WHEN(EA.impact_score IS NULL) THEN ? ELSE EA.impact_score END) AS impact_weight, ' +
                'COUNT(DISTINCT HatsOff.uuid, HatsOff.entityid) AS hatsoffcount, ' +
                'COUNT(DISTINCT Comment.commid) AS commentcount, ' +
                'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
                'COUNT(CASE WHEN(D.uuid = ?) THEN 1 END) AS dbinarycount, ' +
                'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS binarycount ' +
                'FROM Entity ' +
                'LEFT JOIN EntityAnalytics EA ' +
                'ON (EA.entityid = Entity.entityid) ' +
                'LEFT JOIN Short ' +
                'ON Short.entityid = Entity.entityid ' +
                'LEFT JOIN Capture ' +
                'ON Capture.entityid = Entity.entityid ' +
                'JOIN User ' +
                'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
                'LEFT JOIN HatsOff ' +
                'ON HatsOff.entityid = Entity.entityid ' +
                'LEFT JOIN Downvote D ' +
                'ON D.entityid = Entity.entityid ' +
                'LEFT JOIN Comment ' +
                'ON Comment.entityid = Entity.entityid ' +
                'LEFT JOIN Follow ' +
                'ON User.uuid = Follow.followee ' +
                'WHERE Entity.status = "ACTIVE" ' +
                //'AND Entity.regdate < ? ' +
                'AND Entity.for_explore = 1 ' +
                'GROUP BY Entity.entityid ' +
                //'ORDER BY Entity.regdate DESC ' +
                'ORDER BY impact_weight DESC) master ' +
            'CROSS JOIN (SELECT @rownr := 0) AS dummy ' +
            'HAVING row_no > ? ' +
            'LIMIT ?;', [explore_algo_base_score, uuid, uuid, uuid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                if (rows.length > 0) {

                    var feedEntities = rows.map(function (elem) {
                        return elem.entityid;
                    });

                    rows.map(function (element) {
                        /*var thisEntityIndex = hdata.map(function (el) {
                            return el.entityid;
                        }).indexOf(element.entityid);*/

                        if (element.type === 'CAPTURE') {
                            element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                        }
                        else {
                            element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                        }

                        element.creatorname = element.firstname + ' ' + element.lastname;

                        element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                        element.hatsoffstatus = element.hbinarycount > 0;
                        element.downvotestatus = element.dbinarycount > 0;
                        element.followstatus = element.binarycount > 0;
                        element.merchantable = (element.merchantable !== 0);

                        if (element.hasOwnProperty('binarycount')) {
                            delete element.binarycount;
                        }

                        if (element.hasOwnProperty('hbinarycount')) {
                            delete element.hbinarycount;
                        }

                        if (element.hasOwnProperty('dbinarycount')) {
                            delete element.dbinarycount;
                        }

                        if (element.firstname) {
                            delete element.firstname;
                        }

                        if (element.lastname) {
                            delete element.lastname;
                        }

                        if(element.hasOwnProperty('for_explore')){
                            delete element.for_explore;
                        }

                        return element;
                    });

                    lastindexkey = rows[rows.length - 1].row_no;//moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss');

                    //--Retrieve Collaboration Data--

                    feedutils.getCollaborationData(connection, rows)
                        .then(function (rows) {

                            /*rows.map(function (e) {
                                e.collabcount = 0;
                                return e;
                            });*/

                            return feedutils.getCollaborationCounts(connection, rows, feedEntities);
                        })
                        /*.then(function (rows) {
                            return feedutils.structureDataCrossPattern(rows);
                        })*/
                        .then(function (rows) {
                            resolve({
                                requestmore: rows.length >= limit,
                                lastindexkey: lastindexkey,
                                feed: rows
                            });
                        })
                        .catch(function (err) {
                            reject(err);
                        });

                }
                else {  //Case of no data
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: null,
                        feed: []
                    });
                }
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