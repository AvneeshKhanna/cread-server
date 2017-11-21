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
var multer  = require('multer');
var upload = multer({ dest: './images/uploads/capture/' });
var fs = require('fs');

var utils = require('../utils/Utils');
var captureutils = require('./CaptureUtils');

var filebasepath = './images/uploads/capture/';

//TODO: Add code to upload short as well
router.post('/', upload.single('captured-image'), function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));
    //console.log("request is " + JSON.stringify(request.file, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var shoid = request.body.shoid;
    var watermark = request.body.watermark;
    var capture = request.file;
    var merchantable = Number(request.body.merchantable);

    var captureid = uuidgen.v4();

    var connection;
    var toresize;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        },function () {
            response.send({
                tokenstatus:'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return updateCaptureDB(connection, captureid, uuid, watermark, merchantable);
        })
        .then(function () {
            return userprofileutils.renameFile(filebasepath, capture, captureid);
        })
        .then(function(){
            return captureutils.addWatermarkToCapture(filebasepath + captureid + '.jpg', watermark, captureid);
        })
        .then(function (resize) {
            toresize = resize;
            if(toresize){
                return userprofileutils.createSmallImage(filebasepath + captureid + '.jpg', filebasepath, captureid, 750, 750);
            }
        })
        .then(function () {
            return userprofileutils.uploadImageToS3(filebasepath + captureid + '.jpg', uuid, 'Capture', captureid + '.jpg');
        })
        .then(function () {
            var filename;
            if(toresize){
                filename = captureid + '-small' + '.jpg';
            }
            else{
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

function updateCaptureDB(connection, captureid, uuid, watermark, merchantable, shoid){
    return new Promise(function (resolve, reject) {

        connection.beginTransaction(function (err) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else{

                var entityparams = {
                    entityid: uuidgen.v4(),
                    type: 'CAPTURE',
                    merchantable: (merchantable === 1)
                };

                console.log("entityparams" + JSON.stringify(entityparams, null, 3));

                connection.query('INSERT INTO Entity SET ?', [entityparams], function (err, data) {
                    if(err){
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else {

                        var captureparams = {
                            capid: captureid,
                            entityid: entityparams.entityid,
                            uuid: uuid
                        };

                        if(shoid){
                            captureparams.shoid = shoid;
                        }

                        connection.query('INSERT INTO Capture SET ?', [captureparams], function (err, rows) {
                            if (err) {
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else {

                                if(watermark){
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
                                else{
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

module.exports = router;