/**
 * Created by avnee on 06-04-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var _auth = require('../../auth-token-management/AuthTokenManager');
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
                lastindexkey);
        })
        .then(function (result) {
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if(platform !== "android"){
                result.items = utils.filterProfileMentions(result.items, "caption")
            }

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
        });

});

module.exports = router;