/**
 * Created by avnee on 31-08-2017.
 */

/**
 * This module takes care of handling 'add' and 'edit' events for creating campaigns by a user from the app explore feed
 * */

'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var AWS = config.AWS;

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var campaign_utils = require('./CampaignUtils');

router.post('/add', function (request, response) {

    var uuid = request.body.uuid;
    var title = request.body.title;
    var description = request.body.description;
    var budget = 0;
    var type = "Web";
    var cmpstatus = 'ACTIVE';   //Default status
    var imagepath = request.body.imagepath;
    var contentbaseurl = request.body.contentbaseurl;
    var cmid = uuidGenerator.v4();
    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var mission = request.body.mission;

    var connection;

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var sqlparams = {
        cmid: cmid,
        clientid: clientid,
        title: title,
        description: description,
        budget: budget,
        type: type,
        cmpstatus: cmpstatus,
        imagepath: imagepath,
        mission: mission,
        contentbaseurl: contentbaseurl,
        main_feed: false
    };

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
            return campaign_utils.addCampaign(sqlparams, connection);
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

router.post('/edit', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var description = request.body.description;
    //var budget = 0; //request.body.budget;
    var mission = request.body.mission;
    var imagepath = request.body.imagepath;
    var cmid = request.body.cmid;

    var connection;

    var sqlparams = {
        description: description,
        //budget: budget,
        imagepath: imagepath,
        mission: mission
    };

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
            return campaign_utils.updateCampaign(cmid, sqlparams, connection);
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