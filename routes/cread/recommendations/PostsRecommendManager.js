/**
 * Created by avnee on 06-04-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var _auth = require('../../auth-token-management/AuthTokenManager');
var _authutils = require('../../auth-token-management/AuthTokenUtils');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var consts = require('../utils/Constants');
var cache_time = consts.cache_time;
var utils = require('../utils/Utils');

var postrecommendutils = require('./PostRecommendUtils');

router.get('/details', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;

    var entityid = request.query.entityid;
    var creatoruuid = request.query.creatoruuid;
    var collaboratoruuid = request.query.collaboratoruuid;
    var platform = request.query.platform;
    let memesupport = request.query.memesupport ? request.query.memesupport : 'no';

    var lastindexkey = decodeURIComponent(request.query.lastindexkey);

    var limit = config.isProduction() ? 10 : 4;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
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
            return postrecommendutils.getRecommendedPosts(connection,
                uuid,
                creatoruuid,
                collaboratoruuid,
                entityid,
                limit,
                lastindexkey,
                {
                    memesupport: memesupport
                });
        })
        .then(function (result) {
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if (platform !== "android") {
                result.items = utils.filterProfileMentions(result.items, "caption")
            }

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

router.get('/load-firsts', function (request, response) {

    let uuid = request.headers.uuid;
    let authkey = request.headers.authkey;
    let lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : "";
    let platform = request.query.platform;
    let memesupport = request.query.memesupport ? request.query.memesupport : 'no';

    let entityids;

    try {
        entityids = _authutils.decryptPayloadAuthSync(decodeURIComponent(request.headers.entityids));
    }
    catch (err) {
        console.error(err);
        response.status(500).send({
            message: 'Some error occurred at the server'
        }).end();
        return;
    }

    let limit = (config.isProduction()) ? 8 : 4;

    let connection;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
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
            return postrecommendutils.getFirstPosts(connection, uuid, entityids, limit, lastindexkey, {memesupport: memesupport});
        })
        .then(function (result) {
            if (platform !== "android") {
                result.items = utils.filterProfileMentions(result.items, "caption")
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

module.exports = router;