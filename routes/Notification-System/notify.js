var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var AWS = require('aws-sdk');
var dynamo_marshal = require('dynamodb-marshaler');    //package to convert plain JS/JSON objects to DynamoDB JSON

var config = require('../Config');
var _connection = config.createConnection;
//var bankdetailsArray = new Array();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
}); 

var docClient = new AWS.DynamoDB.DocumentClient();

var registerFCM = function(uuid , fcmToken , localJson , name , emailid , contactnumber , response){
    console.log(uuid);
    var table = 'User_Profile';
    var params = {
        TableName: table,
        Item:{
            'UUID' : uuid,
            'ContactNumber' : contactnumber,
            'Email_Id' : emailid,
            'Name' : name,
            'Fcm_token' : [fcmToken]
        }
    };
    
    docClient.put(params,function(err, data){
        if (err) throw err;
        
        console.log(data);
        response.send(JSON.stringify(localJson));
        response.end();
    });
}

var loginFCM = function(uuid , fcmToken , localJson , response){
    console.log(uuid);
    var table = 'User_Profile';
    var addParams = {
        TableName : table,
        Key : {
            UUID : uuid
        },
        AttributeUpdates : {
            Fcm_token : {
                Action : 'ADD', 
                Value : [fcmToken]
            }
        }
    };
    
    var getParams = {
        TableName : table,
        Key : {
            UUID : uuid
        },
        AttributesToGet : ['Fcm_token']
    } 
    
    docClient.get(getParams,function(error,data){
        if (error) throw error;
        
        else if(data.Item.Fcm_token.indexOf(fcmToken) !== -1){
            response.send(JSON.stringify(localJson));
            response.end();
        }
        else{
            docClient.update(addParams, function(error, data) {
                if (error) throw error;

                console.log(data);
                response.send(JSON.stringify(localJson));
                response.end();
            });
        }
    });
}

module.exports.registerFCM = registerFCM;
module.exports.loginFCM = loginFCM;

