/**
 * Created by avnee on 17-07-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;
var AWS = config.AWS;
var uuid = require('uuid');

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

router.post('/', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var limit = request.body.limit;

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return getLatestUpdates(clientid, limit);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (rows) {
            response.send({
                tokenstatus: 'valid',
                data: rows
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.send({
                    error: 'Some error occurred at the server'
                });
                response.end();
            }
        });
});

function getLatestUpdates(clientid, limit) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Campaign.title, users.firstname, users.lastname, Share.regdate, Share.checkstatus ' +
            'FROM users ' +
            'INNER JOIN Share ' +
            'ON users.UUID = Share.UUID ' +
            'INNER JOIN Campaign ' +
            'ON Share.cmid = Campaign.cmid ' +
            'WHERE Campaign.clientid = ? ' +
            'AND Campaign.main_feed = ? ' +
            'ORDER BY Share.regdate DESC ' +
            'LIMIT ?', [clientid, limit, true], function (err, rows) {

            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }

        })
    })
}

module.exports = router;