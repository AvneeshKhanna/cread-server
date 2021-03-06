/**
 * Created by avnee on 02-11-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var AWS = config.AWS;
var moment = require('moment');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var consts = require('../utils/Constants');
var utils = require('../utils/Utils');

var envtype = config.envtype;
var cache_time = consts.cache_time;
var explore_algo_base_score = consts.explore_algo_base_score;
var mark_for_collab_consts = consts.mark_for_collab;

router.get('/load', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var lastindexkey = decodeURIComponent(request.query.lastindexkey);

    var limit = envtype === 'PRODUCTION' ? 15 : 5;

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
            return loadInspirationFeed(connection, limit, lastindexkey);
        })
        .then(function (result) {
            console.log("results is " + JSON.stringify(result, null, 3));
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

    var limit = envtype === 'PRODUCTION' ? 15 : 5;

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
            if (page === 0 || page) {
                return loadInspirationFeedLegacy(connection, limit, page);
            }
            else {
                return loadInspirationFeed(connection, limit, lastindexkey);
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

function loadInspirationFeedLegacy(connection, limit, page) {

    var offset = limit * page;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Entity ' +
            'JOIN Capture ' +
            'USING(entityid) ' +
            'WHERE Entity.status = "ACTIVE" ' +
            'AND Capture.shoid IS NULL ' +
            'ORDER BY Entity.regdate DESC', [], function (err, data) {
            if (err) {
                reject(err);
            }
            else {

                var totalcount = data[0].totalcount;

                if (totalcount > 0) {
                    connection.query('SELECT Entity.entityid, Entity.merchantable, Capture.capid AS captureid, Capture.uuid, User.firstname, User.lastname ' +
                        'FROM Entity ' +
                        'JOIN Capture ' +
                        'USING(entityid) ' +
                        'JOIN User ' +
                        'ON User.uuid = Capture.uuid ' +
                        'WHERE Entity.status = "ACTIVE" ' +
                        'AND Capture.shoid IS NULL ' +
                        'ORDER BY Entity.regdate DESC ' +
                        'LIMIT ? ' +
                        'OFFSET ?', [limit, offset], function (err, rows) {
                        if (err) {
                            reject(err);
                        }
                        else {

                            rows.map(function (element) {
                                element.creatorname = element.firstname + ' ' + element.lastname;
                                element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                                element.captureurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                                element.merchantable = (element.merchantable !== 0);

                                if (element.firstname) {
                                    delete element.firstname;
                                }

                                if (element.lastname) {
                                    delete element.lastname;
                                }

                                return element;
                            });

                            resolve({
                                requestmore: totalcount > (limit + offset),
                                items: rows
                            });
                        }
                    });
                }
                else {
                    resolve({
                        requestmore: totalcount > (limit + offset),
                        items: []
                    });
                }
            }
        });
    });
}

function loadInspirationFeed(connection, limit, lastindexkey) {

    //lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp
    lastindexkey = (lastindexkey) ? Number(lastindexkey) : 0;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT (@rownr := @rownr + 1) AS row_no, Master.* ' +
            'FROM ' +
                '(SELECT Entity.entityid, Entity.regdate, Entity.merchantable, Capture.capid AS captureid, ' +
                'Capture.img_width, Capture.img_height, Capture.uuid, Capture.shoid, Capture.livefilter, User.firstname, User.lastname, ' +
                '(CASE WHEN(EA.impact_score IS NULL) THEN ? ELSE EA.impact_score END) AS impact_weight ' +
                'FROM Entity ' +
                'JOIN Capture ' +
                'USING(entityid) ' +
                'JOIN User ' +
                'ON User.uuid = Capture.uuid ' +
                'LEFT JOIN EntityAnalytics EA ' +
                'ON (EA.entityid = Entity.entityid) ' +
                'WHERE Entity.status = "ACTIVE" ' +
                //'AND Capture.shoid IS NULL ' +
                //'AND Entity.regdate < ? ' +
                'AND Entity.for_explore = 1 ' +
                'AND Entity.mark_for_collab = ? ' +
                'GROUP BY Entity.entityid ' +
                'ORDER BY impact_weight DESC) AS Master ' +
            'CROSS JOIN (SELECT @rownr := 0) AS dummy ' +
            'HAVING row_no > ? ' +
            'LIMIT ? '/* +
            'OFFSET ?'*/, [explore_algo_base_score, mark_for_collab_consts.ACCEPTED, lastindexkey, limit/*, offset*/], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                if (rows.length > 0) {
                    rows.map(function (element) {
                        element.creatorname = element.firstname + ' ' + element.lastname;
                        element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);

                        if (element.shoid) {  //Case where the capture was added on an existing writing as a collaboration
                            element.captureurl = utils.createCaptureUrl(element.uuid, element.captureid);
                        }
                        else {   //Case where the capture was added as solo (without collaboration)
                            element.captureurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                        }

                        element.merchantable = (element.merchantable !== 0);

                        if (element.firstname) {
                            delete element.firstname;
                        }

                        if (element.lastname) {
                            delete element.lastname;
                        }

                        return element;
                    });

                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: rows[rows.length - 1].row_no,//moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                        items: rows
                    });
                }
                else {
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: null,
                        items: []
                    });
                }
            }
        });
    });
}

module.exports = router;