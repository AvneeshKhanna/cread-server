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
    var amount = request.body.amount;
    var userpaytmcontact = request.body.userpaytmcontact;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return transactToPaytm(uuid, amount);
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
                    status: 'success'
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
 * Function to transact amount to user's paytm wallet
 * */
function transactToPaytm(uuid, amount) {

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
                    'JOIN Checks ' +
                    'ON Share.shareid = Checks.shareid ' +
                    'SET Share.cashed_in = ? ' +
                    'WHERE Checks.responses = ? AND Share.UUID = ?', [1, 'verified', uuid], function (err, row) {

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