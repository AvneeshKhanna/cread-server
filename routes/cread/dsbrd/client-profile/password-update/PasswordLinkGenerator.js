/**
 * Created by avnee on 05-09-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../../Config');
var AWS = config.AWS;

var _auth = require('../../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../../utils/BreakPromiseChainError');
var sesEmailer = require('../../wallet-management/TransactionEmailer');

var moment = require('moment');
var cryptojs = require('crypto-js');

router.post('/request', function (request, response) {

    var email = request.body.email;
    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return checkValidEmail(connection, email);
        })
        .then(function (result) {
            if(result.status === "valid-email") {
                var resetlink = generatePasswordUpdateLink(email);
                return sendResetEmail(email, result.clientname, resetlink)
            }
            else{
                response.send({
                    status: result.status
                });
                response.end();
                throw new BreakPromiseChainError();
            }
        })
        .then(function () {
            response.send({
                status: 'done'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
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

function checkValidEmail(connection, email){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT clientid, name FROM Client WHERE email = ?', [email], function (err, row) {
            if(err){
                reject(err);
            }
            else if(row[0]){    //Email is registered
                resolve({
                    status: 'valid-email',
                    clientname: row[0].name
                });
            }
            else{
                resolve({
                    status: 'invalid-email'
                });
            }
        });
    });
}

function generatePasswordUpdateLink(email) {

    var timestamp = moment().format('x');

    var payload = {
        timestamp: timestamp,
        email: email
    };

    // Encrypt
    var ciphertext = cryptojs.AES.encrypt(JSON.stringify(payload), config['crypto-secret-key']);

    return 'http://dashboard.cread.in/#!/resetpassword?payload=' +
        ciphertext;
}

function sendResetEmail(clientemail, clientname, resetlink) {
    return new Promise(function (resolve, reject) {

        sesEmailer.setAWSConfigForSES(AWS);

        var ses = new AWS.SES();
        var params = {
            Destination: {
                ToAddresses: [
                    clientemail
                ]
            },
            Message: {
                Body: {
                    Html: {
                        Charset: "UTF-8",
                        Data: "Hi " + clientname + ",<br><br> You can reset your password from the link mentioned below:<br><br>" + resetlink
                    }
                },
                Subject: {
                    Charset: "UTF-8",
                    Data: "Cread: Password Reset"
                }
            },
            Source: "Cread Inc. <admin@cread.in>"
        };

        ses.sendEmail(params, function (err, data) {

            sesEmailer.resetAWSConfig(AWS);

            if (err) {  // an error occurred
                reject(err)
            }
            else {  // successful response
                resolve();
            }
        });
    });
}

module.exports = router;