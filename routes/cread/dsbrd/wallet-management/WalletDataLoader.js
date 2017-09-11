/**
 * Created by avnee on 06-07-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;
var AWS = config.AWS;
var uuid = require('uuid');

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

router.post('/load-data', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return getWalletScreenData(clientid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (rows) {

            var resdata = {};

            resdata.walletbalance = parseFloat(rows[0].walletbalance).toFixed(2);
            resdata.transactions = rows.filter(function (element) {
                if (element.transid !== null) {
                    delete element['walletbalance'];
                    element.amount = parseFloat(element.amount).toFixed(2);
                    return element;
                }
            });

            response.send({
                tokenstatus: 'valid',
                data: resdata
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            if (err instanceof BreakPromiseChainError){
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

function getWalletScreenData(clientid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Campaign.title, Client.walletbalance, WalletTransaction.transid, WalletTransaction.amount, WalletTransaction.type, WalletTransaction.regdate AS transactiondate ' +
            'FROM Client ' +
            'LEFT JOIN WalletTransaction ' +
            'ON Client.clientid = WalletTransaction.clientid ' +
            'LEFT JOIN Campaign ' +
            'ON WalletTransaction.cmid = Campaign.cmid ' +
            'WHERE Client.clientid = ? ' +
            'ORDER BY WalletTransaction.regdate DESC', [clientid], function (err, rows) {

            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }

        });
    });
}

module.exports = router;