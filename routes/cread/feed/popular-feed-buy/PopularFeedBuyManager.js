/**
 * Created by avnee on 26-04-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');

var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');
var consts = require('../../utils/Constants');
var cache_time = consts.cache_time;

var popularfeedbuyutils = require('./PopularFeedBuyUtils');

router.get('/load', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : null;

    //TODO: Code web access token validation system
    var web_access_token = request.headers.web_access_token;

    var limit = config.isProduction() ? 15 : 8;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return popularfeedbuyutils.loadFeed(connection, limit, lastindexkey);
        })
        .then(function (result) {
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