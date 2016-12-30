var express = require('express');
var app = express();
var router = express.Router();
var mysql = require('mysql');
var AWS = require('aws-sdk');

AWS.config.region = 'ap-northeast-1'; 
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

router.get('/',function(request,response){    
    scanJobs(true, response);    
});

router.get('/deactive/',function(request,response){    
    scanJobs(false, response);    
});

function scanJobs(isActive, response){
    
    var params = {
        TableName : 'Jobs',
        /*AttributesToGet: [
            'JUUID',
            'CompanyName',
            'JobTitle',
            'Location',
            'ImagePath',
            'Duration',
            'RefAmount',
            'Domain',
            'Active'
        ],*/
        FilterExpression : 'Active = :_active',
        ExpressionAttributeValues : {':_active' : isActive}
    };
    
    docClient.scan(params, function(err, data) {
        if (err) throw err;
        
        console.log(JSON.stringify(data.Items, null, 3));
        
        console.log(data);
        response.send(data);
        response.end();
    });
    
}

module.exports = router;