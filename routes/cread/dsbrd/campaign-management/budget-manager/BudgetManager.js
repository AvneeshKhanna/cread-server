/**
 * Created by avnee on 16-07-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../../../Config');
var connection = config.createConnection;
var AWS = config.AWS;
var uuid = require('uuid');

var _auth = require('../../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../../utils/BreakPromiseChainError');

router.post('/update-budget', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;
    var amount = request.body.amount;   //Transfer Amount

    //Type of transfer: 'ALLOCATE' for wallet -> campaign & 'DEALLOCATE' for campaign -> wallet
    //The 'DEALLOCATE' type would only be applicable when the campaign is deactivated
    var type = request.body.type;

    console.log("request is " + JSON.stringify(request.body, null, 3));

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return registerBudgetTransfer(clientid, cmid, amount, type);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError;
        })
        .then(function (status) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: status
                }
            });
            response.end();
            throw new BreakPromiseChainError;
        })
        .catch(function (err) {
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

/**
 * Function to increase/decrease budget of a campaign by a specified amount
 *
 * @param clientid Client's account id in context to the transaction
 * @param cmid Campaign ID whose budget is to be modified
 * @param amount Amount to transfer
 * @param type Determines whether to increase or decrease budge. Could either of the values: <b>ADD</b> or <b>REMOVE</b>
 * */
function registerBudgetTransfer(clientid, cmid, amount, type) {
    return new Promise(function (resolve, reject) {

        connection.beginTransaction(function (err) {
            if (err) {
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {

                connection.query('SELECT Client.walletbalance, Campaign.budget ' +
                    'FROM Client ' +
                    'JOIN Campaign ' +
                    'ON Client.clientid = Campaign.clientid ' +
                    'WHERE Campaign.cmid = ? ' +
                    'FOR UPDATE', [cmid], function (err, rows) {

                    if (err) {
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else {

                        if (type == 'ALLOCATE' && parseFloat(rows[0].walletbalance) < parseFloat(amount)) {
                            connection.commit(function (err) {
                                if (err) {
                                    connection.rollback(function () {
                                        reject(err);
                                    });
                                }
                                else {
                                    console.log('registerTransaction TRANSACTION committed: balance < transact amount');
                                    resolve('LOW-BALANCE');
                                }

                            });
                        }
                        else if (type == 'DEALLOCATE' && parseFloat(rows[0].budget) != parseFloat(amount)) {
                            connection.commit(function (err) {
                                if (err) {
                                    connection.rollback(function () {
                                        reject(err);
                                    });
                                }
                                else {
                                    console.log('registerTransaction TRANSACTION committed: budget != transact amount');
                                    resolve('AMOUNT-MISMATCH');
                                }
                            });
                        }
                        else {
                            var newbalance;
                            var newbudget;

                            if (type == 'ALLOCATE') { //When client wants to add the amount to camp budget from his wallet
                                newbalance = parseFloat(rows[0].walletbalance) - parseFloat(amount);
                                newbudget = parseFloat(rows[0].budget) + parseFloat(amount);
                            }
                            else {  //When client wants to transact back the budget amount to his wallet
                                newbalance = parseFloat(rows[0].walletbalance) + parseFloat(rows[0].budget);
                                newbudget = 0;
                            }

                            connection.query('UPDATE Client, Campaign ' +
                                'SET Client.walletbalance = ?, Campaign.budget = ? ' +
                                'WHERE Client.clientid = Campaign.clientid ' +
                                'AND Campaign.cmid = ?', [newbalance, newbudget, cmid], function (err, row) {

                                if (err) {
                                    connection.rollback(function () {
                                        reject(err);
                                    });
                                }
                                else {

                                    var transParams = {
                                        transid: uuid.v4(),
                                        amount: amount,
                                        type: type,
                                        clientid: clientid,
                                        cmid: cmid
                                    };

                                    connection.query('INSERT INTO WalletTransaction SET ?', [transParams], function (err, data) {
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
                                                    console.log('registerTransaction TRANSACTION committed successfully');
                                                    resolve('SUCCESS');
                                                }

                                            });
                                        }
                                    });
                                }

                            });
                        }

                    }

                });

            }
        });

    });
}

module.exports = router;