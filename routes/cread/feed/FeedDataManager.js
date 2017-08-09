/**
 * Created by avnee on 07-06-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var consts = require('../utils/Constants');

router.post('/load/', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;

    console.log("authkey is " + JSON.stringify(authkey, null, 3));

    var resdata = {};

    _auth.checkToken(uuid, authkey, function (err, datasize) {

        if (err) {
            console.error(err);
            throw err;
        }
        else if (datasize == 0) {

            resdata.tokenstatus = 'invalid';
            response.send(resdata);
            response.end();

        }
        else {
            connection.query('SELECT Campaign.cmid, Campaign.title, Campaign.description, Campaign.mission, Campaign.type, Campaign.contentbaseurl, ' +
                'Campaign.imagepath, Campaign.regdate, SUM(!ISNULL(Share.shareid)) AS sharescount, ' +
                'Client.name AS clientname, Client.bio AS clientbio ' +
                'FROM Campaign ' +
                'JOIN Client ' +
                'ON Campaign.clientid = Client.clientid ' +
                'LEFT JOIN Share ' +
                'ON Campaign.cmid = Share.cmid ' +
                'WHERE Campaign.cmpstatus = ? AND Campaign.budget > 0 ' +
                'GROUP BY Campaign.regdate', ['ACTIVE'], function (err, rows) {

                if (err) {
                    console.error(err);
                    throw err;
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

                connection.query('SELECT users.fbusername, UserInterestsRel.UUID AS interestedUser ' +
                    'FROM users ' +
                    'LEFT JOIN UserInterestsRel ' +
                    'ON users.UUID = UserInterestsRel.UUID ' +
                    'WHERE users.UUID = ? ' +
                    'LIMIT 1', [uuid], function (err, row) {
                    if (err) {
                        throw err;
                    }
                    else {
                        console.log("rows after querying is " + JSON.stringify(rows, null, 3));

                        response.send({
                            tokenstatus: 'valid',
                            data: {
                                feed: rows,
                                fbidstatus: row[0].fbusername != null,
                                intereststatus: row[0].interestedUser != null
                            }
                        });
                        response.end();
                    }
                });

            });
        }
    });

});

router.post('/load/specific', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;
    var cmid = request.body.cmid;

    console.log("authkey is " + JSON.stringify(authkey, null, 3));

    var resdata = {};

    _auth.checkToken(uuid, authkey, function (err, datasize) {

        if (err) {
            console.error(err);
            throw err;
        }
        else if (datasize == 0) {

            resdata.tokenstatus = 'invalid';
            response.send(resdata);
            response.end();

        }
        else {
            connection.query('SELECT Campaign.title, Campaign.description, Campaign.mission, Campaign.type, Campaign.contentbaseurl, ' +
                'Campaign.imagepath, Campaign.regdate, ' +
                'Client.name AS clientname, Client.bio AS clientbio ' +
                'FROM Campaign ' +
                'JOIN Client ' +
                'ON Campaign.clientid = Client.clientid ' +
                'WHERE Campaign.cmid = ?', [cmid], function (err, row) {

                if (err) {
                    console.error(err);
                    throw err;
                }

                row.map(function (element) {
                    element.sharerate = consts.sharerate;     //TODO: Make sharerate dynamic
                });

                connection.query('SELECT fbusername FROM users WHERE UUID = ?', [uuid], function (err, user) {
                    if (err) {
                        throw err;
                    }
                    else {
                        console.log("row after querying is " + JSON.stringify(user, null, 3));

                        response.send({
                            tokenstatus: 'valid',
                            data: {
                                campaign: row[0],
                                fbidstatus: user[0].fbusername != null
                            }
                        });
                        response.end();
                    }
                });

            });
        }
    });

});

module.exports = router;