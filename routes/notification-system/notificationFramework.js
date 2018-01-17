// This module is used to send notification to users for referrals , application , payment System.

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var dynamo_marshal = require('dynamodb-marshaler');    //package to convert plain JS/JSON objects to DynamoDB JSON
var AWS = require('aws-sdk');
var gcm = require('node-gcm');

AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
});

var docClient = new AWS.DynamoDB.DocumentClient();

var envconfig = require('config');
var request_client = require('request');
var async = require('async');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');

var config = require('../Config');

/*router.post('/' , function(req,res){
    var testIds = new Array();
    testIds.push('43d865a5-f7b7-4c27-84b1-367203744226');
    testIds.push('11271509-244b-4fac-86a3-a19e5933823a');
    testIds.push('11271509-244b-4fac-86a3-a19e5933823e');
    
    var data = {Category: "Payments" , Status: "Approved" , Referred: "Avneesh Khanna" , Incentive: "500"}
    
    sendNotification(testIds , data , function(){
        res.end('done');
    });
});*/

function getfcmTokens(userIds, callback) {
    var serveruuids = new Array();
    var serverfcmTokens = new Array();

    var table = userstbl_ddb;

    var params = {
        TableName: table,
        AttributesToGet: ['Fcm_token', 'UUID']
    };

    docClient.scan(params, function (err, data) {
        if (err) throw err;

        for (var y in data.Items) {
            serveruuids.push(data.Items[y].UUID);
            serverfcmTokens.push(data.Items[y].Fcm_token);
        }

        var mappingResult = usersMapping(userIds, serveruuids, serverfcmTokens);
        console.log(mappingResult);
        callback(mappingResult);
    });
}

function usersMapping(usersuuid, serveruuids, serverFcmtokens) {
    var fcmTokens = new Array();

    for (var i = 0; i < usersuuid.length; i++) {
        if (serveruuids.indexOf(usersuuid[i]) !== -1) {
            var fcmIndex = serveruuids.indexOf(usersuuid[i]);
            for (var j = 0; j < serverFcmtokens[fcmIndex].length; j++) {
                fcmTokens.push(serverFcmtokens[fcmIndex][j]);
            }
        }
    }

    return fcmTokens;
}

//TODO: Optimise code for sending notifications by segregating Android and iOS tokens and sending two sets of notification to both platform tokens
function sendNotification(users, notificationData, mastercallback) {

    if (!(users instanceof Array)) {
        mastercallback(new Error('Parameter "users" should be an array'));
        return;
    }

    if (users.length === 0) {
        mastercallback();
    }
    else {
        getfcmTokens(users, function (registrationTokens) {

            sendPlatformSpecificMessage(registrationTokens, notificationData, function (err) {
                if(err){
                    mastercallback(err);
                }
                else{
                    mastercallback();
                }
            });

        });

        /*var message = new gcm.Message({
                data: notificationData
            });

            var sender = new gcm.Sender(config['fcm-server-key']);

            sender.send(message, {registrationTokens: registrationTokens}, 3, function (err, response) {
                if (err) {
                    callback(err);
                }

                console.log(response);
                callback();
            });*/
    }
}

function sendPlatformSpecificMessage(registrationTokens, notificationData, mastercallback){
    async.eachOfSeries(registrationTokens, function (regtoken, index, callback) {

        getTokenPlatform(regtoken, function (err, platform) {

            if(err){
                callback(err);
            }
            else{
                var message;
                console.log('platform is ' + platform);
                //Formulating notification message according to device platform
                if(platform === 'IOS'){
                    message = new gcm.Message({
                        data: notificationData,
                        notification: {
                            title: "Cread",
                            body: notificationData.message
                        }    //TODO
                    });
                }
                else if(platform === 'ANDROID'){
                    message = new gcm.Message({
                        data: notificationData
                    });
                }
                else{   //Case when token is invalid (platform is undefined)
                    if(index === (registrationTokens.length - 1)){
                        console.log('mastercallback called');
                        mastercallback();
                    }
                    else {
                        callback();
                    }
                    return;
                }

                sendFormulatedMessage(message, regtoken, function (err) {
                    if(err){
                        callback(err);
                    }

                    console.log('registrationTokens.length is ' + registrationTokens.length);

                    if(index === (registrationTokens.length - 1)){
                        console.log('mastercallback called');
                        mastercallback();
                    }
                    else {
                        callback();
                    }

                });
            }

        });

    }, function (err) {
        if(err){
            console.error(err);
        }
    });
}

function sendFormulatedMessage(message, token, callback) {
    var sender = new gcm.Sender(config['fcm-server-key']);

    sender.send(message, {registrationTokens: [token]}, 3, function (err, response) {
        if (err) {
            callback(err);
        }
        else{
            console.log(response);
            callback();
        }
    });
}

function getTokenPlatform(token, callback){

    var options = {
        url: "https://iid.googleapis.com/iid/info/" + token,
        headers: {
            'Authorization': 'key=' + config['fcm-server-key']
        }
    };

    request_client.get(options, function (err, res, body) {
        if(err){
            callback(err, null);
        }
        else{
            console.log('body is ' + body);
            var result = JSON.parse(body);
            callback(null, result.platform);
        }
    });
}

function notificationPromise(users, notificationData) {
    return new Promise(function (resolve, reject) {
        sendNotification(users, notificationData, function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function notifyTokens(tokens, payload, mastercallback) {

    sendPlatformSpecificMessage(tokens, payload, function (err) {
        if(err){
            mastercallback(err);
        }
        else{
            mastercallback();
        }
    });
    /*
    var message = new gcm.Message({
        data: payload
    });

    var sender = new gcm.Sender(config['fcm-server-key']);

    sender.send(message, {registrationTokens: tokens}, 3, function (err, response) {
        if (err) {
            callback(err);
        }

        console.log(response);
        callback();
    });*/
}

//module.exports = router;
module.exports.notification = sendNotification;
module.exports.notificationPromise = notificationPromise;
module.exports.notifyTokens = notifyTokens;
