/**
 * Created by avnee on 22-11-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var utils = require('../utils/Utils');
var shortutils = require('./ShortUtils');

router.get('/load-specific', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var entityid = decodeURIComponent(request.query.entityid);
    var type = request.query.type;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokentstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            var select = [
                'shoid',
                'textcolor',
                'textsize',
                'textgravity',
                'bgcolor',
                'dx',
                'dy',
                'img_width',
                'txt_width',
                'txt_height',
                'imgtintcolor',
                'filtername',
                'text_long',
                'textshadow',
                'shape',
                'entityid',
                'capid',
                'bold',
                'italic',
                'font'
            ];
            return shortutils.getShortDetailsFromCollab(connection, entityid, type, select);
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
            // response.set('Cache-Control', 'public, max-age=1');
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

router.post('/load-specific', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var shoid = request.body.shoid;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokentstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            var select = [
                'textcolor',
                'textsize',
                'txt AS text',
                'bold',
                'italic',
                'font'
            ];
            return shortutils.retrieveShortDetails(connection, shoid, select);
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

module.exports = router;