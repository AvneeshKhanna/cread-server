/*
This module stores respective entries into 'apply' table and 'referredUsers' table once the user clicks on 'Apply' button in a job posting using external-referral.
*/

var express = require('express');
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
    
    console.log('request data is ' + request.body);
    
    var apply_data = {};    
    apply_data.userid = request.body.userid_referred;
    apply_data.Refcode = request.body.refcode;
    apply_data.jobid = request.body.jobid;
    apply_data.Status = request.body.status;
    apply_data.Application_status = request.body.application_status;
    
    console.log('apply_data is ' + apply_data);
    
    saveInApplyTbl(apply_data, function(onApplyResult){
        
        if(onApplyResult){
            var refusers_data = {};
            refusers_data.Refcode = request.body.refcode;
            refusers_data.refUser = request.body.userid_referred;
            
            saveInRefUsersTbl(refusers_data, function(onSaveRefUsrsResult){
                
                if(onSaveRefUsrsResult){
                    response.send({'status':'OK'});
                    response.end();
                }
                else{
                    response.send('The referral could not be registered due to some reason');
                    response.end();
                }
                
            });
        }
        else{
            response.send('The application could not be registered due to some reason');
            response.end();
        }        
    });
    
});

/*Used to save data into 'apply' table*/
function saveInApplyTbl(data, onApplySave){
    
    connection.query('INSERT INTO apply SET ?', data, function(err, row){
        
        if(err){
            throw err;
        }
        else{
            
            if(row){
                onApplySave(row);
            }
            else{
                onApplySave(null);
            }            
        }        
    });
    
}

/*Used to save data into 'referredUsers' table*/
function saveInRefUsersTbl(data, onRefUsersSave){
    
    connection.query('INSERT INTO referredUsers SET ?', data, function(err, row){
        
        if(err){
            throw err;
        }
        else{
            
            if(row){
                onRefUsersSave(row);
            }
            else{
                onRefUsersSave(null);
            }            
        }
        
    });
    
}

module.exports = router;