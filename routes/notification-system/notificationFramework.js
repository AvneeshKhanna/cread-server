// This module is used to send notification to users for referrals, application, payment System.

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var dynamo_marshal = require('dynamodb-marshaler');    //package to convert plain JS/JSON objects to DynamoDB JSON
var AWS = require('aws-sdk');
var gcm = require('node-gcm');

AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff'
});

var docClient = new AWS.DynamoDB.DocumentClient();

var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');

var config = require('../Config');

function getfcmTokens(userIds, callback) {
    var serverfcmTokens = new Array();
    var counter = 0;

    var recursive;
    (recursive = function(counter){
        if(counter < userIds.length){
            getUserTokensFromServer(userIds[counter], function (err, tokens) {
                if(err){
                    callback(err);
                }
                else{
                    counter++;
                    serverfcmTokens = serverfcmTokens.concat(tokens);
                    recursive(counter);
                }
            });
        }
        else{
            callback(null, serverfcmTokens);
        }
    })(counter);
}

function getUserTokensFromServer(uuid, callback){

    var params = {
        TableName: userstbl_ddb,
        Key: {
            UUID: uuid
        },
        AttributesToGet: ['Fcm_token', 'UUID']
    };

    docClient.get(params, function (err, data) {
        if(err){
            callback(err, null);
        }
        else{
            callback(null, data.Item.Fcm_token);
        }
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
        getfcmTokens(users, function (err, registrationTokens) {
            if(err){
                callback(err);
            }
            else{

                var message = new gcm.Message({
                    data: notificationData
                });

                var sender = new gcm.Sender(config['fcm-server-key']);

                sender.send(message, {registrationTokens: registrationTokens}, 3, function (err, response) {
                    if (err) {
                        callback(err);
                    }
                    else{
                        console.log(response);
                        callback();
                    }
                });
            }
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

//module.exports = router;
module.exports.notification = sendNotification;
module.exports.notificationPromise = notificationPromise;
