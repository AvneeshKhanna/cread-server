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

router.post('/', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return getLatestUpdates(clientid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
        })
        .then(function (rows) {
            response.send({
                tokenstatus: 'valid',
                data: rows
            });
            response.end();
        })
        .catch(function (err) {
            console.error(err);
            response.send({
                error: 'Some error occurred at the server'
            });
            response.end();
        })

});

function getLatestUpdates(clientid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Campaign.title, users.firstname, users.lastname, Share.regdate, Share.checkstatus ' +
            'FROM users ' +
            'INNER JOIN Share ' +
            'ON users.UUID = Share.UUID ' +
            'INNER JOIN Campaign ' +
            'ON Share.cmid = Campaign.cmid ' +
            'WHERE Campaign.clientid = ? ' +
            'ORDER BY Share.regdate DESC', [clientid], function (err, rows) {

            if(err){
                reject(err);
            }
            else{
                resolve(rows);
            }

        })
    })
}

module.exports = router;