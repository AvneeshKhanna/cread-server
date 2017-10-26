/**
 * Created by avnee on 11-10-2017.
 */

/**
 * Used to handle the server endpoints for follow system
 * */

'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var followutils = require('./FollowUtils');
var userprofileutils = require('../user-manager/UserProfileUtils');

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

    _auth.authValid(uuid, authkey)
        .then(function () {
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
        .then(function (friendsuuids) {
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

router.post('/load-followers', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var requesteduuid = request.body.requesteduuid;
    var limit = 25;
    var page = request.body.page;

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
            return followutils.loadFollowers(connection, requesteduuid, limit, page);
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

router.post('/load-following', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var requesteduuid = request.body.requesteduuid;
    var limit = 25;
    var page = request.body.page;

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
            return followutils.loadFollowing(connection, requesteduuid, limit, page);
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