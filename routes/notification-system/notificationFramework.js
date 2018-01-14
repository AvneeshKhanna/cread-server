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

function sendNotification(users, notificationData, callback) {

    if (!(users instanceof Array)) {
        callback(new Error('Parameter "users" should be an array'));
        return;
    }

    if (users.length === 0) {
        callback();
    }
    else {
        getfcmTokens(users, function (registrationTokens) {
            var message = new gcm.Message({
                data: notificationData
            });

            var sender = new gcm.Sender(config['fcm-server-key']);

            sender.send(message, {registrationTokens: registrationTokens}, 3, function (err, response) {
                if (err) {
                    callback(err);
                }

                console.log(response);
                callback();
            });
        });
    }
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

function notifyTokens(tokens, payload, callback) {
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
    });
}

//module.exports = router;
module.exports.notification = sendNotification;
module.exports.notificationPromise = notificationPromise;
module.exports.notifyTokens = notifyTokens;
