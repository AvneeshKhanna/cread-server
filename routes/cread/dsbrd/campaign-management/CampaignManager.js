/**
 * Created by avnee on 07-06-2017.
 */

/**
 * To create a new, modify an existing or deactivate an existing Campaign using dashboard
 * */

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;
var _auth = require('../../../auth-token-management/AuthTokenManager');
var campaign_utils = require('../../campaign/CampaignUtils');

var AWS = config.AWS;
var uuidGenerator = require('uuid');

var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

router.post('/load', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var cmpstatus = request.body.cmpstatus; //ACTIVE or DEACTIVE

    var walletbalance;

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return getClientWalletBal(clientid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (balance) {
            walletbalance = balance;
            return getCampaigns(clientid, cmpstatus);
        })
        .then(function (rows) {

            //Sorting according last created
            rows.sort(function (a, b) {
                if (a.regdate < b.regdate) {
                    return 1;
                }
                else {
                    return -1;
                }
            });

            response.send({
                tokenstatus: 'valid',
                data: {
                    campaigns: rows,
                    walletbalance: walletbalance
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else {
                console.error(err);
                response
                    .status(500)
                    .send({
                        error: 'Some error occurred at the server'
                    })
                    .end();
            }
        })

});

function getCampaigns(clientid, cmpstatus) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Campaign.cmid, Campaign.title, Campaign.description, Campaign.imagepath, Campaign.deactvtntime, ' +
            'Campaign.budget, Campaign.regdate, SUM(!ISNULL(Share.shareid) && (Share.checkstatus = ?)) AS sharescount ' +
            'FROM Campaign ' +
            'LEFT JOIN Share ' +
            'ON Campaign.cmid = Share.cmid ' +
            'WHERE Campaign.clientid = ? ' +
            'AND Campaign.cmpstatus = ? ' +
            'GROUP BY Campaign.cmid ', ['COMPLETE', clientid, cmpstatus], function (err, rows) {

            if (err) {
                reject(err);
            }
            else {

                rows.map(function (element) {
                    element.budget = parseFloat(element.budget).toFixed(2);
                    return element;
                });

                resolve(rows);
            }

        })
    });
}

function getClientWalletBal(clientid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT walletbalance FROM Client WHERE clientid = ?', [clientid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {
                resolve(row[0].walletbalance);
            }
        })
    })
}

router.post('/add', function (request, response) {

    var title = request.body.title;
    var description = request.body.description;
    var budget = 0;//request.body.budget;
    var type = "Web";//request.body.type;
    var cmpstatus = 'ACTIVE';   //Default status
    var imagepath = request.body.imagepath;
    var contentbaseurl = request.body.contentbaseurl;
    var cmid = uuidGenerator.v4();
    var entityid = uuidGenerator.v4();
    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var mission = request.body.mission;
    
    console.log("request is " + JSON.stringify(request.body, null, 3));

    var sqlparams = {
        cmid: cmid,
        clientid: clientid,
        entityid: entityid,
        title: title,
        description: description,
        budget: budget,
        type: type,
        cmpstatus: cmpstatus,
        imagepath: imagepath,
        mission: mission,
        contentbaseurl: contentbaseurl
    };

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return campaign_utils.addCampaign(sqlparams);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            }).end();
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

/*function addCampaign(params) {
    return new Promise(function (resolve, reject) {
        connection.query('INSERT INTO Campaign SET ?', params, function (err, result) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    })
}*/

router.post('/specific', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return getCampaign(cmid);
        }, function () {

            response.send({
                tokenstatus: 'invalid'
            });
            response.end();

            throw new BreakPromiseChainError();
        })
        .then(function (campaign) {
            response.send({
                tokenstatus: 'valid',
                data: campaign
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {

            if (err instanceof BreakPromiseChainError) {
                console.log('Broke out of a promise chain');
            }
            else {
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

function getCampaign(cmid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT * FROM Campaign WHERE cmid = ?', [cmid], function (err, row) {

            if (err) {
                reject(err);
            }
            else {
                resolve(row[0]);
            }

        })
    })
}

router.post('/edit', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var description = request.body.description;
    var budget = 0;//request.body.budget;
    var mission = request.body.mission;
    var imagepath = request.body.imagepath;
    var cmid = request.body.cmid;

    var sqlparams = {
        description: description,
        budget: budget,
        imagepath: imagepath,
        mission: mission
    };

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return campaign_utils.updateCampaign(cmid, sqlparams);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            }).end();
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

/*function updateCampaign(cmid, params){
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Campaign SET ? WHERE cmid = ?', [params, cmid], function (err, result) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}*/

router.post('/deactivate', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var cmid = request.body.cmid;

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return deactivateCampaign(cmid);
        }, function (datasize) {
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
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                response.status(500).send({
                    error: 'Some error occurred at the server'
                });
                response.end();
            }
        });

});

/**
 * Function to change the 'cmpstatus' of the Campaign to 'DEACTIVE'
 * */
function deactivateCampaign(cmid) {

    var deactvtntime = new Date().toISOString();

    return new Promise(function (resolve, reject) {

        connection.query('UPDATE Campaign SET cmpstatus = ?, deactvtntime = ? ' +
            'WHERE cmid = ?', ['DEACTIVE', deactvtntime, cmid], function (err, row) {

            if (err) {
                reject(err);
            }
            else {
                resolve();
            }

        });

    })

}

module.exports = router;
