/**
 * Created by avnee on 20-07-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var utils = require('../utils/Utils');
var repostutils = require('./RepostUtils');
var entityutils = require('../entity/EntityUtils');
var notify = require('../../notification-system/notificationFramework');

var consts = require('../utils/Constants');
var cache_time = consts.cache_time;

router.post('/add', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;

    var entityid = request.body.entityid;

    var connection;
    var notifuuids;
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
            return repostutils.addRepost(connection, entityid, uuid);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();
            // throw new BreakPromiseChainError();
        })
        .then(function () {
            return entityutils.getEntityUsrDetailsForNotif(connection, entityid);
        })
        .then(function (result) {   //Add to Updates table for a notification to creator
            notifuuids = result;
            if (notifuuids.creatoruuid !== uuid) {
                return repostutils.updateRepostDataForUpdates(connection, notifuuids.creatoruuid, uuid, entityid, "repost", false);
            }
        })
        .then(function () {   //Send a notification to the creator of this post
            if (notifuuids.creatoruuid !== uuid) {    //Send notification only when the two users involved are different
                var notifData = {
                    message: requesterdetails.firstname + " " + requesterdetails.lastname + " has reposted your post",
                    category: "repost",
                    entityid: entityid,
                    persistable: "Yes",
                    other_collaborator: false,
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(new Array(notifuuids.creatoruuid), notifData);
            }
        })
        .then(function () { //Add to Updates table for a notification to collaborator
            if (notifuuids.collabuuid && notifuuids.collabuuid !== uuid && notifuuids.collabuuid !== notifuuids.creatoruuid) {
                return repostutils.updateRepostDataForUpdates(connection, notifuuids.collabuuid, uuid, entityid, "repost", true);
            }
        })
        .then(function () { //Send a notification to the collaborator of this post
            if (notifuuids.collabuuid && notifuuids.collabuuid !== uuid && notifuuids.collabuuid !== notifuuids.creatoruuid) {    //Send notification only when the two users involved are different
                var notifData = {
                    message: requesterdetails.firstname + " " + requesterdetails.lastname + " has reposted a post inspired by yours",
                    category: "repost",
                    entityid: entityid,
                    persistable: "Yes",
                    other_collaborator: true,
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(new Array(notifuuids.collabuuid), notifData);
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

router.post('/delete', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var repostid = request.body.repostid;

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
            return repostutils.deleteRepost(connection, repostid, uuid);
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

module.exports = router;