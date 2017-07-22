/**
 * Created by avnee on 20-07-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');

var docClient = new AWS.DynamoDB.DocumentClient();

var _auth = require('../../../auth-token-management/AuthTokenManager');

router.post('/', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return transactToPaytm(uuid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();

        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'SUCCESS'
                }
            });
            response.end();
        })
        .catch(function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Some error occurred at the server'
            });
            response.end();
        })

});

/**
 * Function to transact
 * */
function transactToPaytm(uuid) {

    return new Promise(function (resolve, reject) {

        connection.beginTransaction(function (err) {
            if (err) {
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {

                //Updating Share table
                connection.query('UPDATE Share ' +
                    'SET Share.cashed_in = 1 ' +
                    'FROM Share ' +
                    'JOIN Checks ' +
                    'ON Share.shareid = Checks.shareid ' +
                    'WHERE Checks.responses = ? AND Share.UUID = ?', ['verified', uuid], function (err, row) {

                    if (err) {
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else {

                        //Updating Checks table
                        connection.query('UPDATE Checks ' +
                            'SET Checks.cashed_in = 1 ' +
                            'WHERE Checks.UUID = ?', [uuid], function (err, data) {

                            if (err) {
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else {

                                //TODO: Implement paytm transaction

                                connection.commit(function (err) {
                                    if (err) {
                                        connection.rollback(function () {
                                            reject(err);
                                        });
                                    }
                                    else {
                                        resolve();
                                    }
                                });

                            }

                        });

                    }

                });

            }
        });
    });

}

module.exports = router;