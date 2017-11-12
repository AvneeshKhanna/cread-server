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
var useraccessutils = require('./UserAccessUtils');

router.post('/sign-in', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var fbid = request.body.fbid;
    var fcmtoken = request.body.fcmtoken;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return checkIfUserExists(connection, fbid);
        })
        .then(function (result) {
            if(result){ //Case of existing user
                return useraccessutils.addUserFcmToken(result.uuid, fcmtoken, result); //TODO: Fix the issue when the user needs to add a record in DynamoDB
            }
            else{   //Case of new user
                return new Promise(function (resolve, reject) {
                    resolve(result);
                });
            }
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

            console.log("result is " + JSON.stringify(result, null, 3));

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
        connection.query('SELECT firstname, lastname, uuid, authkey FROM User WHERE fbid = ?', [fbid], function (err, rows) {
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

    var fcmtoken = request.body.fcmtoken;

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
            return useraccessutils.checkIfPhoneExists(connection, userdetails.phone);
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
                return useraccessutils.registerUserData(connection, userdetails, fcmtoken);
            }
        })
        .then(function (result) {
            return utils.commitTransaction(connection, result);
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
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

router.post('/sign-out', function (request, response) {

    var uuid = request.body.uuid;
    var fcmtoken = request.body.fcmtoken;

    useraccessutils.removeUserFcmToken(uuid, fcmtoken)
        .then(function () {
            response.send({
                data: {
                    status: 'done'
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
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