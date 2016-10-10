var express = require('express');
var app = express();
var router = express.Router();

var mysql = require('mysql');
var AWS = require('aws-sdk');

var _connection = mysql.createConnection({
    host : 'testrdsinstance.cfjbzkm4dzzx.ap-northeast-1.rds.amazonaws.com',
    user : 'ttrds',
    password : 'amazonpass2015',
    database : 'testdb',
    port : '3306'
});

router.post('/', function(request, response){
    console.log('Request received forgot password validate contact');
    
    var contactnumber = request.body.contactnumber;
    
    _connection.query('SELECT UUID FROM users WHERE phoneNo = ?', [contactnumber], function(err, row){
        
        if (err){
            throw err;
        }
        else{
            
            var responseObj = {};
            
            if(row.length == 0){
                responseObj.valid = false;
                response.send(responseObj);
            }
            else{
                console.log('forgotPassword UUID in response: ' + JSON.stringify(row))
                responseObj.valid = true;
                responseObj.uuid = row[0].UUID;
                //TODO Send SNS request for OTP message to the relevant contact number
                            
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
                        
                        console.log('sns request sending');
                
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