/**
 * Created by avnee on 24-10-2017.
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
var upload = multer({dest: './images/uploads/capture/', limits: { fileSize: 20*1024*1024 }});
var fs = require('fs');

var utils = require('../utils/Utils');
var profilepicutils = require('../user-manager/UserProfileUtils');
var captureutils = require('./CaptureUtils');
var notify = require('../../notification-system/notificationFramework');
var shortutils = require('../short/ShortUtils');
var hashtagutils = require('../hashtag/HashTagUtils');
var entityutils = require('../entity/EntityUtils');

var filebasepath = './images/uploads/capture/'; 

router.post('/', upload.single('captured-image'), function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));
    console.log("request is " + JSON.stringify(request.file, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var watermark = request.body.watermark;
    var capture = request.file;
    var merchantable = Number(request.body.merchantable);
    var caption = request.body.caption.trim() ? request.body.caption.trim() : null;

    var uniquehashtags;
    var mentioneduuids = [];

    if(caption){
        uniquehashtags = hashtagutils.extractUniqueHashtags(caption);
        mentioneduuids = utils.extractProfileMentionUUIDs(caption);
    }

    var captureparams = {
        filtername: request.body.filtername ? request.body.filtername : 'original'
    };

    var captureid = uuidgen.v4();
    var entityid = uuidgen.v4();

    var connection;
    var requesterdetails;
    var toresize;

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
            return updateCaptureDB(connection, captureid, uuid, watermark, merchantable, caption, entityid, undefined, captureparams);
        })
        .then(function () {
            if(uniquehashtags && uniquehashtags.length > 0){
                return hashtagutils.addHashtagsForEntity(connection, uniquehashtags, entityid);
            }
        })
        .then(function () {
            return userprofileutils.renameFile(filebasepath, capture, captureid);
        })
        .then(function () {
            return captureutils.addWatermarkToCapture(filebasepath + captureid + '.jpg', watermark, captureid);
        })
        .then(function (resize) {
            toresize = resize;
            if (toresize) {
                return userprofileutils.createSmallImage(filebasepath + captureid + '.jpg', filebasepath, captureid, 750, 750);
            }
        })
        .then(function () {
            return userprofileutils.uploadImageToS3(filebasepath + captureid + '.jpg', uuid, 'Capture', captureid + '.jpg');
        })
        .then(function () {
            var filename;
            if (toresize) {
                filename = captureid + '-small' + '.jpg';
            }
            else {
                filename = captureid + '.jpg';
            }
            return userprofileutils.uploadImageToS3(filebasepath + filename, uuid, 'Capture', captureid + '-small' + '.jpg');
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
                    captureurl: utils.createSmallCaptureUrl(uuid, captureid)
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
        }, function (err) {
            if(!(err instanceof BreakPromiseChainError)) {
                return utils.rollbackTransaction(connection, undefined, err);
            }
        })
        .then(function () {
            return userprofileutils.addToLatestPostsCache(connection, uuid, utils.createSmallCaptureUrl(uuid, captureid));
        })
        .then(function () {
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
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

router.post('/collaborated', upload.fields([{name: 'capture-img-high', maxCount: 1}, { name: 'capture-img-low', maxCount: 1}]), function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));
    console.log("request files is " + JSON.stringify(request.files, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var watermark = request.body.watermark;
    var capture_img_high = request.files['capture-img-high'][0];
    var capture_img_low = request.files['capture-img-low'][0];
    var merchantable = Number(request.body.merchantable);
    var caption = request.body.caption.trim() ? request.body.caption.trim() : null;

    var uniquehashtags;
    var mentioneduuids = [];

    if(caption){
        uniquehashtags = hashtagutils.extractUniqueHashtags(caption);
        mentioneduuids = utils.extractProfileMentionUUIDs(caption);
    }

    var dx = request.body.dx;
    var dy = request.body.dy;
    var txt_width = request.body.txt_width;
    var txt_height = request.body.txt_height;
    var img_width = request.body.img_width;
    var img_height = request.body.img_height;
    var imgtintcolor = request.body.imgtintcolor ? request.body.imgtintcolor : null;
    var filtername = request.body.filtername;
    var text = request.body.text;
    var text_long = request.body.text_long ? request.body.text_long : null;
    var bg_sound = request.body.bg_sound ? request.body.bg_sound : undefined;
    var textcolor = request.body.textcolor;
    var textsize = request.body.textsize;
    var textgravity = request.body.textgravity;
    var textshadow = request.body.textshadow;
    var shape = request.query.shape;
    var shoid = request.body.shoid;

    var bold = (request.body.bold === "1"),
        italic = (request.body.italic === "1"),
        bgcolor = request.body.bgcolor,
        font = request.body.font;

    var captureid = uuidgen.v4();
    var entityid = uuidgen.v4();

    var connection;
    var requesterdetails;
    var toresize;

    var filebasepath = './images/uploads/capture/';
    var shortdetails;

    _auth.authValid(uuid, authkey)
        .then(function (details){
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
        /*.then(function () {
            return userprofileutils.renameFile(filebasepath, capture, captureid);
        })
        .then(function () {
            return userprofileutils.renameFile(filebasepath, capture, captureid);
        })*/
        .then(function () {
            var captureparamas = {
                dx: dx,
                dy: dy,
                txt_width: txt_width,
                txt_height: txt_height,
                img_width: img_width,
                img_height: img_height,
                imgtintcolor: imgtintcolor,
                filtername: filtername,
                bg_sound: bg_sound,
                text: text,
                text_long: text_long,
                textcolor: textcolor,
                bold: bold,
                italic: italic,
                bgcolor: bgcolor,
                font: font,
                textsize: textsize,
                textgravity: textgravity,
                textshadow: textshadow ? Number(textshadow) : 0,
                shape: shape ? shape : 'shape_none'
            };
            return updateCaptureDB(connection, captureid, uuid, watermark, merchantable, caption, entityid, shoid, captureparamas)
        })
        .then(function () {
            return entityutils.updateLastEventTimestampViaType(connection, shoid, uuid);
        })
        .then(function () {
            if(uniquehashtags && uniquehashtags.length > 0){
                return hashtagutils.addHashtagsForEntity(connection, uniquehashtags, entityid);
            }
        })
        .then(function () {
            return profilepicutils.uploadImageToS3(filebasepath + capture_img_high.filename, uuid, 'Capture', captureid + '.jpg');
        })
        .then(function () {
            return profilepicutils.uploadImageToS3(filebasepath + capture_img_low.filename, uuid, 'Capture', captureid + '-small.jpg');
        })
        .then(function () {
            return utils.commitTransaction(connection);
        }, function (err) {
            if(err instanceof BreakPromiseChainError){
                throw new BreakPromiseChainError();
            }
            else {
                return utils.rollbackTransaction(connection, undefined, err);
            }
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done',
                    entityid: entityid,
                    captureurl: utils.createSmallCaptureUrl(uuid, captureid)
                }
            }).end();
        })
        .then(function () { //Send notification to user
            var select = [
                'uuid'
            ];
            return shortutils.retrieveShortDetails(connection, shoid, select);
        })
        .then(function (shdetails) {
            shortdetails = shdetails;
            if(shortdetails.uuid !== uuid){
                return entityutils.updateEntityCollabDataForUpdates(connection, entityid, shortdetails.uuid, uuid);
            }
        })
        .then(function () {
            if(shortdetails.uuid !== uuid){
                var notifData = {
                    message: requesterdetails.firstname + ' ' + requesterdetails.lastname + " uploaded a graphic art to your writing",
                    category: "collaborate",
                    persistable: "Yes",
                    entityid: entityid,
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(new Array(shortdetails.uuid), notifData)
            }
        })
        .then(function () {
            //TODO: Add support for multiple uuids
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
            return userprofileutils.addToLatestPostsCache(connection, uuid, utils.createSmallCaptureUrl(uuid, captureid));
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

function updateCaptureDB(connection, captureid, uuid, watermark, merchantable, caption, entityid, shoid, captureparams) {
    return new Promise(function (resolve, reject) {
        connection.beginTransaction(function (err) {
            if (err) {
                /*connection.rollback(function () {
                    reject(err);
                });*/
                reject(err);
            }
            else {

                var entityparams = {
                    entityid: entityid,
                    type: 'CAPTURE',
                    merchantable: (merchantable === 1),
                    caption: caption
                };

                console.log("entityparams" + JSON.stringify(entityparams, null, 3));

                connection.query('INSERT INTO Entity SET ?', [entityparams], function (err, data) {
                    if (err) {
                        /*connection.rollback(function () {
                            reject(err);
                        });*/
                        reject(err);
                    }
                    else {

                        captureparams.capid = captureid;
                        captureparams.entityid = entityparams.entityid;
                        captureparams.uuid = uuid;

                        if (shoid) {
                            captureparams.shoid = shoid;
                        }

                        connection.query('INSERT INTO Capture SET ?', [captureparams], function (err, rows) {
                            if (err) {
                                /*connection.rollback(function () {
                                    reject(err);
                                });*/
                                reject(err);
                            }
                            else {

                                if (watermark) {
                                    connection.query('UPDATE User SET watermark = ? WHERE uuid = ?', [watermark, uuid], function (err, rows) {
                                        if (err) {
                                            /*connection.rollback(function () {
                                                reject(err);
                                            });*/
                                            reject(err);
                                        }
                                        else {
                                            resolve();
                                        }
                                    });
                                }
                                else {
                                    resolve();
                                }
                            }
                        });

                    }
                });
            }
        });
    });
}

function updateShortDB(connection, shoid, captureid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Short SET capid = ? WHERE shoid = ?', [captureid, shoid], function (err, rows) {
            if (err) {
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {
                resolve();
            }
        });
    });
}

module.exports = router;