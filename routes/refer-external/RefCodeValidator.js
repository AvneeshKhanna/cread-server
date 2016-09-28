/*
This module validates the external referral-code entered by the 'referred-user' and sends back the response. It validates:
    -Whether the ref-code is valid or not
    -Whether the user has already applied for the job
*/
var express = require('express');
var router = express.Router();

var mysql = require('mysql');

var uuidGenerator = require('uuid');

var connection = mysql.createConnection({
    host : 'testrdsinstance.cfjbzkm4dzzx.ap-northeast-1.rds.amazonaws.com',
    user : 'ttrds',
    password : 'amazonpass2015',
    database : 'testdb',
    port : '3306'
});

router.post('/', function(request, response){
    
    var userid = request.body.userid;
    var refcode = request.body.refcode;
    
    refCodeValidtr(refcode, function(codeValidResult){
        
        if(codeValidResult){
            
            applictnValidatr(userid, codeValidResult.jobid, function(applyValidResult){
                
                if(applyValidResult){
                    
                    var send_response = {};
                    send_response.jobid = applyValidResult.jobid;
                    send_response.refcode = refcode;
                    
                    response.send(send_response);
                    response.end();
                }
                else{
                    var alreadyappliedJson = {};
                    alreadyappliedJson.jobid = 'applied';
                    alreadyappliedJson.refcode = 'applied';
                    response.send(alreadyappliedJson);
                    response.end();
                }
                
            });
            
        }
        else{
            var inavalidJson = {};
            inavalidJson.jobid = 'invalid';
            inavalidJson.refcode = 'invalid';
            response.send(inavalidJson);
            response.end();
        }
        
    });
    
    
});

//To check whether refcode is valid or not. If yes, then retrieve the jid and pass it further for apply-table validation
function refCodeValidtr(refcode, onCodeValid){
    
    connection.query('SELECT * FROM Referrals WHERE Refcode = ?', refcode, function(err, rows){
       
        if(err){
            throw err;
        }
        else{            
            onCodeValid(rows[0]);            
        }
        
    });
    
}

//To check whether the user has already applied for the job
function applictnValidatr(userid, jobid, onApplyValid){
    
    console.log('userid in applictnValidatr is ' + userid + ' and jobid is ' + jobid);
    
    connection.query('SELECT * FROM apply WHERE userid = ? AND jobid = ?', [userid, jobid], function(err, rows){
        
        if(err){
            
            throw err;
            
        }
        else{
            
            //If any data is returned, then this means that the user has already applied for the job. Ref Code cannot be applied in the app
            if(rows[0]){
                
                console.log('Apply Validation userid ' + userid);
                
                onApplyValid(null);
                
            }
            //If no data is returned, then the user has not applied for the job yet. Ref Code can be applied in the app.
            else{
                
                onApplyValid({'jobid':jobid});
                
            }
            
        }
    });
    
}

module.exports = router;