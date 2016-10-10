/*
This script is used to send the referrer and applied user's details for the ReferrerDetail screen at the dashboard.
*/
var express = require('express');
var app = express();
var router = express.Router();

var mysql = require('mysql');

var AWS = require('aws-sdk');
var dynamo_marshal = require('dynamodb-marshaler'); 

var _connection = mysql.createConnection({
    host : 'testrdsinstance.cfjbzkm4dzzx.ap-northeast-1.rds.amazonaws.com',
    user : 'ttrds',
    password : 'amazonpass2015',
    database : 'testdb',
    port : '3306'
});

AWS.config.region = 'ap-northeast-1'; 
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

var request = {};

router.post('/', function(request, response){
    
    this.request = request;
    
    console.log('Request is ' + request);
    
    var referrer_id = request.body.referrer_id;
    var applicant_id = request.body.applicant_id;
    var refcode = request.body.refcode;
    
    var params = {
        
        TableName : 'User_Profile',
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
                    
                    _connection.query('SELECT paymentStatus FROM Earnings WHERE refCode = ? AND applieduserid = ?', [refcode, '15dc3883-7eab-4a34-9d2f-1057d11141c0'], function(err, rows){
                        
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
    
    /*getUsersDataDynamo(function(data){
        
        response.send(dummyData());
        response.end();
        
    });*/
    
    /*response.send(dummyData());
    response.end();*/
    
});

router.post('/payment-approval/', function(request,response){
    
    var refcode = request.body.refcode;
    var applicant_id = request.body.applicant_id;
    console.log(JSON.stringify(request.body, null, 3));
    
    _connection.query('UPDATE Earnings SET paymentStatus = ? WHERE refCode = ? AND applieduserid = ?', ['Approved', refcode, applicant_id], function(err, data){
        
        if(err){
            throw err;
        }
        
        response.send(true);
        response.end();
    });
    
})

function getUsersDataDynamo(callback){
    
    console.log('getUsersDataDynamo called');
    
    var params = {
        TableName: 'User_Profile',
        KeyConditions: [
            DynamoDB.Condition('UUID', 'EQ', referrer_id),
            DynamoDB.Condition('UUID', 'EQ', applicant_id)
        ],
        ConditionalOperator : 'OR' 
    };
    
    docClient.get(params, function (err, data){
       
        if(err){
            console.log(err);
            throw err;
        }
        
        console.log(data);
        callback(data);
    });
}

function dummyData(){
    
    var data = {
        
        referrer_id : 'a',
        referrer_data : {
            Name : 'Avneesh Khanna',
            Contact : '9999015838',
            Email : 'avneesh.khanna92@gmail.com',
            BankDetails: {
                Account_holder : "fcv",
                Account_number : "5889",
                Bank_branch : "vb",
                Bank_name : "cvv",
                IFSC : "fghh"                
            }
        },
        applicant_id : 'afa',
        applicant_data : {            
            Name : 'Suraj Kandoi',
            Contact : '9999087839',
            Email : 'suraj.kandoi@gmail.com'            
        },
        referrer_payment_status : 'Pending'        
    };
    
    return data;
}

module.exports = router;