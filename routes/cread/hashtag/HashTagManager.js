/**
 * Created by avnee on 18-12-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var hashtagutils = require('./HashTagUtils');
var utils = require('../utils/Utils');

var consts = require('../utils/Constants');
var cache_time = consts.cache_time;

router.get('/feed', function (request, response) {

    console.log("request headers " + JSON.stringify(request.headers, null, 3));

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var htag = decodeURIComponent(request.query.htag).toLowerCase();
    var lastindexkey = decodeURIComponent(request.query.lastindexkey);
    var platform = request.query.platform;

    var limit = (config.envtype === 'PRODUCTION') ? 15 : 3;
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
            return hashtagutils.loadHashtagFeed(connection, uuid, limit, htag, lastindexkey);
        })
        .then(function (result) {

            if(platform !== "android"){
                result.feed = utils.filterProfileMentions(result.feed, "caption");
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

module.exports = router;