//This module sends the OTP to the phone number who have register to the app.

var express = require('express');
var app = express();
var router = express.Router();

var mysql = require('mysql');
var AWS = require('aws-sdk');
var config = require('./Config');

var _connection = config.createConnection;

router.post('/', function(request, response){
        
    var contactnumber = request.body.contactnumber;
    console.log('Request received sign up otp');
    console.log('Request ' + JSON.stringify(request.body, null, 3));
    
    _connection.query('SELECT UUID FROM users WHERE phoneNo = ?', [contactnumber], function(err, row){
        
        if (err){
            throw err;
        }
        else{
            
            var responseObj = {};
            
            if(row.length == 0){
                
                console.log('forgotPassword UUID in response: ' + JSON.stringify(row));
                responseObj.exists = false;
                
                var sns = new AWS.SNS();
                
                var params = {
                    attributes : {
                        DefaultSMSType : 'Transactional'
                    }
                };
                
                sns.setSMSAttributes(params, function(err, data){
                    
                    if(err){
                        throw err;
                    }
                    else{
                        
                        var OTP = otpGenerator();                        
                        var params = {                    

                            Message : 'You verification code for Market Recruit is - ' + OTP,
                            PhoneNumber : '+91' + contactnumber
                        };
                        
                        console.log('sns request sending with otp ' + OTP);
                
                        sns.publish(params, function(err, data){

                            if(err){
                                throw err;
                            }
                            else{                        
                                responseObj.OTP = OTP;
                                response.send(responseObj);
                                response.end();                        
                            }

                        });
                    } 
                });
            }
            else{
                responseObj.exists = true;
                response.send(responseObj);                
            }            
        }
    });
    
});

/*
Generates a random number between [1000, 10000)
*/
function otpGenerator(){    
    return Math.floor((Math.random() * 9000) + 1000);    
}

module.exports = router;