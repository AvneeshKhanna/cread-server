/**
 * Created by avnee on 02-11-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var AWS = config.AWS;

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var consts = require('../utils/Constants');
var utils = require('../utils/Utils');

router.post('/load', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var page = request.body.page;

    var limit = 15;

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
            return loadInspirationFeed(connection, limit, page);
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
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
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

function loadInspirationFeed(connection, limit, page) {

    var offset = limit * page;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Entity ' +
            'JOIN Capture ' +
            'USING(entityid) ' +
            'ORDER BY Entity.regdate DESC', [], function (err, data) {
            if (err) {
                reject(err);
            }
            else {

                var totalcount = data[0].totalcount;

                if(totalcount > 0){
                    connection.query('SELECT Entity.entityid, Capture.capid, Capture.uuid, User.firstname, User.lastname ' +
                        'FROM Entity ' +
                        'JOIN Capture ' +
                        'USING(entityid) ' +
                        'JOIN User ' +
                        'ON User.uuid = Capture.uuid ' +
                        'ORDER BY Entity.regdate DESC ' +
                        'LIMIT ? ' +
                        'OFFSET ?', [limit, offset], function(err, rows){
                        if(err){
                            reject(err);
                        }
                        else{

                            rows.map(function (element) {
                                element.creatorname = element.firstname + ' ' + element.lastname;
                                element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                                element.captureurl = utils.createSmallCaptureUrl(element.uuid, element.capid);

                                if(element.firstname){
                                    delete element.firstname;
                                }

                                if(element.lastname){
                                    delete element.lastname;
                                }

                                return element;
                            });

                            resolve({
                                requestmore: totalcount > (limit + offset),
                                items: rows
                            });
                        }
                    });
                }
                else{
                    resolve({
                        requestmore: totalcount > (limit + offset),
                        items: []
                    });
                }
            }
        });
    });
}

module.exports = router;