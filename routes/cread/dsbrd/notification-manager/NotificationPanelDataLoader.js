/**
 * Created by avnee on 29-07-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;

var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

router.post('/load', function (request, response) {

    loadCampaignNames()
        .then(function (campaigns) {
            response.send({
                data: {
                    campaignList: campaigns
                }
            });
            response.end();
        })
        .catch(function (err) {

            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
                console.error(err);
                throw err;
            }

        });

});

function loadCampaignNames() {
    return new Promise(function (resolve, reject) {

        connection.query('SELECT title, cmid, regdate FROM Campaign WHERE cmpstatus = ?', ['ACTIVE'], function (err, rows) {
            if(err){
                reject(err);
            }
            else {

                rows.sort(function (a, b) {
                    if(a.regdate < b.regdate){
                        return -1;
                    }
                    else {
                        return 1;
                    }
                });

                resolve(rows);
            }
        });

    });
}

module.exports = router;