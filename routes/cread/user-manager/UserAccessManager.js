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
var utils = require('../utils/Utils');

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
                result.status = "existing-user";
            }
            else{
                result = {
                    status: "new-user"
                };
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

    console.log("request is " + JSON.stringify(request.body, null, 3));

    try{
        var userdata = request.body.userdata;

        utils.changePropertyName(userdata, "id", "fbid");
        utils.changePropertyName(userdata, "first_name", "firstname");
        utils.changePropertyName(userdata, "last_name", "lastname");
        utils.changePropertyName(userdata, "link", "fbtimelineurl");
        utils.changePropertyName(userdata, "picture", "profilepicurl");

        var userdetails = userdata;

        userdetails.age_yrs_min = userdata.age_range.min;
        userdetails.age_yrs_max = userdata.age_range.max;

        delete userdata.age_range;
    }
    catch(ex){
        console.error(ex);
    }

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return checkIfPhoneExists(connection, userdetails.phone);
        })
        .then(function (phoneExists) {
            if(phoneExists){
                response.send({
                    data: {
                        status: 'phone-exists'
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
            else{
                return registerUserData(connection, userdetails);
            }
        })
        .then(function (result) {

            result.status = 'done';

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

function registerUserData(connection, userdetails) {

    var uuid = uuidGen.v4();
    var authkey = _auth.generateToken({
        fbid: userdetails.fbid
    });

    userdetails.uuid = uuid;
    userdetails.authkey = authkey;

    return new Promise(function (resolve, reject) {
        connection.query('INSERT INTO User SET ?', [userdetails], function (err, rows) {
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