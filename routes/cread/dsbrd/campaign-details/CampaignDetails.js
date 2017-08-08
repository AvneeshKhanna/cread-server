/**
 * Created by avnee on 25-06-2017.
 */

var express = require('express');
var router = express.Router();

var moment = require('moment');

var config = require('../../../Config');
var connection = config.createConnection;
var _auth = require('../../../auth-token-management/AuthTokenManager');

var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

router.post('/graph', function (request, response) {
    
    console.log("Request is " + JSON.stringify(request.body, null, 3));

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;
    var days = request.body.days;

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return getShareGraph(cmid, days);
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
                data: data
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
                    error: 'Some error occured at the server'
                });
                response.end();
            }
        });

});

/**
 * Function to get data for the no of shares for a given 'Campaign'
 * */
function getShareGraph(cmid, days) {

    return new Promise(function (resolve, reject) {

        connection.query('SELECT shareid, regdate FROM Share WHERE cmid = ? ORDER BY regdate DESC', [cmid], function (err, rows) {

            if(err){
                reject(err);
            }
            else{

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
        return (moment(thisdate).format('YYYY-MM-DD') == date);
    });
    
    console.log("filteredArray is " + JSON.stringify(filteredArr, null, 3));
    
    return filteredArr.length;
}

router.post('/real-time-shares', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;
    var limit = request.body.limit;

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return getIndividualShares(cmid, limit);
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
                data: data
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
                });
                response.end();
            }
        });

});

/**
 * Function to return all the specific shares for a given 'Campaign'
 * */
function getIndividualShares(cmid, limit) {

    return new Promise(function (resolve, reject) {

        connection.query('SELECT users.firstname, users.lastname, Share.sharerate, Share.regdate, Share.checkstatus ' +
            'FROM Share ' +
            'JOIN users ' +
            'ON Share.UUID = users.UUID ' +
            'WHERE Share.cmid = ? ' +
            'AND Share.checkstatus = ? ' +
            'ORDER BY Share.regdate DESC LIMIT ?', [cmid, 'COMPLETE', limit], function (err, rows) {

            if(err){
                reject(err);
            }
            else {

                for (var i = 0; i < rows.length; i++) {
                    var obj = rows[i];
                    rows[i].regdate = moment(obj.regdate).format('YYYY-MM-DD HH:mm');
                }

                resolve(rows);

            }
        })

    })

}

module.exports = router;