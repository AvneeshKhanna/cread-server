/**
 * Created by avnee on 31-10-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var userprofileutils = require('../user-manager/UserProfileUtils');
var profilementionutils = require('../profile-mention/ProfileMentionUtils');

var uuidgen = require('uuid');
var multer = require('multer');
var upload = multer({dest: './images/uploads/short/', limits: {fileSize: 20 * 1024 * 1024}});
var fs = require('fs');

var utils = require('../utils/Utils');
var entityutils = require('../entity/EntityUtils');
var entityimgutils = require('../entity/EntityImageUtils');
var entityintrstutils = require('../interests/EntityInterestsUtils');
var commentutils = require('../comment/CommentUtils');
var shortutils = require('./ShortUtils');
var hashtagutils = require('../hashtag/HashTagUtils');
var notify = require('../../notification-system/notificationFramework');

var filebasepath = './images/uploads/short/';

//TODO: Delete image after server response
router.post('/', upload.single('short-image'), function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var short = request.file;
    var caption = request.body.caption.trim() ? request.body.caption.trim() : null;

    var shoid = uuidgen.v4();
    var entityid = uuidgen.v4();

    var shortsqlparams = {
        dx: request.body.dx,
        dy: request.body.dy,
        txt_width: request.body.txt_width,
        txt_height: request.body.txt_height,
        img_width: request.body.img_width,
        img_height: request.body.img_height,
        imgtintcolor: request.body.imgtintcolor ? request.body.imgtintcolor : null,
        filtername: request.body.filtername ? request.body.filtername : 'original',
        txt: request.body.text,
        text_long: request.body.text_long ? request.body.text_long : null,
        textsize: request.body.textsize,
        bold: (request.body.bold === "1"),
        italic: (request.body.italic === "1"),
        bgcolor: (request.body.bgcolor) ? request.body.bgcolor : 'NA', //for backward compatibilty
        font: (request.body.font) ? request.body.font : 'NA',   //for backward compatibilty
        textcolor: request.body.textcolor,
        bg_sound: request.body.bg_sound ? request.body.bg_sound : 'none',
        textgravity: request.body.textgravity,
        textshadow: request.body.textshadow ? Number(request.body.textshadow) : 0,
        shape: request.body.shape ? request.body.shape : 'shape_none',
        capid: (request.body.captureid) ? request.body.captureid : null,
        uuid: uuid,
        entityid: entityid,
        shoid: shoid
    };

    var entityparams = {
        entityid: entityid,
        merchantable: (Number(request.body.merchantable) === 1),
        product_overlay: (Number(request.body.merchantable) === 1),
        caption: caption
    };

    try {
        var uniquehashtags;
        var mentioneduuids = [];

        if (caption) {
            uniquehashtags = hashtagutils.extractUniqueHashtags(caption);
            mentioneduuids = utils
                .extractProfileMentionUUIDs(caption);
        }

        var interests = request.body.interests ? JSON.parse(request.body.interests) : null;
    }
    catch (ex) {
        console.error(ex);
        throw ex;
    }

    var connection;
    var requesterdetails;
    var captureuseruuid;
    var filepath_to_upload;

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
            return shortutils.addShortToDb(connection, shortsqlparams, entityparams);
        })
        .then(function () {
            if (shortsqlparams.capid) {   //Case of collaboration
                return entityutils.updateLastEventTimestampViaType(connection, shortsqlparams.capid, uuid);
            }
        })
        .then(function () {
            if (uniquehashtags && uniquehashtags.length > 0) {
                return hashtagutils.addHashtagsForEntity(connection, uniquehashtags, entityid);
            }
        })
        .then(function () {
            if(interests && interests.length > 0){
                return entityintrstutils.saveEntityInterests(connection, entityid, interests);
            }
        })
        .then(function () {
            return userprofileutils.renameFile(filebasepath, short, shoid);
        })
        .then(function (renamedpath) {
            filepath_to_upload = renamedpath;
            return userprofileutils.uploadImageToS3(filepath_to_upload, uuid, 'Short', shoid + '-small.jpg');
        })
        .then(function () {
            return utils.commitTransaction(connection);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done',
                    entityid: entityid,
                    shorturl: utils.createSmallShortUrl(uuid, shoid)
                }
            });
            response.end();
        }, function (err) {
            if (err instanceof BreakPromiseChainError) {
                throw new BreakPromiseChainError();
            }
            else {
                return utils.rollbackTransaction(connection, undefined, err);
            }
        })
        .then(function () {
            return entityutils.checkForFirstPost(connection, uuid);
        })
        .then(function (result) {
            if(result.firstpost){
                commentutils.scheduleFirstPostCommentJob(uuid, result.name, entityid);
            }
        })
        .then(function () {
            if (mentioneduuids.length > 0) {
                return profilementionutils.addProfileMentionToUpdates(connection, entityid, "profile-mention-post", uuid, mentioneduuids);
            }
        })
        .then(function () {
            if (mentioneduuids.length > 0) {
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
            if (shortsqlparams.capid) { //Send notification to user
                return retreiveCaptureUserDetails(connection, shortsqlparams.capid);
            }
        })
        .then(function (capuseruuid) {
            captureuseruuid = capuseruuid;
            if (captureuseruuid && captureuseruuid !== uuid) {
                return entityutils.updateEntityCollabDataForUpdates(connection, entityid, captureuseruuid, uuid);
            }
        })
        .then(function () {
            if (captureuseruuid && captureuseruuid !== uuid) {   //Send notification only when the two users involved are different
                var notifData = {
                    message: requesterdetails.firstname + ' ' + requesterdetails.lastname + " wrote on your graphic art",
                    category: "collaborate",
                    persistable: "Yes",
                    entityid: entityid,
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(new Array(captureuseruuid), notifData);
            }
        })
        .then(function () {
            return userprofileutils.addToLatestPostsCache(connection, uuid, utils.createSmallShortUrl(uuid, shoid));
        })
        .then(function () {
            if(entityparams.merchantable){
                return entityimgutils.createOverlayedImageCoffeeMug(shoid, uuid, "Short", filepath_to_upload);
            }
        })
        .then(function () {
            if(entityparams.merchantable){
                return entityimgutils.createOverlayedImageJournal(shoid, "Short", uuid, filepath_to_upload);
            }
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

router.post('/edit', upload.single('short-image'), function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var short = request.file;
    var caption = request.body.caption.trim() ? request.body.caption.trim() : null;
    var shoid = request.body.shoid;
    var entityid = request.body.entityid;

    var shortsqlparams = {
        dx: request.body.dx,
        dy: request.body.dy,
        txt_width: request.body.txt_width,
        txt_height: request.body.txt_height,
        img_width: request.body.img_width,
        img_height: request.body.img_height,
        imgtintcolor: request.body.imgtintcolor ? request.body.imgtintcolor : null,
        filtername: request.body.filtername ? request.body.filtername : 'original',
        bg_sound: request.body.bg_sound ? request.body.bg_sound : 'none',
        txt: request.body.text,
        text_long: request.body.text_long ? request.body.text_long : null,
        textsize: request.body.textsize,
        bold: (request.body.bold === "1"),
        italic: (request.body.italic === "1"),
        bgcolor: (request.body.bgcolor) ? request.body.bgcolor : 'NA', //for backward compatibilty
        font: (request.body.font) ? request.body.font : 'NA',   //for backward compatibilty
        textcolor: request.body.textcolor,
        textgravity: request.body.textgravity,
        textshadow: request.body.textshadow ? Number(request.body.textshadow) : 0,
        shape: request.body.shape ? request.body.shape : 'shape_none',
        capid: (request.body.captureid) ? request.body.captureid : null
    };

    var entityparams = {
        caption: caption
    };

    try {
        var uniquehashtags;
        var mentioneduuids = [];

        if (caption) {
            uniquehashtags = hashtagutils.extractUniqueHashtags(caption);
            mentioneduuids = utils.extractProfileMentionUUIDs(caption);
        }

        var interests = request.body.interests ? JSON.parse(request.body.interests) : null;
    }
    catch (ex) {
        console.error(ex);
        throw ex;
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
            return utils.beginTransaction(connection);
        })
        .then(function () {
            return shortutils.updateShortInDb(connection, shoid, shortsqlparams, entityid, entityparams);
        })
        .then(function () {
            //Deleting existing hashtags for entity
            return hashtagutils.deleteHashtagsForEntity(connection, entityid);
        })
        .then(function () {
            //Deleting new hashtags for entity
            if (uniquehashtags && uniquehashtags.length > 0) {
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
            return userprofileutils.renameFile(filebasepath, short, shoid);
        })
        .then(function (renamedpath) {
            return userprofileutils.uploadImageToS3(renamedpath, uuid, 'Short', shoid + '-small.jpg');
        })
        .then(function () {
            return utils.commitTransaction(connection);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done',
                    shorturl: utils.createSmallShortUrl(uuid, shoid)
                }
            });
            response.end();
        })
        .then(function () {
            if (mentioneduuids.length > 0) {
                return profilementionutils.addProfileMentionToUpdates(connection, entityid, "profile-mention-post", uuid, mentioneduuids);
            }
        })
        .then(function () {
            if (mentioneduuids.length > 0) {
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
            if (err instanceof BreakPromiseChainError) {
                config.disconnect(connection);
            }
            else {
                console.error(err);
                utils.rollbackTransaction(connection)
                    .catch(function (err) {
                        config.disconnect(connection);
                        response.status(500).send({
                            message: 'Some error occurred at the server'
                        }).end();
                    });
            }
        });

});

function retreiveCaptureUserDetails(connection, captureid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT uuid FROM Capture WHERE capid = ?', [captureid], function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve(data[0].uuid);
            }
        })
    })
}

module.exports = router;