/**
 * Created by avnee on 07-06-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var moment = require('moment');
var feedutils = require('../FeedUtils');
var commentutils = require('../../comment/CommentUtils');

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');
var consts = require('../../utils/Constants');
var utils = require('../../utils/Utils');
var userprofileutils = require('../../user-manager/UserProfileUtils');
var campaignutils = require('../../campaign/CampaignUtils');

var cache_time = consts.cache_time;

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

router.get('/load', function (request, response) {

    console.log("request headers are " + JSON.stringify(request.headers, null, 3));

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : null;
    var platform = request.query.platform;

    var limit = (config.envtype === 'PRODUCTION') ? 10 : 10;
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
            return loadFeed(connection, uuid, limit, lastindexkey);
        })
        .then(function (result) {

            if(platform !== "android"){
                result.feed = utils.filterProfileMentions(result.feed, "caption")
            }

            console.log("result is " + JSON.stringify(result, null, 3));
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if(request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')){
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

router.post('/load', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

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
            if(page === 0 || page){
                return loadFeedLegacy(connection, uuid, limit, page);
            }
            else{
                return loadFeed(connection, uuid, limit, lastindexkey);
            }
        })
        .then(function (result) {

            if(platform !== "android"){
                result.feed = utils.filterProfileMentions(result.feed, "caption")
            }

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

function loadFeed(connection, uuid, limit, lastindexkey) {
    return new Promise(function (resolve, reject) {

        lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

        console.log("TIME before start: " + moment().format('YYYY-MM-DD HH:mm:ss'));

        connection.query('SELECT Entity.caption, Entity.entityid, Entity.merchantable, Entity.type, Entity.regdate, ' +
            'Short.shoid, Short.capid AS shcaptureid, Capture.shoid AS cpshortid, Capture.capid AS captureid, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.text_long IS NOT NULL ELSE Capture.text_long IS NOT NULL END AS long_form, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.img_width ELSE Capture.img_width END AS img_width, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.img_height ELSE Capture.img_height END AS img_height, ' +
            'COUNT(DISTINCT HatsOff.uuid, HatsOff.entityid) AS hatsoffcount, ' +
            /*'COUNT(DISTINCT Comment.commid) AS commentcount, ' +*/
            'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
            'COUNT(CASE WHEN(D.uuid = ?) THEN 1 END) AS dbinarycount, ' +
            'User.uuid, User.firstname, User.lastname ' +
            'FROM Entity ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'JOIN User ' +
            'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
            /*'LEFT JOIN Comment ' +
            'ON Comment.entityid = Entity.entityid ' +*/
            'LEFT JOIN HatsOff ' +
            'ON HatsOff.entityid = Entity.entityid ' +
            'LEFT JOIN Downvote D ' +
            'ON D.entityid = Entity.entityid ' +
            'LEFT JOIN Follow ' +
            'ON Follow.followee = User.uuid ' +
            'WHERE Follow.follower = ? ' +
            'AND Entity.status = "ACTIVE" ' +
            'AND Entity.regdate < ? ' +
            'GROUP BY Entity.entityid ' +
            'ORDER BY Entity.regdate DESC ' +
            'LIMIT ? '/* +
            'OFFSET ?'*/, [uuid, uuid, uuid, lastindexkey, limit/*, offset*/], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                console.log("TIME after SQL: " + moment().format('YYYY-MM-DD HH:mm:ss'));

                if(rows.length > 0){
                    var feedEntities = rows.map(function (elem) {
                        return elem.entityid;
                    });

                    rows.map(function (element) {
                        /*var thisEntityIndex = hdata.map(function (el) {
                            return el.entityid;
                        }).indexOf(element.entityid);*/

                        element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);

                        if(element.type === 'CAPTURE'){
                            element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                        }
                        else{
                            element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                        }

                        element.hatsoffstatus = element.hbinarycount > 0;
                        element.downvotestatus = element.dbinarycount > 0;
                        // element.hatsoffcount = (thisEntityIndex !== -1 ? hdata[thisEntityIndex].hatsoffcount : 0);

                        element.creatorname = element.firstname + ' ' + element.lastname;
                        element.merchantable = (element.merchantable !== 0);
                        element.long_form = (element.long_form === 1);

                        /*if(element.capid) {
                            delete element.capid;
                        }*/

                        /*if(element.shoid) {
                            delete element.shoid;
                        }*/

                        if(element.firstname) {
                            delete element.firstname;
                        }

                        if(element.lastname) {
                            delete element.lastname;
                        }

                        if(element.hasOwnProperty('hbinarycount')) {
                            delete element.hbinarycount;
                        }

                        if(element.hasOwnProperty('dbinarycount')) {
                            delete element.dbinarycount;
                        }

                        if(element.hasOwnProperty('binarycount')) {
                            delete element.binarycount;
                        }

                        return element;
                    });

                    var candownvote;

                    commentutils.loadCommentCountsFast(connection, rows)
                        .then(function (updated_rows) {
                            rows = updated_rows;
                            return userprofileutils.getUserQualityPercentile(connection, uuid)
                        })
                        .then(function (result) {
                            candownvote = result.quality_percentile_score > consts.min_percentile_quality_user_downvote;
                            return feedutils.getCollaborationData(connection, rows);
                        })
                        .then(function (rows) {

                            /*rows.map(function (e) {
                                e.collabcount = 0;
                                return e;
                            });*/

                            console.log("TIME after getCollaborationData: " + moment().format('YYYY-MM-DD HH:mm:ss'));

                            /*return feedutils.getCollaborationCounts(connection, rows, feedEntities);*/
                            return feedutils.getCollaborationCountsFast(connection, rows);
                        })
                        .then(function (rows) {

                            console.log("TIME after getCollaborationCounts: " + moment().format('YYYY-MM-DD HH:mm:ss'));

                            resolve({
                                requestmore: rows.length >= limit,
                                candownvote: candownvote,
                                lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
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
                        candownvote: false,
                        lastindexkey: null,
                        feed: []
                    });
                }
            }
        });
    });
}

function loadFeedLegacy(connection, uuid, limit, page) {

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
            'WHERE Follow.follower = ? ' +
            'AND Entity.status = "ACTIVE" ', [uuid], function (err, data) {

            if(err){
                reject(err);
            }
            else{

                var totalcount = data[0].totalcount;
                console.log("totalcount is " + JSON.stringify(totalcount, null, 3));

                if(totalcount > 0){
                    connection.query('SELECT Entity.entityid, Entity.merchantable, Entity.type, Entity.caption, Short.shoid, Short.txt AS stext, Short.capid AS shcaptureid, Capture.shoid AS cpshortid, ' +
                        'Capture.capid AS captureid, Capture.text AS ctext, ' + 'COUNT(DISTINCT HatsOff.hoid) AS hatsoffcount, COUNT(DISTINCT Comment.commid) AS commentcount, ' +
                        'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
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
                        'AND Entity.status = "ACTIVE" ' +
                        'GROUP BY Entity.entityid ' +
                        'ORDER BY Entity.regdate DESC ' +
                        'LIMIT ? OFFSET ?', [uuid, uuid, limit, offset], function (err, rows) {
                        if (err) {
                            reject(err);
                        }
                        else {

                            if(rows.length > 0){
                                var feedEntities = rows.map(function (elem) {
                                    return elem.entityid;
                                });

                                rows.map(function (element) {
                                    /*var thisEntityIndex = hdata.map(function (el) {
                                        return el.entityid;
                                    }).indexOf(element.entityid);*/

                                    element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);

                                    if(element.type === 'CAPTURE'){
                                        element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                                    }
                                    else{
                                        element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                                    }

                                    if(element.hasOwnProperty('stext')){
                                        element.text = element.stext;
                                    }
                                    else{
                                        element.text = element.ctext;
                                    }

                                    element.hatsoffstatus = element.hbinarycount > 0;
                                    // element.hatsoffcount = (thisEntityIndex !== -1 ? hdata[thisEntityIndex].hatsoffcount : 0);

                                    element.creatorname = element.firstname + ' ' + element.lastname;
                                    element.merchantable = (element.merchantable !== 0);

                                    /*if(element.capid) {
                                        delete element.capid;
                                    }*/

                                    /*if(element.shoid) {
                                        delete element.shoid;
                                    }*/

                                    if(element.firstname) {
                                        delete element.firstname;
                                    }

                                    if(element.lastname) {
                                        delete element.lastname;
                                    }

                                    if(element.hasOwnProperty('hbinarycount')) {
                                        delete element.hbinarycount;
                                    }

                                    if(element.hasOwnProperty('binarycount')) {
                                        delete element.binarycount;
                                    }

                                    if(element.hasOwnProperty('ctext')) {
                                        delete element.ctext;
                                    }

                                    if(element.hasOwnProperty('stext')) {
                                        delete element.stext;
                                    }

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
                            else{//Case of no data
                                resolve({
                                    requestmore: totalcount > (offset + limit),
                                    feed: []
                                });
                            }
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