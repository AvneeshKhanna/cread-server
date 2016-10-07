/*
This script updates the user's application status when a request is issued from the dashboard. If the status recieved is 'FINALISED', the 'Earnings' table has to be updated as well.
*/
var express = require('express');
var app = express();
var router = express.Router();

var mysql = require('mysql');
var _connection = mysql.createConnection({
    host : 'testrdsinstance.cfjbzkm4dzzx.ap-northeast-1.rds.amazonaws.com',
    user : 'ttrds',
    password : 'amazonpass2015',
    database : 'testdb',
    port : '3306'
});

router.post('/', function(request, response){
    
    var uuid = request.body.uuid;
    var jobid = request.body.jobid;
    var application_status = request.body.applicationstatus;
    var refAmount = request.body.refamount;
    var refcode = request.body.refcode;
    
    console.log('Request is ' + JSON.stringify(request.body, null, 3));
    
    if(application_status == 'Finalised' && refcode != 'none'){
        
        var tableValues = {
            
            paymentStatus : 'Pending',
            referralAmount : refAmount,
            refCode : refcode
        }
        
        _connection.query('INSERT INTO Earnings SET ?', tableValues, function(err, rows){
            
            if (err){
                throw err;
            }
            else{                
                updateAplcnStatus(application_status, uuid, jobid, response);
            }            
        });        
    }
    else{
        updateAplcnStatus(application_status, uuid, jobid, response);
    }
});

function updateAplcnStatus(application_status, uuid, jobid, response){
    
    _connection.query('UPDATE apply SET Application_status = ? WHERE userid = ? AND jobid = ?', [application_status, uuid, jobid], function(err, rows){
        
        if(err){
            throw err;
        }
        else{            
            response.send(true);
            response.end();
        }
    });

}

module.exports = router;