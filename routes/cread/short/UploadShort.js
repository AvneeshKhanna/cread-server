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

var uuidgen = require('uuid');
var multer = require('multer');
var upload = multer({dest: './images/uploads/short/'});
var fs = require('fs');

var utils = require('../utils/Utils');
var entityutils = require('../entity/EntityUtils');
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
        imgtintcolor : request.body.imgtintcolor ? request.body.imgtintcolor : null,
        filtername: request.body.filtername,
        txt: request.body.text,
        textsize: request.body.textsize,
        bold: (request.body.bold === "1"),
        italic: (request.body.italic === "1"),
        bgcolor: (request.body.bgcolor) ? request.body.bgcolor : 'NA', //for backward compatibilty
        font: (request.body.font) ? request.body.font : 'NA',   //for backward compatibilty
        textcolor: request.body.textcolor,
        textgravity: request.body.textgravity,
        capid: (request.body.captureid) ? request.body.captureid : null,
        uuid: uuid,
        entityid: entityid,
        shoid: shoid
    };

    var entityparams = {
        entityid: entityid,
        merchantable: (Number(request.body.merchantable) === 1),
        caption: caption
    };

    try {
        var uniquehashtags;

        if (caption) {
            uniquehashtags = hashtagutils.extractUniqueHashtags(caption);
        }
    }
    catch (ex) {
        console.error(ex);
        throw ex;
    }

    var connection;
    var requesterdetails;
    var captureuseruuid;

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
            return uploadToRDS(connection, shortsqlparams, entityparams);
        })
        .then(function () {
            if (uniquehashtags && uniquehashtags.length > 0) {
                return hashtagutils.addHashtagsForEntity(connection, uniquehashtags, entityid);
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
        }, function (err) {
            if (err instanceof BreakPromiseChainError) {
                throw new BreakPromiseChainError();
            }
            else {
                return utils.rollbackTransaction(connection, undefined, err);
            }
        })
        .then(function () {
            if (shortsqlparams.capid) { //Send notification to user
                return retreiveCaptureUserDetails(connection, shortsqlparams.capid);
            }
            else {
                throw new BreakPromiseChainError();
            }
        })
        .then(function (capuseruuid) {
            captureuseruuid = capuseruuid;
            if(captureuseruuid !== uuid){
                return entityutils.updateEntityCollabDataForUpdates(connection, entityid, captureuseruuid, uuid);
            }
        })
        .then(function () {
            if (captureuseruuid !== uuid) {   //Send notification only when the two users involved are different
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

function uploadToRDS(connection, shortsqlparams, entityparams) {
    return new Promise(function (resolve, reject) {
        /*connection.beginTransaction(function (err) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else{


            }
        });*/

        entityparams.type = 'SHORT';

        connection.query('INSERT INTO Entity SET ?', [entityparams], function (err, edata) {
            if (err) {
                /*connection.rollback(function () {
                    reject(err);
                });*/
                reject(err);
            }
            else {
                connection.query('INSERT INTO Short SET ?', [shortsqlparams], function (err, rows) {
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
        });

    });
}

module.exports = router;