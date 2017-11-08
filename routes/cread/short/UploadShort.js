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
var multer  = require('multer');
var upload = multer({ dest: './images/uploads/short/' });
var fs = require('fs');

var utils = require('../utils/Utils');
var notify = require('../../notification-system/notificationFramework');

var filebasepath = './images/uploads/short/';

//TODO: Delete image after server response
router.post('/', upload.single('short-image'), function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var short = request.file;

    var shoid = uuidgen.v4();
    var entityid = uuidgen.v4();

    var shortsqlparams = {
        dx: request.body.dx,
        dy: request.body.dy,
        width: request.body.width,
        height: request.body.height,
        txt: request.body.text,
        textsize: request.body.textsize,
        textcolor: request.body.textcolor,
        textgravity: request.body.textgravity,
        capid: (request.body.captureid) ? request.body.captureid : null,
        uuid: uuid,
        entityid: entityid,
        shoid: shoid
    };

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
            return uploadToRDS(connection, shortsqlparams, entityid);
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
            if(shortsqlparams.capid){
                return retreiveCaptureUserDetails(connection, shortsqlparams.capid);
            }
            else {
                throw new BreakPromiseChainError();
            }
        })
        .then(function (captureuseruuid) {
            var notifData = {
                message: requesterdetails.firstname + ' ' + requesterdetails.lastname + " wrote a short on your capture",
                category: "collaborate",
                persistable: "Yes",
                entityid: entityid,
                actorimage: utils.createSmallProfilePicUrl(uuid)
            };
            return notify.notificationPromise(new Array(captureuseruuid), notifData);
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

function retreiveCaptureUserDetails(connection, captureid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT uuid FROM Capture WHERE capid = ?', [captureid], function (err, data) {
            if(err){
                reject(err);
            }
            else{
                resolve(data[0].uuid);
            }
        })
    })
}

function uploadToRDS(connection, shortsqlparams, entityid) {
    return new Promise(function (resolve, reject) {
        connection.beginTransaction(function (err) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else{

                var entityparams = {
                    entityid: entityid,
                    type: 'SHORT'
                };

                connection.query('INSERT INTO Entity SET ?', [entityparams], function (err, edata) {
                    if (err) {
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else {
                        connection.query('INSERT INTO Short SET ?', [shortsqlparams], function (err, rows) {
                            if(err){
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else{
                                resolve();
                            }
                        });
                    }
                });
            }
        });
    });
}

module.exports = router;