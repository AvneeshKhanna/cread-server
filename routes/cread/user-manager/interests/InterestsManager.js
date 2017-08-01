/**
 * Created by avnee on 01-08-2017.
 */
'use strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

router.post('/load', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return loadAllInterests();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (data) {

            response.send({
                tokenstatus: 'valid',
                data: {
                    interests: data
                }
            });
            response.end();
            throw new BreakPromiseChainError();

        })
        .catch(function (err) {
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.send({
                    error: 'Some error occurred at the server'
                });
                response.end();
            }
        });

});

function loadAllInterests() {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT * FROM Interests', [], function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}

router.post('/save', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var interests = request.body.interests; //array of interest ids

    _auth.authValid(uuid, authkey)
        .then(function () {
            return saveUserInterests(uuid, interests);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
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
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        })

});

function saveUserInterests(uuid, interestlist) {
    return new Promise(function (resolve, reject) {

        var values = restructureInterestList(uuid, interestlist);

        connection.query('INSERT INTO UserInterestsRel VALUES ?', [values], function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function restructureInterestList(uuid, interestlist) {

    var masterArr = [];

    console.log("interestlist  is " + JSON.stringify(interestlist, null, 3));

    interestlist.forEach(function (interest) {
        var subArr = [uuid, interest];
        masterArr.push(subArr);
    });

    return masterArr;
}

module.exports = router;