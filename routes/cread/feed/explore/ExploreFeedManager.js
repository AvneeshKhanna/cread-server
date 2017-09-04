/**
 * Created by avnee on 29-08-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var AWS = config.AWS;

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');
var consts = require('../../utils/Constants');

router.post('/load', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;
    var clientid = request.body.clientid;

    var connection;

    console.log("authkey is " + JSON.stringify(authkey, null, 3));

    var resdata = {};

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
            return loadExploreFeed(connection, clientid);
        })
        .then(function (data) {
            response.send({
                tokenstatus: 'valid',
                data: data
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

function loadExploreFeed(connection, clientid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Campaign.cmid, Campaign.title, Campaign.description, Campaign.mission, Campaign.type, Campaign.contentbaseurl, ' +
            'Campaign.imagepath, Campaign.regdate, SUM(!ISNULL(Share.shareid)) AS sharescount, ' +
            'Client.name AS clientname, Client.bio AS clientbio ' +
            'FROM Campaign ' +
            'JOIN Client ' +
            'ON Campaign.clientid = Client.clientid ' +
            'LEFT JOIN Share ' +
            'ON Campaign.cmid = Share.cmid ' +
            'WHERE Campaign.cmpstatus = ? ' +
            'AND Campaign.main_feed = ? ' +
            'GROUP BY Campaign.regdate', ['ACTIVE', false], function (err, rows) {

            if (err) {
                reject(err);
            }

            //Sorting according last created
            rows.sort(function (a, b) {
                if (a.regdate < b.regdate) {
                    return 1;
                }
                else {
                    return -1;
                }
            });

            rows.map(function (element) {
                element.sharerate = consts.sharerate;     //TODO: Make sharerate dynamic
            });

            if (clientid) {

                connection.query('SELECT bio ' +
                    'FROM Client ' +
                    'WHERE clientid = ? ', [clientid], function (err, row) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        console.log("rows after querying is " + JSON.stringify(rows, null, 3));

                        resolve({
                            explorefeed: rows,
                            biostatus: row[0].bio != null
                        });
                    }
                });

            }
            else {
                resolve({
                    explorefeed: rows,
                    biostatus: false
                });
            }

        });
    });
}

module.exports = router;