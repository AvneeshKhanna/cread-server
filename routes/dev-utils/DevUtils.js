/**
 * Created by avnee on 16-07-2017.
 */

/**
 * File which contains functions to perform back-end related tasks which don't have a direct implication on the product
 * */

var express = require('express');
var router = express.Router();

var config = require('../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var request_client = require('request');

var hrkuapptoken = '11abc5c3-dd3f-4d62-86df-9061a4c32e2d';
var hrkuappname = 'cread-dev-remote';

router.post('/restart-heroku', function (request, response) {

    request_client.delete({
        url: 'https://api.heroku.com/apps/' + hrkuappname + '/dynos/',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.heroku+json; version=3',
            'Authorization': 'Bearer ' + hrkuapptoken
        }
    }, function (err, res, body) {

        if(err){
            throw err;
        }
        else {
            response.send('Heroku server restarted successfully');
        }

    });

});

module.exports = router;