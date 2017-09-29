/**
 * Created by avnee on 31-08-2017.
 */

/**
 * This module takes care of handling events from the app related to campaigns
 * */

'use-strict';

var express = require('express');
var router = express.Router();

var uuidGenerator = require('uuid');

var config = require('../../Config');
var AWS = config.AWS;

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var campaign_utils = require('./CampaignUtils');

router.post('/add', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var title = request.body.title;
    var description = request.body.description;
    var budget = 0;
    var type = "Web";
    var cmpstatus = 'ACTIVE';   //Default status
    var imagepath = request.body.imagepath;
    var contentbaseurl = request.body.contentbaseurl;
    var entityid = uuidGenerator.v4();
    var cmid = uuidGenerator.v4();
    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var mission = request.body.mission;

    var connection;

    var sqlparams = {
        cmid: cmid,
        clientid: clientid,
        entityid: entityid,
        title: title,
        description: description ? description : null ,
        budget: budget,
        type: type,
        cmpstatus: cmpstatus,
        imagepath: imagepath ? imagepath : "NA",
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
    var sqlparams = {};

    if(description){
        sqlparams.description = description;
    }
    if(imagepath){
        sqlparams.imagepath = imagepath;
    }
    if(mission){
        sqlparams.mission = mission;
    }

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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.post('/load-all', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;

    console.log("request is " + JSON.stringify(request.body, null, 3));

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
            return loadCampaigns(connection, uuid);
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

function loadCampaigns(connection, uuid) {
    return new Promise(function (resolve, reject) {

        connection.query('SELECT users.clientid, Client.bio ' +
            'FROM users ' +
            'JOIN Client ' +
            'ON users.clientid = Client.clientid ' +
            'WHERE users.uuid = ?', [uuid], function (err, row) {

            if(err){
                reject(err);
            }
            else if(!row[0]){   //Case where client doesn't exists
                resolve({
                    campaigns: row,
                    biostatus: false
                });
            }
            else{   //Case where client exists

                var biostatus = !!row[0].bio;

                connection.query('SELECT Campaign.title, Campaign.cmid, Campaign.description, ' +
                    'Campaign.mission, Campaign.regdate, Campaign.contentbaseurl, Campaign.imagepath, ' +
                    'SUM(!ISNULL(Share.shareid)) AS sharescount ' +
                    'FROM Campaign ' +
                    'LEFT JOIN Share ' +
                    'ON Campaign.cmid = Share.cmid ' +
                    'WHERE Campaign.clientid = ? ' +
                    'AND Campaign.cmpstatus = ? ' +
                    'AND Campaign.main_feed = ? ' +
                    'GROUP BY Campaign.cmid', [row[0].clientid, "ACTIVE", false], function (err, rows) {

                    if(err) {
                        reject(err);
                    }
                    else {
                        console.log("query result " + JSON.stringify(rows, null, 3));

                        resolve({
                            campaigns: rows,
                            biostatus: biostatus
                        });

                        /*if(rows[0]){    //Case where clientid exists
                            var biostatus = !!rows[0].bio;

                            rows = rows.map(function (element) {

                                if(element.hasOwnProperty("bio")){
                                    delete element.bio;
                                }

                                return element;
                            });

                            resolve({
                                campaigns: rows,
                                biostatus: biostatus
                            });
                        }
                        else{   //Case where user hasn't registered as a client
                            resolve({
                                campaigns: [],
                                biostatus: false
                            });
                        }*/
                    }

                });
            }

        });
    });
}

router.post('/load-specific', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;

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
            return loadSpecificCampaign(connection, cmid);
        })
        .then(function (row) {
            response.send({
                tokenstatus: 'valid',
                data: row
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

function loadSpecificCampaign(connection, cmid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT * FROM Campaign WHERE cmid = ?', [cmid], function (err, row) {
            if(err){
                reject(err);
            }
            else{
                resolve(row[0]);
            }
        });
    });
}

router.post('/deactivate', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;

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
            return deactivateCampaign(connection, cmid);
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
                response.status(500).send({
                    error: 'Some error occurred at the server'
                });
                response.end();
            }
        });

});

/**
 * Function to change the 'cmpstatus' of the Campaign to 'DEACTIVE'
 * */
function deactivateCampaign(connection, cmid) {

    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Campaign SET cmpstatus = ?, deactvtntime = NOW() ' +
            'WHERE cmid = ?', ['DEACTIVE', cmid], function (err, row) {

            if (err) {
                reject(err);
            }
            else {
                resolve();
            }

        });

    })

}

router.post('/load-shares', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;
    var page = (request.body.page !== undefined) ? request.body.page : -1;

    var limit = 30;
    var connection;

    console.log("request is " + JSON.stringify(request.body, null, 3));

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
            return campaign_utils.getCampaignShares(connection, cmid, 'COMPLETE', limit, page);
        })
        .then(function (result) {

            console.log("rows from getCampaignShares is " + JSON.stringify(result.rows, null, 3));

            response.send({
                tokenstatus: 'valid',
                data: {
                    shares: result.rows,
                    requestmore: result.requestmore
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });
});

router.post('/load-hatsoffs', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;
    var page = request.body.page;

    var limit = 30;
    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        })
        .then(function (conn) {
            connection = conn;
            return campaign_utils.getCampaignHatsOffs(connection, cmid, limit, page);
        })
        .then(function (result) {
            console.log("rows from getCampaignHatsOffs is " + JSON.stringify(result.rows, null, 3));
            response.send({
                tokenstatus: 'valid',
                data: {
                    hatsoffs: result.rows,
                    requestmore: result.requestmore
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });
});

module.exports = router;