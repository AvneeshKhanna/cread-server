var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var AWS = require('aws-sdk');
var uuidGenerator = require('uuid');

var config = require('./Config');

AWS.config.region = 'ap-northeast-1'; 
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
}); 

var docClient = new AWS.DynamoDB.DocumentClient();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//config.dynamodbCredentials();

router.post('/',function(request,response,next){
    var JobTitle = request.body.JobTitle;
    var CompanyName = request.body.CompanyName;
    var Location = request.body.Location;
    var Payscale = request.body.Payscale;
    var Duration = request.body.Duration;
    var Skills = request.body.Skills;
    var Description = request.body.Description;
    var ImagePath = request.body.ImagePath;
    var juuid = uuidGenerator.v4();
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
            'ImagePath':ImagePath
        }
    };
    
    docClient.put(params, function(error, data) {
        if(error) throw error;
        
        response.send(true);
        response.end();
    });
});

module.exports = router;