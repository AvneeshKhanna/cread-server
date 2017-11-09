/**
 * Created by avnee on 09-11-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var uuidgen = require('uuid');

var config = require('../../../Config');

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');
var buytrackutils = require('./BuyTrackUtils');

router.post('/load', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var page = request.body.page;

    var limit = 20;

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
            return buytrackutils.loadOrderTrackDetails(connection, uuid, limit, page);
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

module.exports = router;