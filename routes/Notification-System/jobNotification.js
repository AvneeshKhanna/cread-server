//This module only used to sedn notification to all users whena a new job is added.

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

router.post('/' , function(request,response){
    var category = request.body.category;
    var message = request.body.message;
    
    var data = {Category : category , Message : message};
    jobNotification(data , function(){
        response.send(true);
        response.end(); 
    });
});

function getTokens(callback){
    var table = 'User_Profile';
    
    var params = {
        TableName : table,
        AttributesToGet : ['Fcm_token']
    };
    
    docClient.scan(params , function(error , data){
        if(error) throw error;
        
        var fcmTokens = pushTokens(data.Items);
        
        callback(fcmTokens);
    });
}

function pushTokens(tokens){
    var finalTokens = [];
    
    for(var j=0 ; j<tokens.length ; j++){
        for(var z=0 ; z<tokens[j].Fcm_token.length ; z++){
            finalTokens.push(tokens[j].Fcm_token[z]);
        }
    }
    
    return finalTokens;
}

function jobNotification(jobData , callback){
    getTokens(function(registrationTokens){
        if(registrationTokens.length == 0){
            callback();
        }
        else{
            var message = new gcm.Message();
            var message = new gcm.Message({
                data : jobData
            });

            var sender = new gcm.Sender('AIzaSyDUbtCYGKI-kLl7oSVQoW_sZqo2VZBFeKQ');

            sender.send(message, { registrationTokens : registrationTokens }, 3 , function (err, response) {
                if(err) throw err;

                console.log(response);
                callback();
            }); 
        }
    });
}

module.exports = router;