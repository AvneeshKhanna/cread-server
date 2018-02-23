/**
 * Created by avnee on 14-02-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var uuidgen = require('uuid');

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var chatconvoutils = require('./ChatConversationUtils');
var consts = require('../utils/Constants');
var cache_time = consts.cache_time;

router.get('/load-messages', function (request, response) {

    var from_uuid = request.query.from_uuid;
    var to_uuid = request.query.to_uuid;
    var lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : null;

    var connection;
    var limit = (config.envtype === 'PRODUCTION') ? 30 : 15;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return chatconvoutils.loadChatMessages(connection, from_uuid, to_uuid, limit, lastindexkey);
        })
        .then(function (result) {

            console.log("result is " + JSON.stringify(result, null, 3));

            response.set('Cache-Control', 'public, max-age=' + 2/*cache_time.medium*/); //TODO: Increase cache expiry time

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