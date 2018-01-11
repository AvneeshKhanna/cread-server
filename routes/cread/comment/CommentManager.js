/**
 * Created by avnee on 25-09-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var commentutils = require('./CommentUtils');
var utils = require('../utils/Utils');
var entityutils = require('../entity/EntityUtils');
var notify = require('../../notification-system/notificationFramework');

var consts = require('../utils/Constants');
var cache_time = consts.cache_time;

var uuidGenerator = require('uuid');

router.get('/load', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var entityid = decodeURIComponent(request.query.entityid);
    var lastindexkey = decodeURIComponent(request.query.lastindexkey);
    var loadAll = (decodeURIComponent(request.query.loadall) === "true"); //Whether to load all comments or top comments [true | false]

    var limit = (config.envtype === 'PRODUCTION') ? 20 : 12;
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
            return commentutils.loadComments(connection, entityid, limit, lastindexkey, loadAll);
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

router.post('/load', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var page = request.body.page;
    var lastindexkey = request.body.lastindexkey;
    var loadAll = request.body.loadall; //Whether to load all comments or top comments [true | false]

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var limit = (config.envtype === 'PRODUCTION') ? 20 : 12;
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
                return commentutils.loadCommentsLegacy(connection, entityid, limit, page, loadAll);
            }
            else{
                return commentutils.loadComments(connection, entityid, limit, lastindexkey, loadAll);
            }
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
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

router.post('/add', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var comment = request.body.comment;

    var othercommenters = request.body.othercommenters; //An array of uuids of other commenters on this thread

    var connection;
    var requesterdetails;
    var notifuuids;

    console.log("request is " + JSON.stringify(request.body, null, 3));

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
            return commentutils.addComment(connection, entityid, comment, uuid);
        })
        .then(function (commid) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done',
                    comment: {
                        commid: commid,
                        profilepicurl: utils.createSmallProfilePicUrl(uuid),
                        firstname: requesterdetails.firstname,
                        lastname: requesterdetails.lastname
                    }
                }
            });
            response.end();
        })
        .then(function () {
            return entityutils.getEntityUsrDetailsForNotif(connection, entityid);
        })
        .then(function (result) {   //Send a notification to the creator of this post
            notifuuids = result;
            if(notifuuids.creatoruuid !== uuid){    //Send notification only when the two users involved are different
                var notifData = {
                    message: requesterdetails.firstname + " " + requesterdetails.lastname + " has commented on your post",
                    category: "comment",
                    entityid: entityid,
                    persistable: "Yes",
                    other_collaborator : false,
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(new Array(notifuuids.creatoruuid), notifData);
            }
        })
        .then(function () { //Send a notification to the collaborator of this post
            if(notifuuids.collabuuid && notifuuids.collabuuid !== uuid){    //Send notification only when the two users involved are different
                var notifData = {
                    message: requesterdetails.firstname + " " + requesterdetails.lastname + " has commented on a post inspired by yours",
                    category: "comment",
                    entityid: entityid,
                    persistable: "Yes",
                    other_collaborator : true,
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(new Array(notifuuids.collabuuid), notifData);
            }
        })
        .then(function () {
            if(othercommenters && othercommenters.length > 0){ //Send a notification to other commenters on this thread
                var notifData = {
                    message: requesterdetails.firstname + " " + requesterdetails.lastname + " also commented on a post you commented on",
                    category: "other-comment",
                    entityid: entityid,
                    persistable: "Yes",
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(othercommenters, notifData);
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

function retrieveEntityUserDetails(connection, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT User.uuid ' +
            'FROM Entity ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'JOIN User ' +
            'ON (User.uuid = Short.uuid OR User.uuid = Capture.uuid)  ' +
            'WHERE Entity.entityid = ?', [entityid], function(err, rows){
            if(err){
                reject(err);
            }
            else{
                resolve(rows[0].uuid);
            }
        });
    })
}

router.post('/update', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var commid = request.body.commid;
    var comment = request.body.comment;

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
            return commentutils.updateComment(connection, commid, uuid, comment);
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

router.post('/delete', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var commid = request.body.commid;

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
            return commentutils.deleteComment(connection, commid, uuid);
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

module.exports = router;