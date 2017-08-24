/**
 * Created by avnee on 22-08-2017.
 */
'use-strict;'

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
        .then(function (result) {
            response.send({
                tokenstatus: 'valid',
                data: result
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
        connection.query('SELECT Client.bio, Campaign.title, Campaign.cmid, Campaign.description, Campaign.mission, Campaign.regdate, Campaign.contentbaseurl, Campaign.imagepath, SUM(!ISNULL(Share.shareid)) AS sharescount ' +
            'FROM Client ' +
            'LEFT JOIN Campaign ' +
            'ON Client.clientid = Campaign.clientid ' +
            'LEFT JOIN Share ' +
            'ON Campaign.cmid = Share.cmid ' +
            'WHERE Campaign.clientid = ? ' +
            'AND Campaign.cmpstatus = ? ' +
            'GROUP BY Campaign.cmid', [clientid, "ACTIVE"], function (err, rows) {

            if(err) {
                reject(err);
            }
            else {

                var biostatus = rows[0].bio ? true : false;

                rows = rows.map(function (element) {

                    if(element.hasOwnProperty("bio")){
                        delete element.bio;
                    }

                    return element;
                });


                resolve({
                    campaigns: rows,
                    biostatus: biostatus
                });
            }

        });
    });
}

module.exports = router;