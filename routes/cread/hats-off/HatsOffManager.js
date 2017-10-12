/**
 * Created by avnee on 21-09-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var AWS = config.AWS;

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var uuidGenerator = require('uuid');
var moment = require('moment');

var utils = require('../utils/Utils');
var hatsoffutils = require('./HatsOffUtils');
var consts = require('../utils/Constants');

router.post('/on-click', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var register = request.body.register;

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
            return hatsoffutils.registerHatsOff(connection, register, uuid, entityid);
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });
});

router.post('/load-hatsoffs', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var page = request.body.page;

    var limit = 30;
    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        })
        .then(function (conn) {
            connection = conn;
            return hatsoffutils.loadHatsOffs(connection, entityid, limit, page);
        })
        .then(function (result) {
            console.log("rows from loadHatsOffs is " + JSON.stringify(result.rows, null, 3));
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });
});

/*function registerHatsOff(connection, register, uuid, entityid) {

    var sqlquery;
    var sqlparams;

    if(register){
        sqlquery = 'INSERT INTO HatsOff SET ?';
        sqlparams = {
            hoid: uuidGenerator.v4(),
            uuid: uuid,
            entityid: entityid
        }
    }
    else{
        sqlquery = 'DELETE FROM HatsOff WHERE uuid = ? AND entityid = ?';
        sqlparams = [
            uuid,
            entityid
        ]
    }

    return new Promise(function (resolve, reject) {
        connection.query(sqlquery, sqlparams, function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}*/

module.exports = router;