/**
 * Created by avnee on 02-07-2017.
 */

/**
* It is used to register unique visits on a webpage based on user-agent string, public IP and private IP
* */

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;

router.post('/facebook/', function (request, response) {

    console.log("Request headers are " + JSON.stringify(request.headers, null, 3));
    console.log("Request body is " + JSON.stringify(request.body, null, 3));

    var params = {
        ua_string: request.header('user-agent'),
        public_ip: request.header('x-forwarded-for'),
        private_ip: request.body.private_ip_addr,
        hostemail: request.body.id
    };

    console.log("Params are " + JSON.stringify(params, null, 3));

    connection.query('INSERT INTO FbReach SET ?', params, function (err, rows) {
        if(err){
            throw err;
        }
        else {
            response.send('Thank you for visiting');
            response.end();
        }
    });

});

module.exports = router;