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
var multer  = require('multer');
var upload = multer({ dest: './images/uploads/short/' });
var fs = require('fs');

var utils = require('../utils/Utils');

var filebasepath = './images/uploads/short/';

router.post('/generate', function (request, response) {
    console.log("request body " + JSON.stringify(request.body, null, 3));
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var file = request.file;
    var captureid = request.body.captureid;

    var guid = uuidgen.v4();
    var connection;

    config.getNewConnection()
        .then(function (conn) {
           connection = conn;
           return userprofileutils.renameFile(filebasepath, file, guid)
        })

});

module.exports = router;