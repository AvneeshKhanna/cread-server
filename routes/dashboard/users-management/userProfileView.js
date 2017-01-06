var express = require('express');
var app = express();
var router = express.Router();
var mysql = require('mysql');
var AWS = require('aws-sdk');

AWS.config.region = 'ap-northeast-1'; 
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

var config = require('../../Config');
var _connection = config.createConnection;

var referrals = new Array();

/*
For sending a user's basic details to the dashboard 
*/
router.post('/', function(request, response){
    
    console.log(JSON.stringify(request.body.userid));
    
    var params = {
        TableName : 'User_Profile'
    };
    params.Key = {
        UUID : request.body.userid
    };
    
    docClient.get(params, function(err, data) {
        if (err) throw err;
        
        console.log(JSON.stringify(data, null, 3));
        response.send(data);
        response.end();
    });
});

/*
For sending a user's job applications to the dashboard 
*/
router.post('/job-applications/', function(request, response){
    
    var uuid = request.body.uuid;
    //var auth_key = request.body.authkey;
    var ApplicationForms = new Array();
    
    var sqlQuery = 'SELECT jobs.title,jobs.companyname,jobs.Active,apply.Application_status FROM apply INNER JOIN jobs ON jobs.JUUID = apply.jobid WHERE apply.userid = ? AND apply.Status = ?';
    
    var responseData = {};
    //responseData.tokenstatus = {};
    responseData.applicationsdata = new Array();
    
    console.log('Request in jobApplications is ' + JSON.stringify(request.body, null, 3));
    
    _connection.query(sqlQuery, [uuid, 'Applied'], function(error,row){
                
        console.log('Users applications are ' + JSON.stringify(row, null, 3));

        if (error) throw error;

        for(var j=0 ; j<row.length ; j++){
            var localJson = {};
            localJson['title'] = row[j].title;
            localJson['companyname'] = row[j].companyname;
            localJson['status'] = row[j].Application_status;
            localJson['active'] = row[j].Active;

            ApplicationForms.push(localJson);
        }

        responseData.applicationsdata = ApplicationForms;

        console.log('Response object is: ' + JSON.stringify(responseData, null, 3));

        response.send(responseData);
        response.end();

        ApplicationForms=[];
    });
    
});

/*
For sending total referrals made by a user to the dashboard 
*/
router.post('/referrals/', function(request, response){
    
    var uuid = request.body.uuid;
    
    var sqlQuery = 'SELECT users.firstname, users.UUID, users.lastname, jobs.title, jobs.companyname, jobs.RefAmount, jobs.JUUID, apply.Application_status FROM apply INNER JOIN Referrals ON apply.Refcode = Referrals.Refcode INNER JOIN users ON users.UUID = apply.userid INNER JOIN jobs ON apply.jobid = jobs.JUUID WHERE Referrals.userid = ? ORDER BY jobs.JUUID';
    
    _connection.query(sqlQuery, [uuid], function(error, row){
        if (error) throw error;
        
        console.log(row);
        
        for(var i=0 ; i<row.length ; i++){
            var localJson ={};
            localJson['name'] = row[i].firstname + ' ' + row[i].lastname;
            localJson['uuid'] = row[i].UUID;
            localJson['amount'] = row[i].RefAmount;
            localJson['status'] = row[i].Application_status;
            localJson['jobid'] = row[i].JUUID;
            localJson['jobtitle'] = row[i].title;
            localJson['jobcompany'] = row[i].companyname;
            
            referrals.push(localJson);
        }
        
        response.send(referrals);
        response.end();
        referrals=[];   
        
    });
});

module.exports = router;