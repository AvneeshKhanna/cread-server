/**
 * Created by avnee on 27-07-2017.
 */

/*
* Module to send a notification to all users using dashboard
* */

var express = require('express');
var app = express();
var router = express.Router();

var notifyUsers = require('./NotificationUtils');

router.post('/', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    // var cmid = request.body.cmid;   //Can be NULL
    // var app_model = request.body.app_model; // "1.0" or "2.0"
    var persistable = request.body.persistable;     //"Yes" or "No"
    var category = request.body.category;
    var message = request.body.message;

    var cities = request.body.cities;

    var data = {
        category: category,
        message: message,
        // AppModel: app_model,
        persistable: persistable
    };

    notifyUsers.sendNotification(data, cities, function (err) {
        if(err){
            throw err;
        }
        else {
            response.send(true);
            response.end();
        }
    });

});

module.exports = router;