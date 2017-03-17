var express = require('express');
var app = express();
var router = express.Router();
var mysql = require('mysql');
var AWS = require('aws-sdk');

AWS.config.region = 'ap-northeast-1'; 
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

var envconfig = require('config');
var jobstbl_ddb = envconfig.get('dynamoDB.jobs_table');

router.post('/', function(request, response){
    
    console.log(JSON.stringify(request.body.id));
    
    var params = {
        TableName : jobstbl_ddb
    };
    params.Key = {
        JUUID : request.body.id
    };
    
    docClient.get(params, function(err, data) {
        if (err) throw err;
        
        console.log(JSON.stringify(data, null, 3));
        response.send(data);
        response.end();
    });
});

module.exports = router;