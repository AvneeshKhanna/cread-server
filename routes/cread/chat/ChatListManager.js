/**
 * Created by avnee on 14-02-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var chatlistutils = require('./ChatListUtils');

var consts = require('../utils/Constants');
var cache_time = consts.cache_time;

router.get('/load', function (request, response) {

    var uuid = request.headers.uuid;
    var lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : null;

    var limit = (config.envtype === 'PRODUCTION') ? 25 : 1;

    console.log("request headers are " + JSON.stringify(request.headers, null, 3));

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return chatlistutils.loadPermittedChats(connection, uuid, limit, lastindexkey);
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
            response.set('Cache-Control', 'public, max-age=' + 2/*cache_time.xhigh*/);  //TODO: Increase cache expiry time

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

    /*response.status(200).send({
        tokenstatus: 'valid',
        data: {
            chatlist: dummy,
            requestmore: false,
            lastindexkey: null
        }
    });
    response.end();*/

});

router.get('/load-requests', function (request, response) {

    var uuid = request.headers.uuid;
    var lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : null;

    var limit = (config.envtype === 'PRODUCTION') ? 25 : 1;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return chatlistutils.loadChatRequests(connection, uuid, limit, lastindexkey);
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
            response.set('Cache-Control', 'public, max-age=' + cache_time.xhigh);

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

    /*response.status(200).send({
        tokenstatus: 'valid',
        data: {
            chatlist: dummy,
            requestmore: false,
            lastindexkey: null
        }
    });
    response.end();*/

});

router.get('/requests-count', function (request, response) {

    var uuid = request.headers.uuid;

    console.log("headers are " + JSON.stringify(request.headers, null, 3));

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return chatlistutils.getChatRequestsCount(connection, uuid);
        })
        .then(function (count) {
            console.log("request count is " + JSON.stringify(count, null, 3));
            response.send({
                requestcount: count
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
        });

});

router.post('/mark-as-read', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var chatid = request.body.chatid;

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
            return chatlistutils.markChatAsRead(connection, chatid, uuid);
        })
        .then(function () {
            response.status(200).send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
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
        });
});

module.exports = router;