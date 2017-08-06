/*
This script is used to send the referrer and applied user's details for the ReferrerDetail screen at the dashboard.
*/
var express = require('express');
var app = express();
var router = express.Router();

var mysql = require('mysql');

var AWS = require('aws-sdk');
var dynamo_marshal = require('dynamodb-marshaler');
var sendNotification = require('../../notification-system/notificationFramework');

var appconfig = require('../../Config');
var _connection = appconfig.createConnection;

AWS.config.region = 'ap-northeast-1'; 
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');

var request = {};

router.post('/', function(request, response){
    
    this.request = request;
    
    console.log('Request is ' + request);
    
    var referrer_id = request.body.referrer_id;
    var applicant_id = request.body.applicant_id;
    var refcode = request.body.refcode;
    
    var params = {
        
        TableName : userstbl_ddb,
        //ConditionalOperator: 'OR',
        Key: {
            UUID: referrer_id
        }        
    };
    
    var response_data = {};
    
    //Query to get referrer's data
    docClient.get(params, function(err, data){
        if(err){
            throw err;
        }
        else{
            
            console.log('Referrer QUery Response ' + JSON.stringify(data, null, 3));
            
            data = data.Item;
            console.log(data);
            response_data.referrer_id = data.UUID;
            response_data.referrer_data = {
                Name : data.Name,
                Contact : data.ContactNumber,
                Email : data.Email_Id,
                BankDetails : data.BankDetails
            };
            
            params.Key.UUID = applicant_id;
            
            //Query to get applicant's data
            docClient.get(params, function(err, data){
                
                data = data.Item;
                
                if(err){
                    throw err;
                }
                else{
                    response_data.applicant_id = data.UUID;
                    response_data.applicant_data = {
                        Name : data.Name,
                        Contact : data.ContactNumber,
                        Email : data.Email_Id
                    };
                    
                    _connection.query('SELECT paymentStatus FROM Earnings WHERE refCode = ? AND applieduserid = ?', [refcode, applicant_id], function(err, rows){
                        
                       if(err){
                           throw err;
                       }
                        else{
                            
                            console.log('paymentStatus query response - ' + JSON.stringify(rows, null, 3));
                            
                            response_data.referrer_payment_status = rows[0].paymentStatus;
                            
                            response.send(response_data);
                            response.end();
                        }
                        
                    });
                    
                }
                
            });
        }
    });    
});

router.post('/payment-approval/', function(request,response){
    var referredUserName = request.body.referredUserName;
    var refcode = request.body.refcode;
    var referredUserId = request.body.referredUserId;
    var referrer_id = request.body.referrer_id;
    var jobname = request.body.jobname;
    
    var notificationData = {
        Category : 'Payments',
        AppModel: "1.0",
        Persist: "Yes",
        Status : 'Approved',
        Referred : referredUserName,
        JobName : jobname
    };
    
    var applicantArray = [];
    applicantArray.push(referrer_id);
    
    console.log(JSON.stringify(request.body, null, 3));
    
    _connection.query('UPDATE Earnings SET paymentStatus = ? WHERE refCode = ? AND applieduserid = ?', ['Approved', refcode,referredUserId], function(err, data){
        
        if(err){
            throw err;
        }
        else {
            sendNotification.notification(applicantArray , notificationData , function(err){

                if(err){
                    console.error(err);
                    throw err;
                }
                else {
                    response.send(true);
                    response.end();
                }
            });
        }

    });
    
});

module.exports = router;