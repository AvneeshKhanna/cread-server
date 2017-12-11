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

var uuidgen = require('uuid');
var multer = require('multer');
var upload = multer({dest: './images/uploads/capture/'});
var fs = require('fs');

var utils = require('../utils/Utils');
var profilepicutils = require('../user-manager/UserProfileUtils');
var captureutils = require('./CaptureUtils');
var notify = require('../../notification-system/notificationFramework');
var shortutils = require('../short/ShortUtils');

var filebasepath = './images/uploads/capture/'; 

router.post('/', upload.single('captured-image'), function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));
    console.log("request is " + JSON.stringify(request.file, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var watermark = request.body.watermark;
    var capture = request.file;
    var merchantable = Number(request.body.merchantable);

    var captureid = uuidgen.v4();
    var entityid = uuidgen.v4();

    var connection;
    var toresize;

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
            return updateCaptureDB(connection, captureid, uuid, watermark, merchantable, entityid, undefined, {});
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

    var dx = request.body.dx;
    var dy = request.body.dy;
    var txt_width = request.body.txt_width;
    var txt_height = request.body.txt_height;
    var img_width = request.body.img_width;
    var img_height = request.body.img_height;
    var text = request.body.text;
    var textcolor = request.body.textcolor;
    var textsize = request.body.textsize;
    var textgravity = request.body.textgravity;
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
    var filename_high =

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
                text: text,
                textcolor: textcolor,
                bold: bold,
                italic: italic,
                bgcolor: bgcolor,
                font: font,
                textsize: textsize,
                textgravity: textgravity
            };
            return updateCaptureDB(connection, captureid, uuid, watermark, merchantable, entityid, shoid, captureparamas)
        })
        .then(function () {
            return profilepicutils.uploadImageToS3(filebasepath + capture_img_high.filename, uuid, 'Capture', captureid + '.jpg');
        })
        .then(function () {
            return profilepicutils.uploadImageToS3(filebasepath + capture_img_low.filename, uuid, 'Capture', captureid + '-small.jpg');
        })
        .then(function () {
            return utils.commitTransaction(connection);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            }).end();
        })
        .then(function () { //Send notification to user
            var select = [
                'uuid'
            ];
            return shortutils.retrieveShortDetails(connection, shoid, select);
        })
        .then(function (shortdetails) {
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

function updateCaptureDB(connection, captureid, uuid, watermark, merchantable, entityid, shoid, captureparams) {
    return new Promise(function (resolve, reject) {
        connection.beginTransaction(function (err) {
            if (err) {
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {

                var entityparams = {
                    entityid: entityid,
                    type: 'CAPTURE',
                    merchantable: (merchantable === 1)
                };

                console.log("entityparams" + JSON.stringify(entityparams, null, 3));

                connection.query('INSERT INTO Entity SET ?', [entityparams], function (err, data) {
                    if (err) {
                        connection.rollback(function () {
                            reject(err);
                        });
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
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else {

                                if (watermark) {
                                    connection.query('UPDATE User SET watermark = ? WHERE uuid = ?', [watermark, uuid], function (err, rows) {
                                        if (err) {
                                            connection.rollback(function () {
                                                reject(err);
                                            });
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