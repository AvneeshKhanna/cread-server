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
var _auth = require('../../../authtokenValidation');

var AWS = config.AWS;
var uuidGenerator = require('uuid');

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

    connection.query('INSERT INTO Campaign SET ?', sqlparams, function (err, result) {

        if(err){
            console.error(err);
            throw err;
        }

        response.send('Done');
        response.end();

    });

});

router.post('/edit', function (request, response) {

    var description = request.body.description;
    var budget = request.body.budget;
    var imagepath = request.body.imagepath;
    var cmid = request.body.cmid;

    var sqlparams = {
        description: description,
        budget: budget,
        imagepath: imagepath
    };

    connection.query('UPDATE Campaign SET ? WHERE cmid = ?', [sqlparams, cmid], function (err, result) {

        if(err){
            console.error(err);
            throw err;
        }

        response.send('Done');
        response.end();

    });

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
                tokenstatus: 'valid'
            });
            response.end();
        });

});

/**
 * Function to change the 'cmpstatus' of the Campaign to 'DEACTIVE'
 * */
function deactivateCampaign(cmid){

    return new Promise(function (resolve, reject) {

        connection.query('UPDATE Campaign SET cmpstatus = ? WHERE cmid = ?', ['DEACTIVE', cmid],function (err, row) {

            if(err){
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
