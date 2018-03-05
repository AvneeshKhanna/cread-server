// This module is used to send notification to users for referrals, application, payment System.

var AWS = require('aws-sdk');
var gcm = require('node-gcm');

AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff'
});

var docClient = new AWS.DynamoDB.DocumentClient();

var envconfig = require('config');
var request_client = require('request');
var async = require('async');
var buckets = require('buckets-js');

var userstbl_ddb = envconfig.get('dynamoDB.users_table');

var config = require('../Config');

const iosValidCategories = [
    "general",
    "follow",
    "hatsoff",
    "comment",
    "collaborate"
];

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

function sendNotification(users, notificationData, mastercallback) {

    if (!(users instanceof Array)) {
        mastercallback(new Error('Parameter "users" should be an array'));
        return;
    }

    if (users.length === 0) {
        mastercallback();
    }
    else {
        getfcmTokens(users, function (err, registrationTokens) {

            if(err){
                mastercallback(err);
            }
            else {
                sendPlatformSpecificMessage(registrationTokens, notificationData, function (err) {
                    if(err){
                        mastercallback(err);
                    }
                    else{
                        mastercallback();
                    }
                });
            }

        });
    }
}

function sendPlatformSpecificMessage(registrationTokens, notificationData, mastercallback){

    var androidTokens = [];
    var iOSTokens = [];

    var androidMessage = new gcm.Message({
        data: notificationData
    });

    var iosMessage = new gcm.Message({
        data: notificationData,
        notification: {
            title: "Cread",
            body: notificationData.message
        }
    });

    async.eachOfSeries(registrationTokens, function (regtoken, index, callback) {

        getTokenPlatform(regtoken, function (err, platform) {

            if(err){
                callback(err);
            }
            else{
                console.log('platform is ' + platform);

                //Formulating notification message according to device platform
                if(platform === 'IOS' && iosValidCategories.includes(notificationData['category'])){

                    iOSTokens.push(regtoken);
                }
                else if(platform === 'ANDROID'){

                    androidTokens.push(regtoken);
                }
                else{
                    //Case when token is invalid (platform is undefined) OR platform is IOS with an invalid notification category
                }

                callback();
            }

        });

    }, function (err) {

        if(err){
            mastercallback(err);
        }
        else {

            sendFormulatedMessage(androidMessage, androidTokens, function (err) {
                if(err){
                    mastercallback(err);
                }
                else {
                    sendFormulatedMessage(iosMessage, iOSTokens, function (err) {
                        if(err){
                            mastercallback(err);
                        }
                        else {
                            console.log('mastercallback called');

                            console.log('registrationTokens.length is ' + registrationTokens.length);

                            mastercallback();
                        }
                    });
                }
            });
        }
    });
}

function sendFormulatedMessage(message, tokens, callback) {

    var sender = new gcm.Sender(config['fcm-server-key']);

    if(tokens.length > 0){
        sender.send(message, {registrationTokens: tokens}, 3, function (err, response) {
            if (err) {
                callback(err);
            }
            else{
                console.log(response);
                callback();
            }
        });
    }
    else{   //Case where tokens do not exist. Example a user is only on Android or iOS
        callback();
    }

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
}

//module.exports = router;
module.exports = {
    notification : sendNotification,
    notificationPromise : notificationPromise,
    notifyTokens : notifyTokens
};
