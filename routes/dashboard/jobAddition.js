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

var config = require('../Config');

var _connection = config.createConnection;

var jobSchema = require('../Schema');

AWS.config.region = 'ap-northeast-1'; 
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
}); 

var docClient = new AWS.DynamoDB.DocumentClient();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//config.dynamodbCredentials();

var s3bucketheader = "testamentbucket.s3-ap-northeast-1.amazonaws.com";

var imagefilename = "job-logo.png";

var urlprotocol = 'https://';

router.post('/',function(request, response, next){
    var JobTitle = request.body.JobTitle;
    var CompanyName = request.body.CompanyName;
    var Location = request.body.Location;
    var Payscale = request.body.Payscale;
    var Duration = request.body.Duration;
    var Skills = request.body.Skills;
    var Description = request.body.Description;
    var imgStatus = request.body.imagestatus;
    var RefAmount = request.body.RefAmount;
    var Domain = request.body.Domain;
    var jobProcess ='';
    
    console.log('Request object is ' + JSON.stringify(request.body, null, 3));
    
    if(request.body.JUUID){
        var juuid = request.body.JUUID;
        jobProcess = 'EDIT';
    }
    else{
        var juuid = uuidGenerator.v4();
        jobProcess = 'ADD';
    }        
    
    var ImagePath = {};
    
    if(imgStatus == "NO_CHANGE"){
        ImagePath = urlprotocol + s3bucketheader + '/Jobs/' + juuid + '/' + imagefilename;        
    }
    else if(imgStatus == "CHANGE"){
        ImagePath = urlprotocol + s3bucketheader + '/Jobs/' + juuid + '/' + imagefilename;
    }
    else if(imgStatus == "NULL"){
        ImagePath = "NA";
    }
    else{
        throw new Error('Invalid value of key "imagestatus"');
    }
    
    var table = 'Jobs';
    
    var params = {
        TableName: table,
        Item:{
            'JUUID': juuid,
            'JobTitle':JobTitle,
            'CompanyName':CompanyName,
            'Location': Location,
            'Payscale':Payscale,
            'Duration':Duration,
            'Skills':Skills,
            'Description':Description,
            'ImagePath' : ImagePath,
            'RefAmount' : RefAmount,
            'Domain' : Domain
        }
    };
    
    console.log('JUUID is '+ JSON.stringify(params.Item.JUUID));
    
    docClient.put(params, function(error, data) {
        
        if(error) throw error;
        
        console.log('DynamoDB Udpated');
        
        var responseJSON = {};
        
        responseJSON.imagestatus = request.body.imagestatus;
        
        if(responseJSON.imagestatus == "CHANGE"){
            responseJSON.juuid = juuid;
        }
        else{
            //Add nothing
        }
        
        var job = new jobSchema.Job({
            JUUID : params.Item.JUUID,
            title : params.Item.JobTitle,
            companyname : params.Item.CompanyName,
            payscale : params.Item.Payscale,
            details : params.Item.Description,
            RefAmount : params.Item.RefAmount,
            Domain : params.Item.Domain
        });
        
        var query;
        var data = {}; 
        
        if(jobProcess == 'ADD'){
            console.log('ADD query builder called');
            query = 'INSERT INTO jobs SET ?';
            data = job;
        }
        else if(jobProcess == 'EDIT'){
            console.log('EDIT query builder called');
            
            var editData = {
                title : params.Item.JobTitle,
                companyname : params.Item.CompanyName,
                payscale : params.Item.Payscale,
                details : params.Item.Description,
                RefAmount : params.Item.RefAmount,
                Domain : params.Item.Domain
            };
            
            query = 'UPDATE jobs SET ? WHERE JUUID = ?';
            data = [editData, job.JUUID];
        }
        else{
            throw new Error('Invalid jobProcess');
        }
        
        _connection.query(query, data, function(error, row){
            
            if (error){
                throw error;
            }
            else{                
                console.log(JSON.stringify(responseJSON));
        
                response.send(responseJSON);
                response.end();                
            }
            
        });

    });
    
});

module.exports = router;