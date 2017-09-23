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
var consts = require('../utils/Constants');

router.post('/on-click', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;
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
            return registerHatsOff(connection, register, uuid, cmid);
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

function registerHatsOff(connection, register, uuid, cmid) {

    var sqlquery;
    var sqlparams;

    if(register){
        sqlquery = 'INSERT INTO HatsOff SET ?';
        sqlparams = {
            hoid: uuidGenerator.v4(),
            uuid: uuid,
            cmid: cmid
        }
    }
    else{
        sqlquery = 'DELETE FROM HatsOff WHERE uuid = ? AND cmid = ?';
        sqlparams = [
            uuid,
            cmid
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
}

module.exports = router;