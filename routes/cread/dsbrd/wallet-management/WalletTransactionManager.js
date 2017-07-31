/**
 * Created by avnee on 16-07-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;
var AWS = config.AWS;
var uuid = require('uuid');

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

//TODO: Handle case of a refund
router.post('/update-balance', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var amount = request.body.amount;
    var type = request.body.type;   //Type of transaction. Values: 'ADD' or 'REMOVE'

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return addTransactionToTable(clientid, amount, type);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function () {
            return updateClientWalletBalance(clientid, amount)
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

function addTransactionToTable(clientid, amount, type) {
    return new Promise(function (resolve, reject) {

        var params = {
            amount: amount,
            type: type
        };

        connection.query('UPDATE WalletTransaction SET ? WHERE clientid = ?', [params, clientid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        })
    })
}

function updateClientWalletBalance(clientid, amount) {
    return new Promise(function (resolve, reject) {

        connection.beginTransaction(function (err) {
            if (err) {
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {

                connection.query('SELECT clientid, walletbalance FROM Client WHERE clientid = ? FOR UPDATE', [clientid], function (err, rows) {

                    console.log('SELECT...FOR UPDATE updateClientWalletBalance query executed');

                    if (err) {
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else {

                        var newbalance = parseInt(rows[0].walletbalance) + parseInt(amount);

                        /*if(type == 'ADD'){
                            newbalance = rows[0].walletbalance + amount;
                        }
                        else{   //Case when client issues for a  refund
                            newbalance = 0;
                        }*/

                        connection.query('UPDATE Client SET walletbalance = ? WHERE clientid = ?', [newbalance, clientid], function (err, qdata) {

                            console.log("UPDATE query updateClientWalletBalance executed");

                            if (err) {
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else {

                                connection.commit(function (err) {
                                    if (err) {
                                        connection.rollback(function () {
                                            reject(err);
                                        });
                                    }
                                    else {
                                        console.log('updateClientWalletBalance TRANSACTION committed successfully');
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