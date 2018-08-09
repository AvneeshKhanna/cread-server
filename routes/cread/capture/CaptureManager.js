/**
 * Created by avnee on 01-11-2017.
 */
'use-strict';

const express = require('express');
const router = express.Router();

const config = require('../../Config');

const _auth = require('../../auth-token-management/AuthTokenManager');
const BreakPromiseChainError = require('../utils/BreakPromiseChainError');
const userprofileutils = require('../user-manager/UserProfileUtils');
const hashtagutils = require('../hashtag/HashTagUtils');
const utils = require('../utils/Utils');
const entityintrstutils = require('../interests/EntityInterestsUtils');
const entityutils = require('../entity/EntityUtils');
const profilementionutils = require('../profile-mention/ProfileMentionUtils');
const notify = require('../../notification-system/notificationFramework');
const feedutils = require('../feed/FeedUtils');
const captureutils = require('./CaptureUtils');

router.post('/delete', function (request, response) {
    let uuid = request.body.uuid;
    let authkey = request.body.authkey;
    let entityid = request.body.entityid;

    let connection;

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

router.post('/edit-caption', function (request, response) {

    let uuid = request.body.uuid;
    let authkey = request.body.authkey;
    let entityid = request.body.entityid;
    let caption = request.body.caption ? request.body.caption.trim() : null;
    let livefilter = request.body.livefilter ? request.body.livefilter : 'none';

    let uniquehashtags;
    let mentioneduuids = [];

    if(caption){
        uniquehashtags = hashtagutils.extractUniqueHashtags(caption);
        mentioneduuids = utils.extractProfileMentionUUIDs(caption);
    }

    let interests = request.body.interests ? JSON.parse(request.body.interests) : null;

    let captureparams = {
        livefilter: livefilter
    };

    let connection;
    let requesterdetails;

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
            return utils.beginTransaction(connection);
        })
        .then(function () {
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
            return captureutils.updateCaptureDetails(connection, entityid, captureparams);
        })
        .then(function () {
            return utils.commitTransaction(connection);
        }, function (err) {
            return utils.rollbackTransaction(connection, undefined, err);
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
                let notifData = {
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
            return feedutils.updateEntitiesInfoCacheViaDB(connection, [
                {
                    entityid: entityid,
                    uuid: uuid
                }
            ]);
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

module.exports = router;