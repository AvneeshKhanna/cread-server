/**
 * Created by avnee on 08-09-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../../Config');

var BreakPromiseChainError = require('../../../utils/BreakPromiseChainError');

var moment = require('moment');
var cryptojs = require('crypto-js');

router.post('/verify-user', function (request, response) {

    var ciphertext = request.body.ciphertext;

    var payload;

    try{
        payload = decode(ciphertext);
    }
    catch(ex){
        response.send({
            status: 'bad-link'
        });
        response.end();
        return;
    }

    if(isExpired(payload.timestamp)){
        response.send({
            status: 'bad-link'
        });
        response.end();
    }
    else{
        response.send({
            status: 'done'
        });
        response.end();
    }

});

function decode(ciphertext) {
    var bytes  = cryptojs.AES.decrypt(ciphertext.toString(), config['crypto-secret-key']);
    return JSON.parse(bytes.toString(cryptojs.enc.Utf8));
}

/*Timestamps are in milliseconds*/
function isExpired(timestamp){
    var currenttime = moment().valueOf();
    var emailtimestamp = moment(timestamp);

    return emailtimestamp.diff(currenttime) > (24 * 60 * 60 * 1000);
}

router.post('/update-password', function (request, response) {

    var password = request.body.password;
    var ciphertext = request.body.ciphertext;

    var payload;

    try{
        payload = decode(ciphertext);
    }
    catch(ex){
        response.send({
            status: 'bad-link'
        });
        response.end();
        return;
    }

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return updatePassword(connection, payload.email, password);
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

function updatePassword(connection, email, password){
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Client SET password = ? WHERE email = ?', [password, email], function (err, row) {
            if(err){
                reject(err);
            }
            else{
                resolve();
            }
        });
    });
}

module.exports = router;
