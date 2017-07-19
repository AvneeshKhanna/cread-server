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
            return registerBudgetTransfer(cmid, amount, type);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
        })
        .then(function (status) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: status
                }
            });
            response.end();
        })
        .catch(function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Some error occurred at the server'
            }).end();
        })

});

/**
 * Function to increase/decrease budget of a campaign by a specified amount
 *
 * @param cmid Campaign ID whose budget is to be modified
 * @param amount Amount to transfer
 * @param type Determines whether to increase or decrease budge. Could either of the values: <b>ADD</b> or <b>REMOVE</b>
* */
function registerBudgetTransfer(cmid, amount, type) {
    return new Promise(function (resolve, reject) {

        connection.beginTransaction(function (err) {
            if(err){
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

                    if(err){
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else{

                        if(type == 'ALLOCATE' && parseInt(rows[0].walletbalance) < parseInt(amount)){
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
                        else {
                            var newbalance;
                            var newbudget;

                            if(type == 'ALLOCATE'){ //When client wants to add the amount to camp budget from his wallet
                                newbalance = parseInt(rows[0].walletbalance) - parseInt(amount);
                                newbudget = parseInt(rows[0].budget) + parseInt(amount);
                            }
                            else {  //When client wants to transact back the budget amount to his wallet
                                newbalance = parseInt(rows[0].walletbalance) + parseInt(rows[0].budget);
                                newbudget = 0;
                            }

                            connection.query('UPDATE Client, Campaign ' +
                                'SET Client.walletbalance = ?, Campaign.budget = ? ' +
                                'WHERE Client.clientid = Campaign.clientid ' +
                                'AND Campaign.cmid = ?', [newbalance, newbudget, cmid], function (err, row) {

                                if(err){
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

                    }

                })

            }
        })

    })
}

module.exports = router;