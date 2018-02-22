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
var request_client = require('request');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var utils = require('../utils/Utils');
var useraccessutils = require('./UserAccessUtils');
var userprofileutils = require('./UserProfileUtils');
var notify = require('../../notification-system/notificationFramework');

router.post('/sign-in', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var fbid = request.body.fbid;
    var fcmtoken = request.body.fcmtoken;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return useraccessutils.checkIfUserExists(connection, fbid);
        })
        .then(function (result) {
            if(result && fcmtoken){ //Case of existing user and non-null fcmtoken
                return useraccessutils.addUserFcmToken(result.uuid, fcmtoken, result);
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
    var new_user_uuid;
    var fb_friends_uuids;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return useraccessutils.checkIfPhoneExists(connection, userdetails.phone);
        })
        .then(function (result) {
            if(result){
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

            return new Promise(function (resolve, reject) {
                resolve(result);
            });
        })
        .then(function (result) {
            return userprofileutils.copyFacebookProfilePic(userdetails.profilepicurl, result.uuid);
        })
        .then(function (uuid) { //Sending a notification to the new user's Facebook friends who are on Cread
            new_user_uuid = uuid;
            return userprofileutils.getUserFbFriendsViaAppToken(connection, new_user_uuid)
        })
        .then(function (fuuids) {
            fb_friends_uuids = fuuids;
            if(fb_friends_uuids.length > 0){
                return useraccessutils.updateNewFacebookUserDataForUpdates(connection, fb_friends_uuids, new_user_uuid, "fb-friend-new");
            }
        })
        .then(function () {
            if(fb_friends_uuids.length > 0){
                var notifData = {
                    persistable: "Yes",
                    message: "Your Facebook friend " + userdetails.firstname + " " + userdetails.lastname +  " is now on Cread",
                    category: "fb-friend-new",
                    actorid: new_user_uuid,
                    actorimage: utils.createSmallProfilePicUrl(new_user_uuid)
                };
                return notify.notificationPromise(fb_friends_uuids, notifData);
            }
        })
        .then(function () {
            throw new BreakPromiseChainError(); //To disconnect server connection
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

router.post('/update-fcmtoken', function (request, response) {
    var uuid = request.body.uuid;
    var fcmtoken = request.body.fcmtoken;

    console.log("request is " + JSON.stringify(request.body, null, 3));

    useraccessutils.addUserFcmToken(uuid, fcmtoken)
        .then(function () {
            response.send({
                data: {
                    status: 'done'
                }
            });
            response.end();
        })
        .catch(function (err) {
            console.error(err);
            response.status(500).send({
                message: 'Some error occurred at the server'
            }).end();
        })
});

module.exports = router;