/**
 * Created by avnee on 24-10-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var uuidGenerator = require('uuid');
var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var multer  = require('multer');
var upload = multer({ dest: './public/images/uploads/' });
var fs = require('fs');
var path = require('path');

router.post('/', upload.single('capture'), function (request, response) {

    var ext = request.body.ext;
    var capture = request.file;

    fs.rename(capture.path, './public/images/uploads/capture.' + ext, function (err) {
        if(err){
            throw err;
        }
        else{
            response.send('done').end();
        }
    });

});

module.exports = router;