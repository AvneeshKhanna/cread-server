/*
This script will be called when a new job is added from the dashboard AND if an existing job is edited on the dashboard.
*/
var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var AWS = require('aws-sdk');
var uuidGenerator = require('uuid');

var appconfig = require('../Config');

var _connection = appconfig.createConnection;

var jobSchema = require('../Schema');

AWS.config.region = 'ap-northeast-1'; 
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
}); 

var docClient = new AWS.DynamoDB.DocumentClient();

var envconfig = require('config');
var jobstbl_ddb = envconfig.get('dynamoDB.jobs_table');

/*app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//config.dynamodbCredentials();

var s3bucketheader = "testamentbucket.s3-ap-northeast-1.amazonaws.com";

var imagefilename = "job-logo.png";

var urlprotocol = 'https://';*/

router.post('/',function(request, response, next){
    
    var JUUID = request.body.JUUID;
    console.log('Request object is ' + JSON.stringify(request.body, null, 3));
    
    _connection.query('UPDATE jobs SET Active = ? WHERE JUUID = ?', [false, JUUID], function(err, rows){
       
        if(err){
            throw err;
        }
        else{
            
            var params = {
                  TableName: jobstbl_ddb,
                  Key: { 
                    'JUUID' : JUUID 
                  },
                  UpdateExpression: 'set #_active = :val',
                  ExpressionAttributeNames: {'#_active' : 'Active'},
                  ExpressionAttributeValues: {
                    ':val' : false
                  }
            };
            
            docClient.update(params, function(err, data) {
               if (err){
                   throw err;
               }
               else{
                   response.send(true);
                   response.end();
               }
            });
            
        }
        
    });
    
});

module.exports = router;