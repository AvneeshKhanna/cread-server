/**
 * Created by avnee on 27-07-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;
var AWS = config.AWS;
var uuid = require('uuid');

var _auth = require('../../../auth-token-management/AuthTokenManager');

router.post('/', function (request, response) {

    var cmid = request.body.cmid;   //Can be NULL
    var message = request.body.message;
    var app_model = request.body.app_model; // "1.0" or "2.0"
    var category = request.body.category;
    var persist = request.body.persist;     //"Yes" or "No"

});