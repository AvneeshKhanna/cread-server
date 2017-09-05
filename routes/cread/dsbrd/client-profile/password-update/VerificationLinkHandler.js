/**
 * Created by avnee on 05-09-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../../Config');

var _auth = require('../../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../../utils/BreakPromiseChainError');

router.post('/request', function (request, response) {

    var email = request.body.email;
    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return checkValidEmail(connection, email);
        })
        .then(function (result) {
            if(result === "valid-email") {
                var link = generatePasswordUpdateLink();
            }
            else{
                response.send({
                    status: result
                });
                response.end();
                throw new BreakPromiseChainError();
            }
        })
        .then(function () {

        })


});

function checkValidEmail(connection, email){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT clientid FROM Client WHERE email = ?', [email], function (err, data) {
            if(err){
                reject(err);
            }
            else if(row[0]){    //Email is registered
                resolve('valid-email');
            }
            else{
                resolve('invalid-email');
            }
        })
    })
}

function generatePasswordUpdateLink() {
    var timestamp = new Date().toISOString();
}