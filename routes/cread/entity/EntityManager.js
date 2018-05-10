/**
 * Created by avnee on 09-11-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var notify = require('../../notification-system/notificationFramework');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var consts = require('../utils/Constants');
var utils = require('../utils/Utils');
var entityutils = require('./EntityUtils');
var entityintrstutils = require('../interests/EntityInterestsUtils');
var captureutils = require('../capture/CaptureUtils');
var hashtagutils = require('../hashtag/HashTagUtils');
var profilementionutils = require('../profile-mention/ProfileMentionUtils');
var userprofileutils = require('../user-manager/UserProfileUtils');

var cache_time = consts.cache_time;

var rootpath = './images/downloads/';

/*var Canvas = require('canvas'),
    Image = Canvas.Image;*/

router.get('/load-captureid', function (request, response) {

    var entityid = decodeURIComponent(request.query.entityid);

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return loadCaptureid(connection, entityid);
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
            response.set('Cache-Control', 'public, max-age=1');
            if(request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')){
                response.status(304).send().end();
            }
            else {
                response.status(200).send({
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
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

function loadCaptureid(connection, entityid){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT capid, uuid, img_width, img_height ' +
            'FROM Capture ' +
            'WHERE entityid = ?', [entityid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                rows.map(function (element) {
                    element.entityurl = utils.createCaptureUrl(element.uuid, element.capid);
                });

                resolve(rows[0]);
            }
        });
    });
}

router.get('/load-specific', function (request, response) {
    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var entityid = decodeURIComponent(request.query.entityid);
    var platform = request.query.platform;

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
            return entityutils.loadEntityData(connection, uuid, entityid);
        })
        .then(function (result) {

            if(platform !== "android"){
                result.entity = utils.filterProfileMentions(new Array(result.entity), "caption")[0];
            }

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
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

router.post('/load-specific', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var platform = request.query.platform;

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
            return entityutils.loadEntityData(connection, uuid, entityid);
        })
        .then(function (result) {

            if(platform !== "android"){
                result.entity = utils.filterProfileMentions(new Array(result.entity), "caption")[0];
            }

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
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

router.post('/delete', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;

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
            return entityutils.deactivateEntity(connection, entityid, uuid);
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
            return userprofileutils.updateLatestPostsCache(connection, uuid);
        })
        .then(function (posts) {
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

router.post('/remove-from-explore', function (request, response) {

    var entityid = request.body.entityid;
    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return entityutils.removeEntityFromExplore(connection, entityid);
        })
        .then(function () {
            response.send({
                status: 'done'
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

router.post('/load-collab-details', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var entitytype = request.body.entitytype;
    var lastindexkey = request.body.lastindexkey;

    var limit = (config.envtype === 'PRODUCTION' ? 4 : 2);
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
            return entityutils.loadCollabDetails(connection, entityid, entitytype, limit, lastindexkey);
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
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

router.get('/load-collab-details', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var entityid = decodeURIComponent(request.query.entityid);
    var entitytype = request.query.entitytype;
    var lastindexkey = decodeURIComponent(request.query.lastindexkey);

    var limit = (config.envtype === 'PRODUCTION' ? 4 : 2);
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
            return entityutils.loadCollabDetails(connection, entityid, entitytype, limit, lastindexkey);
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
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

/**
 * Function to update a caption for a particular entity
 * */
router.post('/edit-caption', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var caption = request.body.caption.trim() ? request.body.caption.trim() : null;

    var uniquehashtags;
    var mentioneduuids = [];

    if(caption){
        uniquehashtags = hashtagutils.extractUniqueHashtags(caption);
        mentioneduuids = utils.extractProfileMentionUUIDs(caption);
    }

    var interests = request.body.interests ? JSON.parse(request.body.interests) : null;

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
            //Deleting existing hashtags for entity
            return hashtagutils.deleteHashtagsForEntity(connection, entityid);
        })
        .then(function () {
            //Adding new hashtags for entity
            if(uniquehashtags && uniquehashtags.length > 0){
                return hashtagutils.addHashtagsForEntity(connection, uniquehashtags, entityid);
            }
        })
        .then(function () {
            if(interests && interests.length > 0){
                return entityintrstutils.deleteAllEntityInterests(connection, entityid);
            }
        })
        .then(function () {
            if(interests && interests.length > 0){
                return entityintrstutils.saveEntityInterests(connection, entityid, interests);
            }
        })
        .then(function () {
            //Updating caption for entity
            return entityutils.updateEntityCaption(connection, entityid, caption);
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
            if(mentioneduuids.length > 0  ){
                return profilementionutils.addProfileMentionToUpdates(connection, entityid, "profile-mention-post", uuid, mentioneduuids);
            }
        })
        .then(function () {
            if(mentioneduuids.length > 0  ){
                var notifData = {
                    message: requesterdetails.firstname + " " + requesterdetails.lastname + " mentioned you in a post",
                    category: "profile-mention-post",
                    entityid: entityid,
                    persistable: "Yes",
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(mentioneduuids, notifData);
            }
        })
        .then(function () {
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

router.get('/load-data-long-form', function (request, response) {

    var entityid = decodeURIComponent(request.query.entityid);
    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
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
            return entityutils.loadEntityDataSeparate(connection, entityid);
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
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

module.exports = router;