/**
 * Created by avnee on 09-05-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var entityintrstutils = require('../interests/EntityInterestsUtils');

router.get('/load', function (request, response) {
    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var entityid = request.query.entityid;  //Nullable
    var type = request.query.type;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection()
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return entityintrstutils.loadInterestsByType(connection, entityid, type);
        })
        .then(function (result) {
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
