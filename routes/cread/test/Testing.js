/**
 * Created by avnee on 26-06-2017.
 */

var express = require('express');
var router = express.Router();

var moment = require('moment');

var config = require('../../Config');
var connection = config.createConnection;

var AWS = config.AWS;

router.post('/lock', function (request, response) {

    var shareid = request.body.shareid;

    connection.query('UPDATE Share SET locked = ?, locked_at = NOW() WHERE shareid = ?', [true, shareid], function (err, rows) {

        if (err) {
            console.error(err);
            throw err;
        }
        else {
            response.send('Locked');
            response.end();
        }

    })

});

router.post('/unlock', function (request, response) {

    var shareid = request.body.shareid;

    connection.query('UPDATE Share SET locked = ?, locked_at = ? WHERE shareid = ?', [false, null, shareid], function (err, rows) {

        if (err) {
            console.error(err);
            throw err;
        }
        else {
            response.send('Unlocked');
            response.end();
        }

    })

});

router.post('/user-details', function (request, response) {

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

router.post('/err', function (req, res) {

    connection.query('SELECCT * FROM Share WHERE shareid = ?', ["abc"], function (err, data) {

        if(err){
            console.error(err);
            throw err;
        }

        res.send(data);
        res.end();
    });

});

router.post('/send-email', function (request, response) {

    var ses = new AWS.SES();

    var params = {
        Destination: {
            ToAddresses: [
                "chandna.prakhar@gmail.com"
            ]
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: "This message body contains HTML formatting. It can, for example, contain links like this one: <a class=\"ulink\" href=\"http://docs.aws.amazon.com/ses/latest/DeveloperGuide\" target=\"_blank\">Amazon SES Developer Guide</a>."
                },
                Text: {
                    Charset: "UTF-8",
                    Data: "This is the message body in text format."
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: "Test email"
            }
        },
        Source: "sender@example.com"
    };

    ses.sendEmail(params, function(err, data) {
        if (err) {  // an error occurred
            console.error(err, err.stack);
            throw err;
        }
        else {  // successful response
            console.log(data);
            response.send(data);
        }


        /*
         data = {
         MessageId: "EXAMPLE78603177f-7a5433e7-8edb-42ae-af10-f0181f34d6ee-000000"
         }
         */
    });

})

module.exports = router;

