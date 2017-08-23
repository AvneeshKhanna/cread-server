/**
 * Created by avnee on 22-08-2017.
 */
var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

var connection = config.createConnection;

router.post('/load-all', function (request, response) {
    var clientid = request.body.clientid;
    var authkey = request.body.authkey;

    _auth.clientAuthValid(clientid, authkey)
        .then(function (client) {
            return loadCampaigns(clientid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (rows) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    campaigns: rows
                }
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
                }).end();
            }
        });

});

function loadCampaigns(clientid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Campaign.title, Campaign.cmid, Campaign.description, Campaign.mission, Campaign.regdate, Campaign.contentbaseurl, Campaign.imagepath, SUM(!ISNULL(Share.shareid)) AS sharescount ' +
            'FROM Campaign ' +
            'LEFT JOIN Share ' +
            'ON Campaign.cmid = Share.cmid ' +
            'WHERE Campaign.clientid = ? ' +
            'AND Campaign.cmpstatus = ? ' +
            'GROUP BY Campaign.cmid', [clientid, "ACTIVE"], function (err, rows) {

            if(err) {
                reject(err);
            }
            else {
                resolve(rows);
            }

        });
    });
}

module.exports = router;