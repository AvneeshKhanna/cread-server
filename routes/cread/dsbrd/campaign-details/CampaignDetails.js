/**
 * Created by avnee on 25-06-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var moment = require('moment');

var config = require('../../../Config');
var _auth = require('../../../auth-token-management/AuthTokenManager');
var consts = require('../../utils/Constants');

var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

router.post('/graph', function (request, response) {

    console.log("Request is " + JSON.stringify(request.body, null, 3));

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;
    var days = request.body.days;

    var connection;

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return getShareGraph(connection, cmid, days);
        })
        .then(function (data) {
            response.send({
                tokenstatus: 'valid',
                data: data
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
                    error: 'Some error occured at the server'
                });
                response.end();
            }
        });

});

/**
 * Function to get data for the no of shares for a given 'Campaign'
 * */
function getShareGraph(connection, cmid, days) {

    return new Promise(function (resolve, reject) {

        connection.query('SELECT shareid, regdate ' +
            'FROM Share ' +
            'WHERE cmid = ? ' +
            'AND checkstatus = ? ' +
            'ORDER BY regdate DESC', [cmid, 'COMPLETE'], function (err, rows) {

            if (err) {
                reject(err);
            }
            else {

                console.log("data from query is " + JSON.stringify(rows, null, 3));

                var discreteDates = [];

                for (var i = 0; i < days; i++) {
                    discreteDates[i] = moment().subtract(i, 'days').format('YYYY-MM-DD');
                }

                console.log("discreteDates array is " + JSON.stringify(discreteDates, null, 3));

                var data = new Array();

                for (var i = 0; i < discreteDates.length; i++) {
                    var element = discreteDates[i];

                    data[i] = {
                        regdate: element,
                        no_of_shares: calculateSharesPerDay(rows, element)
                    }

                }

                resolve(data);
            }

        });

    });

}

/**
 * Function to calcualate the no of shares for a given date
 *
 * 'arr' should be of the form:
 *      [
 *          {
 *              key1: value1,
 *              key2: value2,
 *              regdate: 2016-02-12
 *          },
 *          .
 *          .
 *      ]
 * */
function calculateSharesPerDay(arr, date) {

    var filteredArr = arr.filter(function (element) {
        var thisdate = element.regdate;
        return (moment(thisdate).format('YYYY-MM-DD') === date);
    });

    console.log("filteredArray is " + JSON.stringify(filteredArr, null, 3));

    return filteredArr.length;
}

router.post('/real-time-shares', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;
    var connection;
    //var limit = request.body.limit;

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return getIndividualShares(connection, cmid);
        })
        .then(function (data) {
            response.send({
                tokenstatus: 'valid',
                data: data
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
                });
                response.end();
            }
        });

});

/**
 * Function to return all the specific shares for a given 'Campaign'
 * */
function getIndividualShares(connection, cmid) {

    return new Promise(function (resolve, reject) {

        connection.query('SELECT users.firstname, users.lastname, Share.sharerate, Share.regdate, Share.checkstatus, Checks.checkrate, COUNT(*) AS shares_verified_count ' +
            'FROM Share ' +
            'JOIN users ' +
            'ON Share.UUID = users.UUID ' +
            'JOIN Checks ' +
            'ON Share.shareid = Checks.shareid ' +
            'WHERE Share.cmid = ? ' +
            'AND Share.checkstatus = ? ' +
            'AND Checks.responses = ? ' +
            'GROUP BY Share.shareid ' +
            'ORDER BY Share.regdate DESC', [cmid, 'COMPLETE', 'verified'], function (err, rows) {

            if (err) {
                reject(err);
            }
            else {

                for (var i = 0; i < rows.length; i++) {
                    var obj = rows[i];
                    rows[i].regdate = moment(obj.regdate).format('YYYY-MM-DD HH:mm');
                    rows[i].sharerate = parseFloat(rows[i].sharerate +  (rows[i].checkrate * rows[i].shares_verified_count)) * parseFloat(1 + consts.markup / 100) * parseFloat(1 + 18 / 100); //tax
                }

                resolve(rows);

            }
        });

    });

}

module.exports = router;