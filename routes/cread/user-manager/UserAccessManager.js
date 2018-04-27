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

/*var envconfig = require('config');
var uuidGen = require('uuid');
var request_client = require('request');*/

var CryptoJS = require('crypto-js');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var utils = require('../utils/Utils');
var useraccessutils = require('./UserAccessUtils');
var userprofileutils = require('./UserProfileUtils');
var notify = require('../../notification-system/notificationFramework');

router.post('/sign-in', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var fbid = request.body.fbid;
    var google_access_token = request.body.google_access_token;
    var fcmtoken = request.body.fcmtoken;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            if(google_access_token){
                return useraccessutils.getUserDetailsFromGoogle(google_access_token);
            }
            else {
                //Do Nothing
            }
        })
        .then(function (result) {
            if(result){ //Case where google_access_token exists in request
                return useraccessutils.checkIfUserExists(connection, undefined, result.ggl_userid);
            }
            else {  //Case where google_access_token is undefined in request
                return useraccessutils.checkIfUserExists(connection, fbid, undefined);
            }
        })
        .then(function (result) {
            if (result && fcmtoken) { //Case of existing user in DB and non-null fcmtoken in request
                return useraccessutils.addUserFcmToken(result.uuid, fcmtoken, result);
            }
            else {   //Case of new user
                return new Promise(function (resolve, reject) {
                    resolve(result);
                });
            }
        })
        .then(function (result) {
            if (result) {
                result.status = "existing-user";
            }
            else {
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

router.post('/sign-up', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var fcmtoken = request.body.fcmtoken;
    var google_access_token = request.body.google_access_token;
    var referral_code = request.body.referral_code;

    try {
        var userdata = request.body.userdata;

        if(!google_access_token){
            utils.changePropertyName(userdata, "id", "fbid");
            utils.changePropertyName(userdata, "first_name", "firstname");
            utils.changePropertyName(userdata, "last_name", "lastname");
            utils.changePropertyName(userdata, "link", "fbtimelineurl");
            utils.changePropertyName(userdata, "picture", "profilepicurl");
        }

        var userdetails = userdata;

        if(!google_access_token){
            userdetails.age_yrs_min = userdata.age_range.min;
            userdetails.age_yrs_max = userdata.age_range.max;

            delete userdata.age_range;
        }
    }
    catch (ex) {
        console.error(ex);
        response.status(500).send({
            message: 'Some error occurred at the server'
        }).end();
        return;
    }

    if (referral_code) {

        // Decrypt Data
        var decryptedBytes = CryptoJS.AES.decrypt(decodeURIComponent(referral_code).toString(), config['crypto-secret-key']);
        var payload = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));

        userdetails.referred_by = payload.referrer_uuid;
    }

    var connection;
    var new_user_uuid;
    var fb_friends_uuids;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            if(google_access_token){
                return useraccessutils.getUserDetailsFromGoogle(google_access_token);
            }
        })
        .then(function (result) {
            if(result){
                userdetails.ggl_userid = result.ggl_userid;
                userdetails.firstname = result.firstname;
                userdetails.lastname = result.lastname;
                userdetails.locale = result.locale;
                userdetails.email = result.email;
            }
        })
        .then(function () {
            return useraccessutils.checkIfPhoneExists(connection, userdetails.phone);
        })
        .then(function (result) {
            if (result) {
                response.send({
                    data: {
                        status: 'phone-exists'
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
            else {
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
            new_user_uuid = result.uuid;
            if(!google_access_token){
                return userprofileutils.copyFacebookProfilePic(userdetails.profilepicurl, result.uuid);
            }
        })
        .then(function (uuid) { //Sending a notification to the new user's Facebook friends who are on Cread
            /*new_user_uuid = uuid;*/
            if(!google_access_token){
                return userprofileutils.getUserFbFriendsViaAppToken(connection, userdetails.fbid, new_user_uuid);
            }
        })
        .then(function (fuuids) {
            if(!google_access_token){
                fb_friends_uuids = fuuids;
                if (fb_friends_uuids.length > 0) {
                    return useraccessutils.updateNewFacebookUserDataForUpdates(connection, fb_friends_uuids, new_user_uuid, "fb-friend-new");
                }
            }
        })
        .then(function () {
            if(!google_access_token){
                if (fb_friends_uuids.length > 0) {
                    var notifData = {
                        persistable: "Yes",
                        message: "Your Facebook friend " + userdetails.firstname + " " + userdetails.lastname + " is now on Cread",
                        category: "fb-friend-new",
                        actorid: new_user_uuid,
                        actorimage: utils.createSmallProfilePicUrl(new_user_uuid)
                    };
                    return notify.notificationPromise(fb_friends_uuids, notifData);
                }
            }
        })
        .then(function () {
            if (userdetails.referred_by) {
                var notifData = {
                    persistable: "No",
                    message: userdetails.firstname + " " + userdetails.lastname + " has joined Cread using your referral",
                    category: "join-referral",
                    actorid: new_user_uuid,
                    actorimage: utils.createSmallProfilePicUrl(new_user_uuid)
                };
                return notify.notificationPromise(new Array(userdetails.referred_by), notifData);
            }
        })
        .then(function () {
            return useraccessutils.addDefaultCreadKalakaarActions(connection, new_user_uuid);
        })
        .then(function () {
            throw new BreakPromiseChainError(); //To disconnect server connection
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
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
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
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

//TODO: Remove
router.post('/g-sign-up-test', function (request, response) {

    var token = request.body.token;

    try {
        function verify() {
            return new Promise(function (resolve, reject) {
                client.verifyIdToken({
                    idToken: token,
                    audience: '381917870916-vet9ejb07fqipbuok5kj0pgraf3nfrr4.apps.googleusercontent.com' // Specify the CLIENT_ID of the app that accesses the backend
                    // Or, if multiple clients access the backend:
                    //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
                })
                    .then(function (ticket) {
                        const payload = ticket.getPayload();
                        const userid = payload['sub'];
                        // If request specified a G Suite domain:
                        //const domain = payload['hd'];
                    })
                    .catch(function (err) {
                        reject(err);
                    });
            });
        }

        verify()
            .catch(console.error);
    }
    catch (ex) {
        response.status(500).send(ex).end();
    }

});

//TODO: Remove
router.get('/callback', function (request, response) {
    oauth2Client.getToken(request.query.code, function (err, tokens) {
        console.log("tokens are " + JSON.stringify(tokens, null, 3));
    });
});

module.exports = router;