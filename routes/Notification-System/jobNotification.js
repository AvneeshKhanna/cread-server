/*This module only used to send notifications to all users using the dashboard notification panel. It contains the router(); function to be called by the client/dashboard*/

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

var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');

var docClient = new AWS.DynamoDB.DocumentClient();

router.post('/' , function(request,response){
    console.log(request.body);
    
    var category = request.body.category;
    var message = request.body.message;
    
    var cities = request.body.cities;
    
    var data = {Category : category , Message : message};
    jobNotification(data, cities, function(){
        response.send(true);
        response.end(); 
    });
});

/*Function to get the FCM Tokens of all the users from the DynamoDB table. An optional city filter is also catered*/
function getTokens(cities, callback){
    var table = userstbl_ddb;
    
    var params = {
        TableName : table,
        AttributesToGet : ['Fcm_token']
    };
    
    if(cities != undefined){
        
        params.ScanFilter = {
            City: {
              ComparisonOperator: 'IN', /* required */
              AttributeValueList: cities
            }
        }
    }
    
    console.log(JSON.stringify(params, null, 3));
    
    docClient.scan(params , function(error , data){
        if(error) throw error;
        
        var fcmTokens = pushTokens(data.Items);
        
        callback(fcmTokens);
    });
}

/*Function to formulate an array of FCM Tokens as received using getTokens(cities, callback) function*/
function pushTokens(tokens){
    var finalTokens = [];
    
    for(var j=0 ; j<tokens.length ; j++){
        for(var z=0 ; z<tokens[j].Fcm_token.length ; z++){
            finalTokens.push(tokens[j].Fcm_token[z]);
        }
    }
    
    return finalTokens;
}

/*Function to call the AWS SNS API to send push notifications to users using FCM Tokens*/
function jobNotification(jobData, cities, callback){
    getTokens(cities, function(registrationTokens){
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