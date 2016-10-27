/*
This module stores respective entries into 'apply' table and 'referredUsers' table once the user clicks on 'Apply' button in a job posting using external-referral.
*/

var express = require('express');
var router = express.Router();
var mysql = require('mysql');

var authtokenvalidation = require('../authtokenValidation');   //module to authenticate user before making request

var connection = mysql.createConnection({
    host : 'testrdsinstance.cfjbzkm4dzzx.ap-northeast-1.rds.amazonaws.com',
    user : 'ttrds',
    password : 'amazonpass2015',
    database : 'testdb',
    port : '3306'
});

router.post('/', function(request, response){
    var userid = request.body.userid_referred;
    var auth_key = request.body.authkey;
    
    console.log('request data is ' + JSON.stringify(request.body));
    
    var apply_data = {};    
    apply_data.userid = request.body.userid_referred;
    apply_data.Refcode = request.body.refcode;
    apply_data.jobid = request.body.jobid;
    apply_data.Status = /*request.body.status*/"Applied";
    apply_data.Application_status = /*request.body.application_status*/"Pending";
    
    console.log('apply_data is ' + JSON.stringify(apply_data));
    
    authtokenvalidation.checkToken(userid, auth_key, function(err, data){
        if(err) throw err;
        
        else if(data == 0){
            var invalidJson = {};
            invalidJson['tokenstatus'] = 'invalid';
            response.send(JSON.stringify(invalidJson));
            response.end();
        }
        
        else{
            saveInApplyTbl(apply_data, function(onApplyResult){
                var validJson = {};
                
                if(onApplyResult){
                    var refusers_data = {};
                    refusers_data.Refcode = request.body.refcode;
                    refusers_data.refUser = request.body.userid_referred;
                
                    saveInRefUsersTbl(refusers_data, function(onSaveRefUsrsResult){
                        if(onSaveRefUsrsResult){
                            validJson['tokenstatus'] = 'valid';
                            validJson['status'] = 'OK';
                            response.send(JSON.stringify(validJson));
                            response.end();
                        }
                        else{
                        //response.send('The referral could not be registered due to some reason');
                            validJson['tokenstatus'] = 'valid';
                            validJson['status'] = 'error';
                            response.send(JSON.stringify(validJson));
                            response.end();
                        }
                    });
                }
                else{
                    //response.send('The application could not be registered due to some reason');
                    validJson['tokenstatus'] = 'valid';
                    validJson['status'] = 'error';
                    response.send(validJson);
                    response.end();
                }        
            });
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