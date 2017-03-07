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

var appconfig = require('../Config');
var connection = appconfig.createConnection;

router.get('/',function(request,response){    
    scanJobs(true, response);    
});

router.get('/deactive/',function(request,response){    
    scanJobs(false, response);    
});

function scanJobs(isActive, response){
    
    var params = {
        TableName : jobstbl_ddb,
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
        
        console.log(JSON.stringify(data, null, 3));
        
        var activeSQLparam = null;
        
        if(isActive){
            activeSQLparam = '1';
        }
        else{
            activeSQLparam = '0';
        }
        
        connection.query('SELECT jobs.JUUID, (SELECT COUNT( apply.jobid ) FROM apply WHERE apply.jobid = jobs.JUUID AND apply.Seen = ? AND jobs.Active = ?) AS  NewApplctns FROM jobs', ["0", activeSQLparam], function(err, rows){
            
            console.log(JSON.stringify(rows, null, 3));
            
            var responseData = matchApplicationsCount(data.Items, rows);
            
            response.send(responseData);
            response.end();
            
        });
    
    });
    
}

/*
Function to match the new applications' count to their respective job data.

@params
    masterArray: Array containing job's data
    countArray: Array containing each job's new-count

@return: the matched array
*/
function matchApplicationsCount(masterArray, countArray){
    
    for(var i = 0; i < masterArray.length; i++){
        
        for(var j=0; j<countArray.length; j++){
            
            if(masterArray[i].JUUID == countArray[j].JUUID){                
                masterArray[i].new_applications = countArray[j].NewApplctns;
            }
            
        }
    }
    
    console.log('Array after matching is ' + JSON.stringify(masterArray, null, 3));
    return masterArray;
    
}

module.exports = router;