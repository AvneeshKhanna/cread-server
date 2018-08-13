/**
 * Created by avnee on 10-01-2018.
 */
'use-strict';

const express = require('express');
const router = express.Router();

const config = require('../../Config');

const _auth = require('../../auth-token-management/AuthTokenManager');
const BreakPromiseChainError = require('../utils/BreakPromiseChainError');
const updatesutils = require('./UpdatesUtils');
const consts = require('../utils/Constants');

const cache_time = consts.cache_time;

router.get('/load', function (request, response) {

    console.log("request.headers are " + JSON.stringify(request.headers, null, 3));

    let uuid = request.headers.uuid;
    let authkey = request.headers.authkey;
    let lastindexkey = decodeURIComponent(request.query.lastindexkey);

    let limit = config.isProduction() ? 30 : 15;
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
            return updatesutils.loadUpdates(connection, uuid, lastindexkey, limit);
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
            response.set('Cache-Control', 'public, max-age=' + cache_time.high);

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

/**
 * To set the unread status of notification to false
 * */
router.post('/update-unread', function (request, response) {

    let uuid = request.body.uuid;
    let authkey = request.body.authkey;
    let updateid = request.body.updateid;

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
            return updatesutils.updateUpdatesUnreadStatus(connection, updateid);
        })
        .then(function () {
            response.send({
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

/**
 * Function to get the seen statuses for Chat and Updates screen on the app
 * */
router.get('/load-seen-status', function (request, response) {
    let uuid = request.headers.uuid;
    let authkey = request.headers.authkey;

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
            return updatesutils.getNotificationAndChatSeenStatus(connection, uuid);
        })
        .then(function (result) {
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

/**
 * To set the unseen status of notification to false
 * */
router.post('/update-unseen', function (request, response) {

    let uuid = request.body.uuid;
    let authkey = request.body.authkey;

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
            return updatesutils.updateUpdatesSeenStatus(connection, uuid);
        })
        .then(function () {
            response.send({
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