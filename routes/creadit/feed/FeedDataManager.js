/**
 * Created by avnee on 07-06-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var _auth = require('../../auth-token-management/AuthTokenManager');

router.post('/load/', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;

    console.log("authkey is " + JSON.stringify(authkey, null, 3));

    var resdata = {};

    _auth.checkToken(uuid, authkey, function (err, datasize) {

        if(err){
            console.error(err);
            throw err;
        }
        else if(datasize == 0) {

            resdata.tokenstatus = 'invalid';
            response.send(resdata);
            response.end();

        }
        else{

            connection.query('SELECT * FROM Campaign WHERE cmpstatus = ? AND budget > 0 ORDER BY regdate DESC', ['ACTIVE'], function (err, rows) {

                if(err){
                    console.error(err);
                    throw err;
                }

                //TODO: Make the below parameters dynamic
                for (var i = 0; i < rows.length; i++) {
                    rows[i].sharerate = 30;
                    rows[i].clientbio = "Just some random bio for testing";
                    rows[i].sharescount = 10;
                    rows[i].clientname = "The Testament";
                }

                rows[1].sharescount = 0;

                console.log("rows from query are " + JSON.stringify(rows, null, 3));

                resdata.tokenstatus = 'valid';
                resdata.data = rows;

                response.send(resdata);
                response.end();

            });
        }
    });

});

module.exports = router;