/*
This module extracts the userid using refcode from Referrals table. Using that userid, the user's profie-pic link is created and sent back as a response from the server.

This script is requested when a referree opens an external-referral link and the external-referral pop up screen is shown
*/

var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var AWS = require('aws-sdk');

AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
});

var docClient = new AWS.DynamoDB.DocumentClient();
var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');
var s3bucket = envconfig.get('s3.bucket');

var s3bucketheader = s3bucket + '.s3-ap-northeast-1.amazonaws.com';
var imagefilename = 'display-pic.jpg';
var urlprotocol = 'https://';

var config = require('../Config');
var _connection = config.createConnection;

router.post('/', function(request, response){
    
    var refcode = request.body.refcode;
    
    //extract userid using refcode from Referrals table
    _connection.query('SELECT userid FROM Referrals WHERE Refcode = ?', refcode, function(err, data){
       
        if(err){
            throw err;
        }
        else{
            
            var profilePicURL = urlprotocol + s3bucketheader + '/Users/' + data[0].userid + '/Profile/' + imagefilename;
    
            /*var response_data = {
                ProfilePicURL : profilePicURL
            };*/

            response.send(profilePicURL);
            response.end();
            
        }
        
    });
    
});

module.exports = router;