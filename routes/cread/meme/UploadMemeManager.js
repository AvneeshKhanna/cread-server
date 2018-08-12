/**
 * Created by avnee on 06-08-2018.
 */
'use-strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const uuidgen = require('uuid');

const config = require('../../Config');
const uploadfilebasepath = './images/uploads/meme/';
const _auth = require('../../auth-token-management/AuthTokenManager');
const BreakPromiseChainError = require('../utils/BreakPromiseChainError');
const uploadmemeutils = require('./UploadMemeUtils');
const utils = require('../utils/Utils');
const hashtagutils = require('../hashtag/HashTagUtils');
const userprofileutils = require('../user-manager/UserProfileUtils');
const entityutils = require('../entity/EntityUtils');
const profilementionutils = require('../profile-mention/ProfileMentionUtils');
const notify = require('../../notification-system/notificationFramework');
const commentutils = require('../comment/CommentUtils');
const feedutils = require('../feed/FeedUtils');
const consts = require('../utils/Constants');
const post_type = consts.post_type;

const upload = multer({dest: uploadfilebasepath, limits: {fileSize: 20 * 1024 * 1024}});

router.post('/add', upload.single('meme-photo'), (request, response) => {

    let uuid = request.body.uuid;
    let authkey = request.body.authkey;

    let meme = request.file;

    let connection;
    let caption = request.body.caption.trim() ? request.body.caption.trim() : null;

    let entityparams = {
        entityid: uuidgen.v4(),
        caption: caption,
        uuid: uuid,
        type: post_type.MEME
    };

    let memeparams = {
        memeid: uuidgen.v4(),
        entityid: entityparams.entityid,
        uuid: uuid,
        img_height: request.body.img_height,
        img_width: request.body.img_width
    };

    let uniquehashtags;
    let mentioneduuids = [];

    if (caption) {
        uniquehashtags = hashtagutils.extractUniqueHashtags(caption);
        mentioneduuids = utils.extractProfileMentionUUIDs(caption);
    }

    let requesterdetails;
    let is_first_post;

    console.log("Request is " + JSON.stringify(request.body, null, 3));

    _auth.authValid(uuid, authkey)
        .then(details => {
            requesterdetails = details;
            return config.getNewConnection();
        }, () => {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(conn => {
            connection = conn;
            return utils.beginTransaction(connection)
        })
        .then(() => {
            return uploadmemeutils.addMemeToDb(connection, entityparams, memeparams);
        })
        .then(() => {
            if (uniquehashtags && uniquehashtags.length > 0) {
                return hashtagutils.addHashtagsForEntity(connection, uniquehashtags, entityparams.entityid);
            }
        })
        .then(() => {
            return userprofileutils.uploadImageToS3(uploadfilebasepath + meme.filename, uuid, 'Meme', memeparams.memeid + '-small.jpg');
        })
        .then(() => {
            return utils.commitTransaction(connection, undefined);
        }, (err) => {
            return utils.rollbackTransaction(connection, undefined, err);
        })
        .then(() => {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done',
                    entityid: entityparams.entityid,
                    entityurl: utils.createSmallMemeUrl(uuid, memeparams.memeid)
                }
            });
            response.end();
        })
        .then(() => {
            return entityutils.checkForFirstPost(connection, uuid);
        })
        .then(result => {
            is_first_post = result.firstpost;
            if (is_first_post) {
                commentutils.scheduleFirstPostCommentJob(uuid, result.name, entityparams.entityid);
            }
        })
        .then(() => {
            if (mentioneduuids.length > 0) {
                return profilementionutils.addProfileMentionToUpdates(connection, entityparams.entityid, "profile-mention-post", uuid, mentioneduuids);
            }
        })
        .then(() => {
            if (mentioneduuids.length > 0) {
                let notifData = {
                    message: requesterdetails.firstname + " " + requesterdetails.lastname + " mentioned you in a post",
                    category: "profile-mention-post",
                    entityid: entityparams.entityid,
                    persistable: "Yes",
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(mentioneduuids, notifData);
            }
        })
        .then(function () {
            if (!is_first_post) {
                return userprofileutils.checkIfPostedAfterGap(connection, uuid, entityparams.entityid);
            }
        })
        .then(function (hasPostedAfterGap) {
            if (hasPostedAfterGap) {
                //Send a notification to followers
                return entityutils.sendGapPostNotification(connection, requesterdetails.firstname, requesterdetails.lastname, uuid, entityparams.entityid);
            }
        })
        .then(() => {
            return feedutils.updateEntitiesInfoCacheViaDB(connection, [
                {
                    entityid: entityparams.entityid,
                    uuid: uuid
                }
            ]);
        })
        .then(() => {
            throw new BreakPromiseChainError();
        })
        .catch(err => {
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

router.post('/edit', (request, response) => {

    let uuid = request.body.uuid;
    let authkey = request.body.authkey;

    let connection;
    let entityid = request.body.entityid;

    let uniquehashtags;
    let mentioneduuids = [];

    let caption = request.body.caption.trim() ? request.body.caption.trim() : null;

    if (caption) {
        uniquehashtags = hashtagutils.extractUniqueHashtags(caption);
        mentioneduuids = utils.extractProfileMentionUUIDs(caption);
    }

    let requesterdetails;

    _auth.authValid(uuid, authkey)
        .then(details => {
            requesterdetails = details;
            return config.getNewConnection();
        }, () => {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(conn => {
            connection = conn;
            return utils.beginTransaction(connection)
        })
        .then(() => {
            return entityutils.updateEntityCaption(connection, entityid, caption);
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
        .then(() => {
            return utils.commitTransaction(connection, undefined);
        }, (err) => {
            return utils.rollbackTransaction(connection, undefined, err);
        })
        .then(() => {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();
        })
        .then(() => {
            if (mentioneduuids.length > 0) {
                return profilementionutils.addProfileMentionToUpdates(connection, entityid, "profile-mention-post", uuid, mentioneduuids);
            }
        })
        .then(() => {
            if (mentioneduuids.length > 0) {
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
        .then(() => {
            return feedutils.updateEntitiesInfoCacheViaDB(connection, [
                {
                    entityid: entityid,
                    uuid: uuid
                }
            ]);
        })
        .then(() => {
            throw new BreakPromiseChainError();
        })
        .catch(err => {
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
