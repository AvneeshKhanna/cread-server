/**
 * Created by avnee on 29-08-2017.
 */
'use-strict;'

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

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
            else{

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

module.exports = router;