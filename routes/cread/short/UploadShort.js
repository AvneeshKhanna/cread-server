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

var filebasepath = './images/uploads/short/';

//TODO: Delete image after server response
router.post('/upload', upload.single('short'), function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var short_txt_coordinates = request.body.short_txt_coordinates;
    var short = request.file;


    var shoid = uuidgen.v4();

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
            return uploadToRDS(connection, short_txt_coordinates, shoid);
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

function uploadToRDS(connection, short_txt_coordinates, shoid) {
    return new Promise(function (resolve, reject) {
        connection.beginTransaction(function (err) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else{
                connection.query('UPDATE Short SET ? ' +
                    'WHERE shoid = ?', [short_txt_coordinates, shoid], function (err, rows) {
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
        });
    });
}

module.exports = router;