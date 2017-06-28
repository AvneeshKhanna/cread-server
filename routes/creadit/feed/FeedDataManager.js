/**
 * Created by avnee on 07-06-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var _auth = require('../../authtokenValidation');

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

            connection.query('SELECT * FROM Campaign WHERE cmpstatus = ? AND budget > 0 ORDER BY regdate DESC', ['ACTIVE'], function (err, result) {

                if(err){
                    console.error(err);
                    throw err;
                }

                resdata.tokenstatus = 'valid';
                resdata.data = result;

                response.send(resdata);
                response.end();

            });
        }
    });

});

module.exports = router;