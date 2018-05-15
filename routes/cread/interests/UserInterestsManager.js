/**
 * Created by avnee on 01-08-2017.
 */
'use strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var userintrstutils = require('./UserInterestsUtils');

router.get('/load', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;

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
            return userintrstutils.loadAllInterestsForUser(connection, uuid);
        })
        .then(function (result) {
            response.send({
                tokenstatus: "valid",
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

router.post('/update', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var interests = request.body.interests; //array of interest ids
    var register = request.body.register;

    if(!(interests instanceof Array)){
        console.error(new Error('"interests" body parameter should be of type array'));
        response.status(500).send({
            message: config.isProduction() ? '' : '"interests" body parameter should be of type array'
        });
        return;
    }

    console.log("request is " + JSON.stringify(request.body, null, 3));

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
            return userintrstutils.updateUserInterests(connection, uuid, interests, register);
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
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });
});

module.exports = router;