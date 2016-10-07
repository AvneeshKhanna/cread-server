var express = require('express');
var app = express();
var router = express.Router();

var mysql = require('mysql');

var connection = mysql.createConnection({
    host : 'testrdsinstance.cfjbzkm4dzzx.ap-northeast-1.rds.amazonaws.com',
    user : 'ttrds',
    password : 'amazonpass2015',
    database : 'testdb',
    port : '3306'
});

router.post('/', function(request, response){
    
    var contactnumber = request.body.contactnumber;
    
    connection.query('SELECT UUID FROM users WHERE phoneNo = ?', [contactnumber], function(err, row){
        if (err){
            throw err;
        }
        else{
            
            var responseObj = {};
            
            if(row.length == 0){
                responseObj.valid = false;
                responseObj.OTP = '1234'
            }
            else{
                console.log('forgotPassword UUID in response: ' + JSON.stringify(row))
                responseObj.valid = true;
                responseObj.uuid = row[0].UUID;
                //TODO Send SNS request for OTP message to the relevant contact number
                responseObj.OTP = '1234';
            }
            
            response.send(responseObj);
            response.end();
            
        }
    });
    
});

module.exports = router;