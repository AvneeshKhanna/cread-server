/**
 * Created by avnee on 31-08-2017.
 */
'use strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var AWS = config.AWS;

var uuidGenerator = require('uuid');
var Hashids = require('hashids');
var moment = require('moment');

var utils = require('../utils/Utils');
var consts = require('../utils/Constants');

var _auth = require('../../auth-token-management/AuthTokenManager');
var share_utils = require('./ShareUtils');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

router.post('/save', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;
    var cmid = request.body.cmid;
    var sharerate = 0;   //TODO: Make sharerate dynamic
    var checkstatus = "NA";

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

            var params = {
                shareid: uuidGenerator.v4(),
                UUID: uuid,
                cmid: cmid,
                sharerate: sharerate,
                checkstatus: checkstatus,
                channel: 'Facebook',    //TODO: Make channel dynamic
                donation: false
            };

            return share_utils.saveShareToDb(params, connection);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: true
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });
});

module.exports = router;