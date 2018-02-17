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

    var chat_id = request.query.chat_id;
    var lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : null;

    var connection;
    var limit = (config.envtype === 'PRODUCTION') ? 25 : 15;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return chatconvoutils.loadChatMessages(connection, chat_id, limit, lastindexkey);
        })
        .then(function (result) {
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
        });

});

module.exports = router;