/**
 * Created by avnee on 11-10-2017.
 */

/**
 * Used to handle the basic functionalities for follow system on the app
 * */

'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

router.post('/on-click', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var follower = request.body.follower;
    var followee = request.body.followee;
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
        })
        .then(function (conn) {
            connection = conn;
            return registerFollow(connection, register, follower, followee);
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

function registerFollow(connection, register, follower, followee) {
    var sqlquery;
    var sqlparams;

    if(register){
        sqlquery = 'INSERT INTO Follow SET ?';
        sqlparams = {
            follower: follower,
            followee: followee
        }
    }
    else{
        sqlquery = 'DELETE FROM Follow WHERE follower = ? AND followee = ?';
        sqlparams = [
            follower,
            followee
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