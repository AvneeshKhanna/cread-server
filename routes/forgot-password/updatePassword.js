var express = require('express');
var app = express();
var router = express.Router();
var mysql = require('mysql');
var AWS = require('aws-sdk');

var _auth = require('../Authentication');

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
    console.log(JSON.stringify(request.body));
    var phoneNo = request.body.contactnumber;
    var uuid = request.body.uuid;
    var password = request.body.newPassword;
    var key = password+phoneNo;
    var Id = _auth.getToken(key);
    
    console.log(JSON.stringify(request.body, null, 3));
    
    connection.query('UPDATE users SET password = ? , Auth_key = ? WHERE UUID = ?', [password , Id , uuid], function(err, data){
        if (err){
            throw err;
        }
        else{
            response.send();
            response.end();
            
        }
    });
    
});

module.exports = router;