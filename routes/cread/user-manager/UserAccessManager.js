/**
 * Created by avnee on 13-10-2017.
 */

/**
 * Handles functions regarding sign-in, sign-up and sign-out
 * */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var envconfig = require('config');
var uuidGen = require('uuid');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

//TODO: Add FCM Token part

router.post('/sign-in', function (request, response) {

    var fbid = request.body.fbid;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return checkIfUserExists(connection, fbid);
        })
        .then(function (result) {
            if(result){
                if(result.authkey){
                    result.authkey = _auth.generateToken({
                        fbid: fbid
                    });
                }
                result.status = "existing-user";
            }
            else{
                result.status = "new-user";
            }

            response.send({
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

function checkIfUserExists(connection, fbid){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT uuid, authkey FROM User WHERE fbid = ?', [fbid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows[0]);
            }
        });
    });
}

router.post('/sign-up', function (request, response) {

    var userdata = request.body.userdata;
    var phone = request.body.phone;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return checkIfPhoneExists(connection, phone);
        })
        .then(function (phoneExists) {
            if(phoneExists){
                response.send({
                    status: 'phone-exists'
                });
                response.end();
                throw new BreakPromiseChainError();
            }
            else{
                return registerUserData(connection, userdata);
            }
        })
        .then(function (result) {

            result.status = 'done';

            response.send(result);
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

function checkIfPhoneExists(connection, phone) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT phone FROM User WHERE phone = ?', [phone], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                if (rows[0]) {
                    resolve(true);
                }
                else{
                    resolve(false);
                }
            }
        });
    });
}

function registerUserData(connection, userdata) {

    var uuid = uuidGen.v4();
    var authkey = _auth.generateToken({
        fbid: userdata.fbid
    });

    userdata.uuid = uuid;
    userdata.authkey = authkey;

    return new Promise(function (resolve, reject) {
        connection.query('INSERT INTO User SET ?', [userdata], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve({
                    uuid: uuid,
                    authkey: authkey
                });
            }
        });
    });
}

module.exports = router;