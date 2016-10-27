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

router.post('/' , function(req,res){
    var testIds = new Array();
    testIds.push('43d865a5-f7b7-4c27-84b1-367203744226');
    testIds.push('11271509-244b-4fac-86a3-a19e5933823a');
    testIds.push('11271509-244b-4fac-86a3-a19e5933823e');
    
    var data = {Category: "Payments" , Status: "Approved" , Referred: "Avneesh Khanna" , Incentive: "500"}
    
    sendNotification(testIds , data , function(){
        res.end('done');
    });
});

function getfcmTokens(userIds , callback){
    var serveruuids = new Array();
    var serverfcmTokens = new Array();
    
    var table = 'User_Profile';
    
    var params = {
        TableName : table,
        AttributesToGet : ['Fcm_token' , 'UUID']
    };
    
    docClient.scan(params, function(err, data) {
        if (err) throw err;
        
        for(var y in data.Items){
            serveruuids.push(data.Items[y].UUID);
            serverfcmTokens.push(data.Items[y].Fcm_token);
        }
        
        var mappingResult = usersMapping(userIds , serveruuids , serverfcmTokens);
        
        console.log(mappingResult);
        
        callback(mappingResult);
    }); 
}

function usersMapping(usersuuid , serveruuids , serverFcmtokens){
    var fcmTokens = new Array();
    
    for(var i=0 ; i<usersuuid.length ; i++){
        if(serveruuids.indexOf(usersuuid[i]) !== -1){
            var fcmIndex = serveruuids.indexOf(usersuuid[i]);
            for(var j=0 ; j<serverFcmtokens[fcmIndex].length ; j++){
                fcmTokens.push(serverFcmtokens[fcmIndex][j]);
            }
        }
    }
    
    return fcmTokens;
}

function sendNotification(users , notificationData , callback){
    
    if(users.length == 0){
        callback();
    }
    else{
        getfcmTokens(users , function(registrationTokens){
            var message = new gcm.Message();
            var message = new gcm.Message({
                data : notificationData
            });

            var sender = new gcm.Sender('AIzaSyDUbtCYGKI-kLl7oSVQoW_sZqo2VZBFeKQ');

            sender.send(message, { registrationTokens : registrationTokens }, 3 , function (err, response) {
                if(err){
                    console.log(err);
                }

                console.log(response);
                callback();
            }); 
        });
    }
}

module.exports = router;
module.exports.Notification = sendNotification;
