/**
 * Created by avnee on 08-09-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../../Config');
var envconfig = require('config');
var envtype = envconfig.get('type');

var BreakPromiseChainError = require('../../../utils/BreakPromiseChainError');
var _auth = require('../../../../auth-token-management/AuthTokenManager');

var moment = require('moment');
var cryptojs = require('crypto-js');

router.post('/verify-user', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var cipher = decodeURIComponent(request.body.payload);

    var payload;

    try {
        payload = decode(cipher);
        console.log("decoded cipher is " + JSON.stringify(payload, null, 3));
    }
    catch (ex) {
        console.error(ex);
        response.send({
            status: 'bad-link'
        });
        response.end();
        return;
    }

    try {
        if (isExpired(payload.timestamp)) {
            console.log('link expired');
            response.send({
                status: 'bad-link'
            });
            response.end();
        }
        else {
            response.send({
                status: 'done',
                clientid: payload.clientid
            });
            response.end();
        }
    }
    catch (ex) {
        console.error(ex);
        response.status(500).send({
            error: 'Some error occurred at the server'
        });
        response.end()
    }

});

function decode(ciphertext) {
    var bytes = cryptojs.AES.decrypt(ciphertext.toString(), config['crypto-secret-key']);
    return JSON.parse(bytes.toString(cryptojs.enc.Utf8));
}

/*Timestamps are in milliseconds*/
function isExpired(timestamp) {
    var currenttime = moment();
    var emailtimestamp = moment(parseInt(timestamp));

    console.log('current timestamp is ' + currenttime.toString());
    console.log('email timestamp is ' + emailtimestamp.toString());
    console.log('diff is ' + currenttime.diff(emailtimestamp).toString());

    var expiryinterval = (envtype === 'PRODUCTION') ? 24 * 60 * 60 * 1000 : 60 * 1000;

    return currenttime.diff(emailtimestamp) > expiryinterval;
}

router.post('/update-password', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var password = request.body.password;
    var clientid = request.body.clientid;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return updatePassword(connection, clientid, password);
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

function updatePassword(connection, clientid, password) {
    return new Promise(function (resolve, reject) {

        var payload = {
            clientid: clientid
        };

        var authkey = _auth.generateToken(payload);

        connection.query('UPDATE Client ' +
            'SET password = ? ' +
            'WHERE clientid = ? ' +
            'AND authkey = ?', [password, clientid, authkey], function (err, row) {

            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

module.exports = router;
