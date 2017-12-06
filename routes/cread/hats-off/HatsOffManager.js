/**
 * Created by avnee on 21-09-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var AWS = config.AWS;

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var uuidGenerator = require('uuid');
var moment = require('moment');

var utils = require('../utils/Utils');
var notify = require('../../notification-system/notificationFramework');
var hatsoffutils = require('./HatsOffUtils');
var entityutils = require('../entity/EntityUtils');
var consts = require('../utils/Constants');

router.post('/on-click', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var register = request.body.register;

    var connection;
    var requesterdetails;
    var notifuuids;
    
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
            return hatsoffutils.registerHatsOff(connection, register, uuid, entityid);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();
        })
        .then(function () {
            if(register){
                return entityutils.getEntityUsrDetailsForNotif(connection, entityid);
            }
            else {
                throw new BreakPromiseChainError();
            }
        })
        .then(function (result) {   //Send a notification to creator
            notifuuids = result;
            if(notifuuids.creatoruuid !== uuid){    //Send notification only when the two users involved are different
                var notifData = {
                    message: requesterdetails.firstname + " " + requesterdetails.lastname + " has given your post a hats-off",
                    category: "hatsoff",
                    entityid: entityid,
                    persistable: "Yes",
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(new Array(notifuuids.creatoruuid), notifData);
            }
        })
        .then(function () { //Send a notification to collaborator
            if(notifuuids.collabuuid && notifuuids.collabuuid !== uuid){    //Send notification only when the two users involved are different
                var notifData = {
                    message: requesterdetails.firstname + " " + requesterdetails.lastname + " has given a hats-off to a post which was inspired by yours",
                    category: "hatsoff",
                    entityid: entityid,
                    persistable: "Yes",
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(new Array(notifuuids.collabuuid), notifData);
            }
        })
        .then(function () {
            throw new BreakPromiseChainError(); //To disconnect server connection
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

/*function getEntityUsrDetailsForNotif(connection, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.type, Creator.uuid AS creatoruuid, ' +
            'CollabC.uuid AS collabcuuid, CollabS.uuid AS collabsuuid ' +
            'FROM Entity ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'JOIN User AS Creator ' +
            'ON (Creator.uuid = Short.uuid OR Creator.uuid = Capture.uuid)  ' +
            'LEFT JOIN Capture AS CollabC ' +
            'ON Short.capid = CollabC.capid ' +
            'LEFT JOIN Short AS CollabS ' +
            'ON Capture.shoid = CollabS.shoid ' +
            'WHERE Entity.entityid = ?', [entityid], function(err, rows){
            if(err){
                reject(err);
            }
            else{

                rows.map(function (el) {
                    if(el.type === 'SHORT'){
                        if(el.collabcuuid){
                            el.collabuuid = el.collabcuuid;
                        }
                    }
                    else if(el.type === 'CAPTURE'){
                        if(el.collabsuuid){
                            el.collabuuid = el.collabsuuid;
                        }
                    }
                });

                resolve(rows[0]);
            }
        });
    })
}*/

router.post('/load', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var page = request.body.page;
    var lastindexkey = request.body.lastindexkey;

    var limit = (config.envtype === 'PRODUCTION') ? 20 : 10;
    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        })
        .then(function (conn) {
            connection = conn;
            if(page === 0 || page){
                return hatsoffutils.loadHatsOffsLegacy(connection, entityid, limit, page);
            }
            else{
                return hatsoffutils.loadHatsOffs(connection, entityid, limit, lastindexkey);
            }
        })
        .then(function (result) {
            response.send({
                tokenstatus: 'valid',
                data: result
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });
});

/*function registerHatsOff(connection, register, uuid, entityid) {

    var sqlquery;
    var sqlparams;

    if(register){
        sqlquery = 'INSERT INTO HatsOff SET ?';
        sqlparams = {
            hoid: uuidGenerator.v4(),
            uuid: uuid,
            entityid: entityid
        }
    }
    else{
        sqlquery = 'DELETE FROM HatsOff WHERE uuid = ? AND entityid = ?';
        sqlparams = [
            uuid,
            entityid
        ]
    }

    return new Promise(function (resolve, reject) {
        connection.query(sqlquery, sqlparams, function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}*/

module.exports = router;