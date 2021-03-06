/**
 * Created by avnee on 11-10-2017.
 */

/**
 * Is used to handle the server endpoints for follow system
 * */

'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var notify = require('../../notification-system/notificationFramework');

var followutils = require('./FollowUtils');
var userprofileutils = require('../user-manager/UserProfileUtils');
var utils = require('../utils/Utils');

var consts = require('../utils/Constants');
var cache_time = consts.cache_time;
var updatesutils = require('../updates/UpdatesUtils');

router.post('/on-click', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var followees = request.body.followees; //Is of type array to support batch-following system
    var register = request.body.register;

    if(!(followees instanceof Array)){
        console.error('Parameter "followees" should be of the type Array');
        response.status(500).send({
            message: 'Parameter "followees" should be of the type Array'
        });
        response.end();
        return;
    }

    var connection;
    var requesterdetails;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
            requesterdetails = details;
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
            return followutils.registerFollow(connection, register, uuid, followees);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();
        })
        .then(function () {
            return followutils.updateFollowDataForUpdates(connection, register, followees, uuid);
        })
        .then(function () {
            if(register){
                var notifData = {
                    message: requesterdetails.firstname + " " +  requesterdetails.lastname + " has started following you on Cread",
                    actorid: uuid,
                    actorimage: utils.createSmallProfilePicUrl(uuid),
                    category: "follow",
                    persistable: "Yes"
                };
                return notify.notificationPromise(followees, notifData);
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

/**
 * To follow all Facebook friends at once who are on the app
 * */
//TODO: Error handling for app message
router.post('/fb-friends-all', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var fbid = request.body.fbid;
    var fbaccesstoken = request.body.fbaccesstoken;

    var connection;
    var friendsuuids;
    var requesterdetails;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
            requesterdetails = details;
            return new config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return userprofileutils.loadAllFacebookFriends(connection, uuid, fbid, fbaccesstoken);
        })
        .then(function (fuuids) {
            friendsuuids = fuuids;
            console.log("friendsuuids " + JSON.stringify(friendsuuids, null, 3));
            if(friendsuuids.length !== 0){
                return followutils.registerFollow(connection, true, uuid, friendsuuids);
            }
        })
        .then(function () {
            console.log('Sending response');
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();
        })
        .then(function () {
            if(friendsuuids.length > 0){
                var notifData = {
                    message: requesterdetails.firstname + " " +  requesterdetails.lastname + " has started following you on Cread",
                    actorid: uuid,
                    actorimage: utils.createSmallProfilePicUrl(uuid),
                    category: "follow",
                    persistable: "Yes"
                };
                return notify.notificationPromise(friendsuuids, notifData);
            }
            else{
                throw new BreakPromiseChainError();     //To disconnect server connection
            }
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

router.get('/load-followers', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var requesteduuid = decodeURIComponent(request.query.requesteduuid);
    var lastindexkey = decodeURIComponent(request.query.lastindexkey);
    var web_access_token = request.headers.wat;

    var limit = config.isProduction() ? 25 : 10;
    var connection;

    _auth.authValidWeb(web_access_token)
        .then(function (payload) {
            if(web_access_token){
                uuid = payload.uuid;
            }
        })
        .then(function () {
            if(!web_access_token){
                return _auth.authValid(uuid, authkey)
            }
        })
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
            return followutils.loadFollowers(connection, requesteduuid, limit, lastindexkey);
        })
        .then(function (result) {
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if(request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')){
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.post('/load-followers', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var requesteduuid = request.body.requesteduuid;
    var page = request.body.page;
    var lastindexkey = request.body.lastindexkey;

    var limit = 25;
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
            if(page === 0 || page){
                return followutils.loadFollowersLegacy(connection, requesteduuid, limit, page);
            }
            else{
                return followutils.loadFollowers(connection, requesteduuid, limit, lastindexkey);
            }
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.get('/load-following', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var requesteduuid = decodeURIComponent(request.query.requesteduuid);
    var lastindexkey = decodeURIComponent(request.query.lastindexkey);
    var web_access_token = request.headers.wat;

    var limit = config.isProduction() ? 25 : 2;
    var connection;

    _auth.authValidWeb(web_access_token)
        .then(function (payload) {
            if(web_access_token){
                uuid = payload.uuid;
            }
        })
        .then(function () {
            if(!web_access_token){
                return _auth.authValid(uuid, authkey)
            }
        })
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
            return followutils.loadFollowing(connection, requesteduuid, limit, lastindexkey);
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if(request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')){
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.post('/load-following', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var requesteduuid = request.body.requesteduuid;
    var limit = 25;
    var page = request.body.page;
    var lastindexkey = request.body.lastindexkey;

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
            if(page === 0 || page){
                return followutils.loadFollowingLegacy(connection, requesteduuid, limit, page);
            }
            else{
                return followutils.loadFollowing(connection, requesteduuid, limit, lastindexkey);
            }
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

module.exports = router;