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

var AWS = config.AWS;
var uuidGenerator = require('uuid');

router.post('/load', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var cmpstatus = request.body.cmpstatus; //ACTIVE or DEACTIVE

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return getCampaigns(clientid, cmpstatus);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
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
                data: rows
            });
            response.end();
        })
        .catch(function (err) {
            console.error(err);
            response
                .status(500)
                .send({
                    error: 'Some error occurred at the server'
                })
                .end();
        })

});

function getCampaigns(clientid, cmpstatus) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Campaign.cmid, Campaign.title, Campaign.description, Campaign.imagepath, Campaign.deactvtntime, ' +
            'Campaign.budget, Campaign.regdate, SUM(!ISNULL(Share.shareid)) AS sharescount ' +
            'FROM Campaign ' +
            'LEFT JOIN Share ' +
            'ON Campaign.cmid = Share.cmid ' +
            'WHERE Campaign.clientid = ? ' +
            'AND Campaign.cmpstatus = ? ' +
            'GROUP BY Campaign.cmid ', [clientid, cmpstatus], function (err, rows) {

            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }

        })
    });
}

router.post('/add', function (request, response) {

    var title = request.body.title;
    var description = request.body.description;
    var budget = request.body.budget;
    var type = request.body.type;
    var cmpstatus = 'UNVERIFIED';
    var imagepath = request.body.imagepath;
    var contentbaseurl = request.body.contentbaseurl;
    var cmid = uuidGenerator.v4();
    var clientid = request.body.clientid;
    var authkey = request.body.authkey;

    var sqlparams = {
        cmid: cmid,
        clientid: clientid,
        title: title,
        description: description,
        budget: budget,
        type: type,
        cmpstatus: cmpstatus,
        imagepath: imagepath,
        contentbaseurl: contentbaseurl
    };

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            connection.query('INSERT INTO Campaign SET ?', sqlparams, function (err, result) {

                if (err) {
                    throw err;
                }

                response.send({
                    tokenstatus: 'valid',
                    data: {
                        status: 'done'
                    }
                });
                response.end();

            });
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            }).end();
        })
        .catch(function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Some error occurred at the server'
            }).end();
        });

});

router.post('/edit', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;
    var description = request.body.description;
    var budget = request.body.budget;
    var imagepath = request.body.imagepath;
    var cmid = request.body.cmid;

    var sqlparams = {
        description: description,
        budget: budget,
        imagepath: imagepath
    };

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {

            connection.query('UPDATE Campaign SET ? WHERE cmid = ?', [sqlparams, cmid], function (err, result) {

                if (err) {
                    throw err;
                }

                response.send({
                    tokenstatus: 'valid',
                    data: {
                        status: 'done'
                    }
                });
                response.end();

            });

        }, function () {
            response.send({
                tokenstatus: 'invalid'
            }).end();
        })
        .catch(function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Some error occurred at the server'
            })
        })

});

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
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();
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
                console.error(err);
                throw err;
            }
            else {
                resolve();
            }

        });

    })

}

module.exports = router;
