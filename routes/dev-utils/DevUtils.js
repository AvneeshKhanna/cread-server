/**
 * Created by avnee on 16-07-2017.
 */

/**
 * File which contains functions to perform back-end related tasks which don't have a direct implication on the product
 * */

var express = require('express');
var router = express.Router();

var config = require('../Config');

var request_client = require('request');

var hrkuapptoken = '11abc5c3-dd3f-4d62-86df-9061a4c32e2d';
var hrkuappname = 'cread-dev-remote';

var notify = require('../notification-system/notificationFramework');

router.get('/restart-heroku', function (request, response) {

    request_client.delete({
        url: 'https://api.heroku.com/apps/' + hrkuappname + '/dynos/',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.heroku+json; version=3',
            'Authorization': 'Bearer ' + hrkuapptoken
        }
    }, function (err, res, body) {

        if(err){
            response.status(500).send(err).end();
        }
        else {
            response.send('Heroku server restarted successfully').end();
        }

    });

});

/**
 * Created to test sending of notification to particular device tokens in development environment
 * */
router.post('/send-notification', function (request, response) {

    var fcmtokens = request.body.fcmtokens;
    var payload = request.body.payload;

    if(config.envtype === 'DEVELOPMENT'){
        if(!(payload instanceof Object)){
            response.status(500).send({
                message: "Parameter payload should be of the type Object/Map"
            });
            response.end();
            return;
        }
        else if(!(fcmtokens instanceof Array)){
            response.status(500).send({
                message: "Parameter fcmtokens should be of the type Array/List"
            });
            response.end();
            return;
        }
        else if(fcmtokens.length === 0){
            response.status(500).send({
                message: "Parameter fcmtokens cannot be empty"
            });
            response.end();
            return;
        }
        else{

            notify.notifyTokens(fcmtokens, payload, function (err) {
                if(err){
                    response.status(500).send(err);
                    response.end();
                }
                else{
                    response.status(200).send({
                        message: "Notification sent"
                    });
                    response.end();
                }
            });

        }
    }
    else{
        response.status(403).send({
            message: "You are not authorised to perform this task"
        });
        response.end();
    }

});

module.exports = router;