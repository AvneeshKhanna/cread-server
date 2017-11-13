/**
 * Created by avnee on 03-11-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var userprofileutils = require('../user-manager/UserProfileUtils');

var uuidgen = require('uuid');
var fs = require('fs');

var utils = require('../utils/Utils');

var entityutils = require('../entity/EntityUtils');
var captureutils = require('../capture/CaptureUtils');

var rootdownloadpath = './images/downloads/';

/*var Canvas = require('canvas'),
    Image = Canvas.Image;*/

router.post('/generate-short-for-print', function (request, response) {

    var entityid = request.body.entityid;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return entityutils.retrieveShortDetails(connection, entityid);
        })
        .then(function (short) {
            return captureutils.downloadCapture(uuid, short.capid, rootdownloadpath + short.capid + '.jpg');
        })
        .then(function (dwnldcapturepath) {

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