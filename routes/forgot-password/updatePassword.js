var express = require('express');
var app = express();
var router = express.Router();

var mysql = require('mysql');

var AWS = require('aws-sdk');

var connection = mysql.createConnection({
    host : 'testrdsinstance.cfjbzkm4dzzx.ap-northeast-1.rds.amazonaws.com',
    user : 'ttrds',
    password : 'amazonpass2015',
    database : 'testdb',
    port : '3306'
});

AWS.config.region = 'ap-northeast-1'; 
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

router.post('/', function(request, response){
    
    var uuid = request.body.uuid;
    var password = request.body.newPassword;
    
    console.log(JSON.stringify(request.body, null, 3));
    
    connection.query('UPDATE users SET password = ? WHERE UUID = ?', [password, uuid], function(err, data){
        if (err){
            throw err;
        }
        else{
            
            //TODO Add data to dynamoDB
            
            /*var params = {
                TableName : 'User_Profile'
            };
            params.Key = {
                UUID : request.body.userid
            };
            
            docClient.updateItem()*/
            
            response.send();
            response.end();
            
        }
    });
    
});

module.exports = router;