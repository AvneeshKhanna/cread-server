/*This file is used to update the new contact number of the user when he/she changes it from his profile*/
var express = require('express');
var app = express();
var router = express.Router();
var mysql = require('mysql');
var AWS = require('aws-sdk');

var _auth = require('../Authentication');
var appconfig = require('../Config');
var _connection = appconfig.createConnection;

AWS.config.region = 'ap-northeast-1'; 
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
}); 

var docClient = new AWS.DynamoDB.DocumentClient();

var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');

router.post('/', function(request, response){
    
    var uuid = request.body.uuid;
    var newcontact = request.body.newcontact;
    
    //Retrieve password of the user to create new Auth_Key
    _connection.query('SELECT password FROM users WHERE UUID = ?', [uuid], function(err, data){
        
        if(err){
            throw err;
        }
        
        console.log('data from "SELECT password" query is ' + JSON.stringify(data, null, 3));
        
        var key = newcontact + data[0].password;
        var auth_token = _auth.getToken(key);
        
        //Update the new contact number and Auth_Key of the user
        _connection.query('UPDATE users SET phoneNo = ?, Auth_Key = ? WHERE UUID = ?', [newcontact, auth_token, uuid], function(err, data){
            
            if(err){
                throw err;
            }
            
            var params = {
                TableName : userstbl_ddb,
                Key: { 
                    UUID : uuid 
                },
                UpdateExpression: 'set #key = :val',
                ExpressionAttributeNames: {'#key' : 'ContactNumber'},
                ExpressionAttributeValues: {
                    ':val' : newcontact
                }
            };
            
            //Save the new contact number of the user to dynamoDB as well and send server response
            docClient.update(params, function(err, data){
               
                if(err){
                    throw err;
                }
                
                var responseObj = {
                    authtoken : auth_token
                }
                
                response.send(responseObj);
                response.end();                
                
            });
            
        });
        
    });    
    
});

module.exports = router;