/**
 * Created by avnee on 09-11-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var consts = require('../utils/Constants');
var utils = require('../utils/Utils');
var entityutils = require('./EntityUtils');
var captureutils = require('../capture/CaptureUtils');

var rootpath = './images/downloads/';

/*var Canvas = require('canvas'),
    Image = Canvas.Image;*/

router.post('/load-specific', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;

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
            return entityutils.loadEntityData(connection, uuid, entityid);
        })
        .then(function (result) {
            response.send({
                tokenstatus: 'valid',
                data: result
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

router.post('/delete', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;

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
            return entityutils.deactivateEntity(connection, entityid, uuid);
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

router.post('/generate-short-for-print', function (request, response) {
    var entityid = request.body.entityid;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return entityutils.retrieveShortDetails(connection, entityid);
        })
        .then(function (short) {
            return captureutils.downloadCapture(uuid, short.capid, rootpath + short.capid + '.jpg');
        })
        .then(function (capturepath) {

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