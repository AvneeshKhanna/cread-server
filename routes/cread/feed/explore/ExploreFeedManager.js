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
    var lastindexkey = request.body.lastindexkey;

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
                console.log("loadFeedLegacy called");
                return loadFeedLegacy(connection, uuid, limit, page);
            }
            else{
                return loadFeed(connection, uuid, limit, lastindexkey);
            }
        })
        .then(function (result) {
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

                if(totalcount > 0){
                    connection.query('SELECT Entity.entityid, Entity.merchantable, Entity.type, User.uuid, User.firstname, User.lastname, Short.txt AS short, Capture.capid AS captureid, Short.shoid, ' +
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
                        'GROUP BY Entity.entityid ' +
                        'ORDER BY Entity.regdate DESC ' +
                        'LIMIT ? ' +
                        'OFFSET ?', [uuid, uuid, limit, offset], function (err, rows) {
                        if(err){
                            reject(err);
                        }
                        else{

                            /*var feedEntities = rows.map(function (elem) {
                                return elem.entityid;
                            });*/

                            rows.map(function (element) {
                                /*var thisEntityIndex = hdata.map(function (el) {
                                    return el.entityid;
                                }).indexOf(element.entityid);*/

                                if(element.type === 'CAPTURE'){
                                    element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                                }
                                else{
                                    element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                                }

                                element.creatorname = element.firstname + ' ' + element.lastname;

                                element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                                element.hatsoffstatus = element.hbinarycount > 0;
                                element.followstatus = element.binarycount > 0;
                                element.merchantable = (element.merchantable !== 0);

                                if(element.hasOwnProperty('binarycount')){
                                    delete element.binarycount;
                                }

                                if(element.hasOwnProperty('hbinarycount')){
                                    delete element.hbinarycount;
                                }

                                if(element.firstname) {
                                    delete element.firstname;
                                }

                                if(element.lastname) {
                                    delete element.lastname;
                                }
                                // element.hatsoffcount = (thisEntityIndex !== -1 ? hdata[thisEntityIndex].hatsoffcount : 0);

                                return element;
                            });

                            resolve({
                                requestmore: totalcount > (offset + limit),
                                feed: rows
                            });

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
                else{
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

        lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

        connection.query('SELECT Entity.caption, Entity.entityid, Entity.merchantable, Entity.type, Entity.regdate, Entity.for_explore, ' +
            'User.uuid, User.firstname, User.lastname, Short.txt AS short, Capture.capid AS captureid, ' +
            'Short.shoid, Short.capid AS shcaptureid, Capture.shoid AS cpshortid, ' +
            'COUNT(DISTINCT HatsOff.uuid, HatsOff.entityid) AS hatsoffcount, ' +
            'COUNT(DISTINCT Comment.commid) AS commentcount, ' +
            'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
            'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS binarycount ' +
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
            'AND Entity.regdate < ? ' +
            'GROUP BY Entity.entityid ' +
            'ORDER BY Entity.regdate DESC ' +
            'LIMIT ? '/* +
            'OFFSET ?'*/, [uuid, uuid, lastindexkey, limit/*, offset*/], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                if (rows.length > 0) {

                    rows = rows.filter(function (el) {
                        return (el.for_explore === 1);
                    });

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

                        if(element.hasOwnProperty('for_explore')){
                            delete element.for_explore;
                        }

                        return element;
                    });

                    //--Retrieve Collaboration Data--

                    feedutils.getCollaborationData(connection, rows)
                        .then(function (rows) {

                            /*rows.map(function (e) {
                                e.collabcount = 0;
                                return e;
                            });*/

                            return feedutils.getCollaborationCounts(connection, rows, feedEntities);
                        })
                        .then(function (rows) {
                            resolve({
                                requestmore: rows.length >= limit,//totalcount > (offset + limit),
                                lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                                feed: rows
                            });
                        })
                        .catch(function (err) {
                            reject(err);
                        });

                    /*var shcaptureids = rows.filter(function (element) {
                        return !!(element.shcaptureid);
                    }).map(function (element) {
                        return element.shcaptureid;
                    });

                    console.log("shcaptureids are " + JSON.stringify(shcaptureids, null, 3));

                    var cpshortids = rows.filter(function (element) {
                        return !!(element.cpshortid);
                    }).map(function (element) {
                        return element.cpshortid;
                    });

                    console.log("cpshortids are " + JSON.stringify(cpshortids, null, 3));

                    var collabdataquery;
                    var collabsqlparams;
                    var retrievecollabdata = true;

                    if(cpshortids.length !== 0 && shcaptureids.length !== 0){
                        collabdataquery = 'SELECT Entity.entityid, Short.shoid, Capture.capid, UserS.firstname AS sfirstname, ' +
                            'UserS.lastname AS slastname, UserS.uuid AS suuid, UserC.firstname AS cfirstname, ' +
                            'UserC.lastname AS clastname, UserC.uuid  AS cuuid ' +
                            'FROM Entity ' +
                            'LEFT JOIN Short ' +
                            'ON Entity.entityid = Short.entityid ' +
                            'LEFT JOIN Capture ' +
                            'ON Entity.entityid = Capture.entityid ' +
                            'LEFT JOIN User AS UserS ' +
                            'ON Capture.uuid = UserS.uuid ' +
                            'LEFT JOIN User AS UserC ' +
                            'ON Short.uuid = UserC.uuid ' +
                            'WHERE Entity.entityid IN (?) ' +
                            'AND Capture.capid IN (?) ' +
                            'OR Short.shoid IN (?)';
                        collabsqlparams = [
                            feedEntities,
                            shcaptureids,
                            cpshortids
                        ];
                    }
                    else if(cpshortids.length === 0 && shcaptureids.length !== 0){
                        collabdataquery = 'SELECT Entity.entityid, Short.shoid, Capture.capid, UserS.firstname AS sfirstname, ' +
                            'UserS.lastname AS slastname, UserS.uuid AS suuid ' + //', UserC.firstname AS cfirstname, ' +
                            // 'UserC.lastname AS clastname, UserC.uuid  AS cuuid ' +
                            'FROM Entity ' +
                            // 'LEFT JOIN Short ' +
                            // 'ON Entity.entityid = Short.entityid ' +
                            'LEFT JOIN Capture ' +
                            'ON Entity.entityid = Capture.entityid ' +
                            'LEFT JOIN User AS UserS ' +
                            'ON Capture.uuid = UserS.uuid ' +
                            /!*'LEFT JOIN User AS UserC ' +
                            'ON Short.uuid = UserC.uuid ' +*!/
                            'WHERE Entity.entityid IN (?) ' +
                            'AND Capture.capid IN (?) '/!* +
                            'OR Capture.shoid IN (?)'*!/;

                        collabsqlparams = [
                            feedEntities,
                            shcaptureids/!*,
                            cpshortids*!/
                        ];
                    }
                    else if(cpshortids.length !== 0 && shcaptureids.length === 0){
                        collabdataquery = 'SELECT Entity.entityid, Short.shoid, Capture.capid, UserC.firstname AS cfirstname, ' +
                            'UserC.lastname AS clastname, UserC.uuid  AS cuuid ' +
                            'FROM Entity ' +
                            'LEFT JOIN Short ' +
                            'ON Entity.entityid = Short.entityid ' +
                            'LEFT JOIN User AS UserC ' +
                            'ON Short.uuid = UserC.uuid ' +
                            'WHERE Entity.entityid IN (?) ' +
                            'AND Short.shoid IN (?)';
                        collabsqlparams = [
                            cpshortids
                        ];
                    }
                    else{
                        retrievecollabdata = false;
                    }

                    if(retrievecollabdata){
                        //Retrieve collaboration data
                        connection.query(collabdataquery, collabsqlparams, function(err, collab_rows){
                            if(err){
                                reject(err);
                            }
                            else{

                                console.log("collab_rows are " + JSON.stringify(collab_rows, null, 3));

                                collab_rows.forEach(function (collab) {

                                    var row_element;

                                    if(collab.shoid){   //Case where rows[i] is of type CAPTURE & collab_rows[i] is of type SHORT
                                        row_element = rows[rows.map(function (e) {
                                            if(!e.cpshortid){
                                                e.cpshortid = null;
                                            }
                                            return e.cpshortid;
                                        }).indexOf(collab.shoid)];

                                        row_element.cpshort = {
                                            firstname: collab.cfirstname,
                                            lastname: collab.clastname,
                                            uuid: collab.cuuid
                                        }
                                    }
                                    else{   //Case where rows[i] is of type SHORT & collab_rows[i] is of type CAPTURE
                                        row_element = rows[rows.map(function (e) {
                                            if(!e.shcaptureid){
                                                e.shcaptureid = null;
                                            }
                                            return e.shcaptureid;
                                        }).indexOf(collab.capid)];

                                        row_element.shcapture = {
                                            firstname: collab.sfirstname,
                                            lastname: collab.slastname,
                                            uuid: collab.suuid
                                        }
                                    }
                                });

                                resolve({
                                    requestmore: rows.length >= limit,//totalcount > (offset + limit),
                                    lastindexkey: moment(rows[rows.length - 1].regdate).format('YYYY-MM-DD hh:mm:ss'),
                                    feed: rows
                                });
                            }
                        });
                    }
                    else{
                        resolve({
                            requestmore: rows.length >= limit,//totalcount > (offset + limit),
                            lastindexkey: moment(rows[rows.length - 1].regdate).format('YYYY-MM-DD hh:mm:ss'),
                            feed: rows
                        });
                    }*/

                }
                else {  //Case of no data
                    resolve({
                        requestmore: rows.length >= limit,//totalcount > (offset + limit),
                        lastindexkey: null,
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
                        rows.map(function (element) {
                            var thisEntityIndex = hdata.map(function (el) {
                                return el.entityid;
                            }).indexOf(element.entityid);

                            if(element.type === 'CAPTURE'){
                                element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                            }
                            else{
                                element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                            }

                            element.creatorname = element.firstname + ' ' + element.lastname;

                            element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                            element.hatsoffstatus = thisEntityIndex !== -1;
                            element.followstatus = element.binarycount > 0;
                            element.merchantable = (element.merchantable !== 0);

                            if(element.binarycount){
                                delete element.binarycount;
                            }

                            if(element.firstname) {
                                delete element.firstname;
                            }

                            if(element.lastname) {
                                delete element.lastname;
                            }
                            // element.hatsoffcount = (thisEntityIndex !== -1 ? hdata[thisEntityIndex].hatsoffcount : 0);

                            return element;
                        });

                        resolve({
                            requestmore: totalcount > (offset + limit),
                            feed: rows
                        });
                    }
                });*/
            }
        });

        /*connection.query('SELECT COUNT(*) AS totalcount ' +
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

                if(totalcount > 0){

                }
                else{
                    resolve({
                        requestmore: totalcount > (offset + limit),
                        feed: []
                    });
                }

            }
        });*/
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