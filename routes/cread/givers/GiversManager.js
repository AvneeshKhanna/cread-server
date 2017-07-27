/**
 * Created by avnee on 14-07-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var uuidGenerator = require('uuid');
var Hashids = require('hashids');

var utils = require('../utils/Utils');

var _auth = require('../../auth-token-management/AuthTokenManager');

router.post('/load', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return getGiversData(uuid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            }).end();
        })
        .then(function (rows) {

            console.log("rows after query is " + JSON.stringify(rows, null, 3));

            //Sorting the rows in decreasing order of donated amount
            rows.sort(function (a, b) {
                if (a.donatedamount < b.donatedamount) {
                    return 1;
                }
                else {
                    return -1;
                }
            });

            //Adding 'rank' key for every user
            rows = rows.map(function (element) {
                element.rank = rows.indexOf(element) + 1;
                return element;
            });

            //Extracting the requesting user's data from rows
            var thisuserindex = rows.map(function (element) {
                return element.uuid;
            }).indexOf(uuid);

            var thisuser;

            if (thisuserindex == -1) {
                thisuser = {};
            }
            else {
                thisuser = rows[thisuserindex];
                thisuser.rank = thisuserindex + 1;
            }

            //Send back the response
            response.send({
                tokenstatus: 'valid',
                data: {
                    otherusers: rows.slice(0, 5),
                    thisuser: thisuser
                }
            });
            response.end();

        }, function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Some error occurred at the server'
            }).end();
        })

});

function getGiversData() {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT users.UUID AS uuid, users.firstname, users.lastname, SUM(Share.sharerate) AS donatedamount ' +
            'FROM users ' +
            'LEFT JOIN Share ' +
            'ON users.UUID = Share.UUID ' +
            'WHERE Share.donation = ? ' +
            'GROUP BY users.UUID', [true], function (err, rows) {

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