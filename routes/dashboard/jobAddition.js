var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var AWS = require('aws-sdk');
var uuidGenerator = require('uuid');

var config = require('../Config');

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
    var incentive = request.body.incentive;
    if(request.body.JUUID){
        var juuid = request.body.JUUID;
    }
    else{
        var juuid = uuidGenerator.v4();
    }        
    
    var ImagePath = {};
    
    if(imgStatus == "NO_CHANGE"){        
        ImagePath = urlprotocol + s3bucketheader + '/' + juuid + '/' + imagefilename;        
    }
    else if(imgStatus == "CHANGE"){
        ImagePath = urlprotocol + s3bucketheader + '/' + juuid + '/' + imagefilename;
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
            'ImagePath' : ImagePath
        }
    };
    
    console.log('JUUID is '+ JSON.stringify(params.Item.JUUID));
    
    docClient.put(params, function(error, data) {
        
        if(error) throw error;
        
        var responseJSON = {};
        
        responseJSON.imagestatus = request.body.imagestatus;
        
        if(responseJSON.imagestatus == "CHANGE"){
            responseJSON.juuid = juuid;
        }
        else{
            //Add nothing
        }
        
        console.log(JSON.stringify(responseJSON));
        
        response.send(responseJSON);
        response.end();
    });
    
    //TODO: Add part which adds the details to RDS
    
});

module.exports = router;